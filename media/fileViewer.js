// @ts-check

(function() {
    // @ts-ignore - acquireVsCodeApi is provided by VS Code webview context
    const vscode = acquireVsCodeApi();
    
    let fileData = [];
    let fileRowCount = 0;
    let selectedRows = new Set();
    let rawTextData = '';
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let currentColumn = null;
    let isEditMode = false;
    let originalFileData = [];

    // DOM elements
    const table = document.getElementById('csvTable');
    const header = document.getElementById('csvHeader');
    const body = document.getElementById('csvBody');
    const copyBtn = document.getElementById('copyBtn');
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const selectionInfo = document.getElementById('selectionInfo');
    const modal = document.getElementById('textModal');
    const modalText = document.getElementById('modalText');
    const closeModal2 = document.getElementById('closeModal');
    const rawTextCheckbox = document.getElementById('rawTextCheckbox');
    const hasHeaderCheckbox = document.getElementById('hasHeaderCheckbox');
    const fitToScreenCheckbox = document.getElementById('fitToScreenCheckbox');
    const delimiterInput = document.getElementById('delimiterInput');

    // Event listeners
    if (copyBtn) {
        copyBtn.addEventListener('click', copySelectedRows);
    }
    if (editBtn) {
        editBtn.addEventListener('click', handleEditMode);
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSave);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }
    if (closeModal2) {
        closeModal2.addEventListener('click', hideModal2);
    }
    if (rawTextCheckbox) {
        rawTextCheckbox.addEventListener('change', handleRawTextToggle);
    }
    if (hasHeaderCheckbox) {
        hasHeaderCheckbox.addEventListener('change', handleHasHeaderToggle);
    }
    if (fitToScreenCheckbox) {
        fitToScreenCheckbox.addEventListener('change', handleFitToScreenToggle);
    }
    if (delimiterInput) {
        delimiterInput.addEventListener('input', handleDelimiterChange);
    }

    // Modal close events
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal2();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.style.display === 'block') {
            hideModal2();
        }
    });

    // Column resizing events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'update':
                rawTextData = message.rawText;
                parseRawText();
                break;
            case 'parsedData':
                renderTable(message.data);
                break;
        }
    });

    function parseRawText() {
       // Send message to extension to parse and once done invoke 'parsedData'
        vscode.postMessage({
            type: 'parseWithDelimiter',
            rawText: rawTextData,
            delimiter: delimiterInput ? delimiterInput.value || ',' : ',',
            useRawContent: rawTextCheckbox && rawTextCheckbox.checked
        });
    }

    // Handle delimiter change
    function handleDelimiterChange() {
        if (rawTextData) {
            parseRawText();
        }
    }

    // Handle raw text toggle
    function handleRawTextToggle() {
        if (rawTextData) {
            parseRawText();
        }
    }

    function renderTable(parsedRows) {
        fileData = parsedRows || fileData || [];
        if (!fileData || fileData.length === 0) {
            table.innerHTML = '<tbody><tr><td>No data to display</td></tr></tbody>';
            return;
        }
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        fileRowCount = hasHeader ? fileData.length - 1 : fileData.length;

        // Clear existing content
        header.innerHTML = '';
        body.innerHTML = '';
        selectedRows.clear();
        updateSelectionUI();

        // Set table class based on fit-to-screen setting
        if (fitToScreenCheckbox && fitToScreenCheckbox.checked) {
            table.classList.add('fit-to-screen');
        } else {
            table.classList.remove('fit-to-screen');
        }

        // Create header row
        const headerRow = document.createElement('tr');
        
        if (hasHeader) {
            // Use first row as headers
            fileData[0].forEach((headerText, index) => {
                const th = document.createElement('th');
                th.textContent = headerText || `Column ${index + 1}`;
                th.className = `column-${index % 10}`;
                
                // Use appropriate width calculation based on fit-to-screen setting
                const width = fitToScreenCheckbox && fitToScreenCheckbox.checked ? 
                    calculateFitToScreenWidth() : 
                    calculateInitialColumnWidth(index);
                th.style.width = width + 'px';
                
                // Add resize handle
                const resizeHandle = document.createElement('div');
                resizeHandle.className = 'resize-handle';
                resizeHandle.addEventListener('mousedown', (e) => startResize(e, index));
                th.appendChild(resizeHandle);
                
                headerRow.appendChild(th);
            });
        } else {
            // Generate ordinal number headers (1, 2, 3, ...)
            const columnCount = fileData[0] ? fileData[0].length : 0;
            for (let index = 0; index < columnCount; index++) {
                const th = document.createElement('th');
                th.textContent = (index + 1).toString();
                th.className = `column-${index % 10}`;
                
                // Use appropriate width calculation based on fit-to-screen setting
                const width = fitToScreenCheckbox && fitToScreenCheckbox.checked ? 
                    calculateFitToScreenWidth() : 
                    calculateInitialColumnWidth(index);
                th.style.width = width + 'px';
                
                // Add resize handle
                const resizeHandle = document.createElement('div');
                resizeHandle.className = 'resize-handle';
                resizeHandle.addEventListener('mousedown', (e) => startResize(e, index));
                th.appendChild(resizeHandle);
                
                headerRow.appendChild(th);
            }
        }
        header.appendChild(headerRow);

        // Create data rows
        const dataStartIndex = hasHeader ? 1 : 0; // Start from index 0 if no header, 1 if header
        
        for (let i = dataStartIndex; i < fileData.length; i++) {
            const row = document.createElement('tr');
            row.dataset.rowIndex = i.toString();
            
            fileData[i].forEach((cellText, columnIndex) => {
                const td = document.createElement('td');
                td.className = `column-${columnIndex % 10}`;
                
                const cellContent = createCellContent(cellText);
                td.appendChild(cellContent);
                
                row.appendChild(td);
            });
            
            // Add row selection event
            row.addEventListener('click', (e) => handleRowSelection(e, i));
            
            body.appendChild(row);
        }
        
        // Enable edit button when data is loaded (only in non-edit mode)
        if (editBtn && !isEditMode) {
            editBtn.disabled = false;
        }
    }

    function calculateInitialColumnWidth(columnIndex) {
        if (!fileData || fileData.length === 0) return 120;
        
        let maxLength = 0;
        for (const row of fileData) {
            if (row[columnIndex]) {
                const length = row[columnIndex].length;
                if (length > maxLength) {
                    maxLength = length;
                }
            }
        }
        
        // Content-based width calculation with reasonable limits
        // Approximately 8px per character + padding, max 250px
        const calculatedWidth = Math.max(80, Math.min(250, maxLength * 8 + 24));
        return calculatedWidth;
    }

    function calculateFitToScreenWidth() {
        if (!fileData || fileData.length === 0) return 120;
        
        const tableContainer = document.getElementById('tableContainer');
        const containerWidth = tableContainer ? tableContainer.clientWidth - 40 : 800; // Leave padding
        const columnCount = fileData[0].length;
        
        // Distribute width evenly across all columns
        return Math.max(80, Math.floor(containerWidth / columnCount));
    }

    function createCellContent(text) {
        const container = document.createElement('div');
        container.className = 'cell-content';
        container.textContent = text || '';
        return container;
    }

    function createCellContent2(text) {
        const container = document.createElement('div');
        container.className = 'cell-content';
        
        if (!text) {
            container.textContent = '';
            return container;
        }
        
        // Check if content exceeds 3 lines (rough estimate based on character count)
        const lines = text.split('\n');
        const estimatedLines = lines.reduce((count, line) => {
            // Estimate line wrapping based on average character width
            return count + Math.ceil(line.length / 40); // Rough estimate
        }, 0);
        
        if (estimatedLines > 3 || text.length > 150) {
            // Create truncated content structure
            container.classList.add('truncated');
            
            // Create truncated text container
            const truncatedTextDiv = document.createElement('div');
            truncatedTextDiv.className = 'truncated-text';
            
            // Truncate content more aggressively to ensure button visibility
            const truncatedText = text.length > 100 ? text.substring(0, 100) + '...' : text;
            truncatedTextDiv.textContent = truncatedText;
            
            // Create "Show More" button on a new line
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'show-more-btn';
            showMoreBtn.textContent = 'Show More';
            showMoreBtn.type = 'button';
            showMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showModal2(text);
            });
            
            // Add truncated text
            container.appendChild(truncatedTextDiv);
            
            // Add button on new line
            container.appendChild(showMoreBtn);
        } else {
            container.textContent = text;
        }
        
        return container;
    }

    function handleRowSelection(event, rowIndex) {
        // Disable row selection in edit mode
        if (isEditMode) {
            return;
        }
        
        if (event.ctrlKey || event.metaKey) {
            // Toggle selection
            if (selectedRows.has(rowIndex)) {
                selectedRows.delete(rowIndex);
            } else {
                selectedRows.add(rowIndex);
            }
        } else if (event.shiftKey && selectedRows.size > 0) {
            // Range selection
            const lastSelected = Math.max(...selectedRows);
            const start = Math.min(rowIndex, lastSelected);
            const end = Math.max(rowIndex, lastSelected);
            
            for (let i = start; i <= end; i++) {
                selectedRows.add(i);
            }
        } else {
            // Single selection
            selectedRows.clear();
            selectedRows.add(rowIndex);
        }
        
        updateRowHighlights();
        updateSelectionUI();
    }

    function updateRowHighlights() {
        const rows = body.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const rowIndex = parseInt(row.dataset.rowIndex);
            if (selectedRows.has(rowIndex)) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }

    function updateSelectionUI() {
        const count = selectedRows.size;
        const total = (fileRowCount && fileRowCount > 0) ?  ` of total ${fileRowCount} row${fileRowCount > 1 ? 's' : ''}` : '';
        if (count === 0) {
            copyBtn.disabled = true;
            selectionInfo.textContent = 'No rows selected' + total;
        } else {
            copyBtn.disabled = false;
            selectionInfo.textContent = `${count} row${count > 1 ? 's' : ''} selected` + total;
        }
    }

    function copySelectedRows() {
        if (selectedRows.size === 0) return;
        
        const rowsToCopy = [];
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        // Add header row
        if (hasHeader && fileData.length > 0) rowsToCopy.push(fileData[0]);
        
        // Add selected data rows
        const sortedIndices = Array.from(selectedRows).sort((a, b) => a - b);
        sortedIndices.forEach(rowIndex => {
            rowsToCopy.push(fileData[rowIndex]);
        });
        
        // Get current delimiter
        const currentDelimiter = delimiterInput ? delimiterInput.value || ',' : ',';
        
        // Send message to extension to copy to clipboard
        vscode.postMessage({
            type: 'copy',
            rows: rowsToCopy,
            delimiter: currentDelimiter,
            hasHeader: hasHeader
        });
    }

    function showModal2(text) {
        modalText.textContent = text;
        modal.style.display = 'block';
    }

    function hideModal2() {
        modal.style.display = 'none';
    }

    // Column resizing functionality
    function startResize(event, columnIndex) {
        isResizing = true;
        currentColumn = columnIndex;
        startX = event.clientX;
        
        const headers = header.querySelectorAll('th');
        const leftColumn = headers[columnIndex];
        const rightColumn = headers[columnIndex + 1];
        
        // Add visual feedback
        document.body.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        
        if (leftColumn) {
            leftColumn.classList.add('resizing');
        }
        if (rightColumn) {
            rightColumn.classList.add('resizing');
        }
        
        // Store initial widths of the two adjacent columns
        if (leftColumn) {
            startWidth = parseInt(document.defaultView.getComputedStyle(leftColumn).width, 10);
        }
        if (rightColumn) {
            const rightWidth = parseInt(document.defaultView.getComputedStyle(rightColumn).width, 10);
            rightColumn.dataset.initialWidth = rightWidth.toString();
        }
        
        event.preventDefault();
    }

    function handleMouseMove(event) {
        if (!isResizing) return;
        
        const diff = event.clientX - startX;
        const headers = header.querySelectorAll('th');
        const leftColumn = headers[currentColumn];
        const rightColumn = headers[currentColumn + 1];
        
        if (!leftColumn) return;
        
        // Calculate new width for left column
        const newLeftWidth = Math.max(50, startWidth + diff);
        
        // If this is the last column, just resize it within table bounds
        if (!rightColumn) {
            const tableContainer = document.getElementById('tableContainer');
            const maxWidth = tableContainer.clientWidth - 50; // Leave some padding
            const finalWidth = Math.min(newLeftWidth, maxWidth);
            
            updateColumnWidth(currentColumn, finalWidth);
            return;
        }
        
        // For adjacent columns, adjust both columns
        const rightInitialWidth = parseInt(rightColumn.dataset.initialWidth || '100');
        const newRightWidth = Math.max(50, rightInitialWidth - diff);
        
        // Only update if both columns can maintain minimum width
        if (newLeftWidth >= 50 && newRightWidth >= 50) {
            updateColumnWidth(currentColumn, newLeftWidth);
            updateColumnWidth(currentColumn + 1, newRightWidth);
        }
    }
    
    function updateColumnWidth(columnIndex, width) {
        const headers = header.querySelectorAll('th');
        const cells = body.querySelectorAll(`td:nth-child(${columnIndex + 1})`);
        
        if (headers[columnIndex]) {
            headers[columnIndex].style.width = width + 'px';
        }
        
        cells.forEach(cell => {
            cell.style.width = width + 'px';
        });
    }

    function handleMouseUp() {
        if (isResizing) {
            // Remove visual feedback
            document.body.classList.remove('resizing');
            document.body.style.cursor = '';
            
            const headers = header.querySelectorAll('th');
            if (headers[currentColumn]) {
                headers[currentColumn].classList.remove('resizing');
            }
            if (headers[currentColumn + 1]) {
                headers[currentColumn + 1].classList.remove('resizing');
            }
        }
        
        isResizing = false;
        currentColumn = null;
    }

    // Handle select all with Ctrl+A
    document.addEventListener('keydown', (e) => {
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && modal.style.display !== 'block') {
            e.preventDefault();
            
            // Select all data rows (excluding header)
            selectedRows.clear();
            const startIdx = hasHeader ? 1 : 0;
            for (let i = startIdx; i < fileData.length; i++) {
                selectedRows.add(i);
            }
            
            updateRowHighlights();
            updateSelectionUI();
        }
    });

    // Handle has header toggle
    function handleHasHeaderToggle() {
        if (!fileData || fileData.length === 0) return;
        
        // Re-render the entire table since header structure changes
        renderTable(fileData);
    }

    // Handle fit to screen toggle
    function handleFitToScreenToggle() {
        if (!fileData || fileData.length === 0) return;
        
        // Update table class for CSS styling
        if (fitToScreenCheckbox && fitToScreenCheckbox.checked) {
            table.classList.add('fit-to-screen');
        } else {
            table.classList.remove('fit-to-screen');
        }
        
        // Re-render the table with new column widths
        const headerRow = header.querySelector('tr');
        if (headerRow) {
            const headers = headerRow.querySelectorAll('th');
            headers.forEach((th, index) => {
                const width = fitToScreenCheckbox.checked ? 
                    calculateFitToScreenWidth() : 
                    calculateInitialColumnWidth(index);
                th.style.width = width + 'px';
                
                // Also update corresponding data cells
                const cells = body.querySelectorAll(`td:nth-child(${index + 1})`);
                cells.forEach(cell => {
                    cell.style.width = width + 'px';
                });
            });
        }
    }

    // Handle edit mode
    function handleEditMode() {
        if (!fileData || fileData.length === 0) return;
        
        isEditMode = true;
        originalFileData = JSON.parse(JSON.stringify(fileData)); // Deep copy
        
        // Update UI
        if (editBtn) editBtn.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';

        if (saveBtn) {
            saveBtn.style.display = 'inline-block';
            saveBtn.disabled = false;
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
            cancelBtn.disabled = false;
        }
        
        // Disable other controls during edit mode
        if (rawTextCheckbox) rawTextCheckbox.disabled = true;
        if (hasHeaderCheckbox) hasHeaderCheckbox.disabled = true;
        if (fitToScreenCheckbox) fitToScreenCheckbox.disabled = true;
        if (delimiterInput) delimiterInput.disabled = true;
        
        // Make cells editable
        toggleTableEditMode(true);

        // Add visual indicator for edit mode
        if (table) table.classList.add('edit-mode');
    }

    // Handle save
    function handleSave() {
        if (!isEditMode) return;
        
        // Collect data from editable cells
        const editedData = collectEditedData();
        
        // Send save message to extension
        const currentDelimiter = delimiterInput ? delimiterInput.value || ',' : ',';
        vscode.postMessage({
            type: 'save',
            data: editedData,
            delimiter: currentDelimiter
        });

        // Update fileData with edited data
        fileData = JSON.parse(JSON.stringify(editedData));
        // Restore cells with the new edited data
        restoreCellsWithData(editedData);
        
        // Exit edit mode
        exitEditMode();
    }

    // Handle cancel
    function handleCancel() {
        if (!isEditMode) return;
        
        // Restore original data and cell content without re-rendering
        fileData = JSON.parse(JSON.stringify(originalFileData));
        restoreCellsWithData(originalFileData);
        
        // Exit edit mode
        exitEditMode();
    }

    // Restore cells with new edited data
    function restoreCellsWithData(data) {
        if (!body) return;
        
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        
        const rows = body.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
            const actualDataIndex = hasHeader ? rowIndex + 1 : rowIndex;
            if (actualDataIndex < data.length) {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, columnIndex) => {
                    const newCellData = data[actualDataIndex][columnIndex] || '';
                    const cellContent = createCellContent(newCellData);
                    cell.innerHTML = '';
                    cell.appendChild(cellContent);
                });
            }
        });
    }

    // Exit edit mode
    function exitEditMode() {
        isEditMode = false;

        // Make cells read-only
        toggleTableEditMode(false);
        if (editBtn) editBtn.style.display = 'inline-block';
        if (copyBtn) copyBtn.style.display = 'inline-block';

        if (saveBtn) {
            saveBtn.style.display = 'none';
            saveBtn.disabled = true;
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
            cancelBtn.disabled = true;
        }
        
        // Re-enable controls
        if (rawTextCheckbox) rawTextCheckbox.disabled = false;
        if (hasHeaderCheckbox) hasHeaderCheckbox.disabled = false;
        if (fitToScreenCheckbox) fitToScreenCheckbox.disabled = false;
        if (delimiterInput) delimiterInput.disabled = false;
        
        // Remove edit mode visual indicator
        if (table) table.classList.remove('edit-mode');
        
        // Clear selection
        selectedRows.clear();
        updateSelectionUI();
    }

    // Make table editable
    function toggleTableEditMode(isEditable) {
        if (!body) return;
        
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        const dataStartIndex = hasHeader ? 1 : 0;
        const editable = isEditable ? 'true' : 'false';

        const rows = body.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
            const actualRowIndex = dataStartIndex + rowIndex;
            if (actualRowIndex < fileData.length) {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, columnIndex) => {
                   cell.setAttribute('contentEditable', editable);
                });
            }
        });
    }

    function makeTableEditable2() {
        if (!body) return;
        
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        const dataStartIndex = hasHeader ? 1 : 0;
        
        const rows = body.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
            const actualRowIndex = dataStartIndex + rowIndex;
            if (actualRowIndex < fileData.length) {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, columnIndex) => {
                    // Get the raw data from the original fileData array
                    const rawCellData = fileData[actualRowIndex][columnIndex] || '';
                    
                    // Store original cell dimensions and styles
                    const originalWidth = cell.offsetWidth;
                    const originalHeight = cell.offsetHeight;
                    const computedStyle = window.getComputedStyle(cell);
                    
                    // Create textarea for editing with exact same size
                    const textarea = document.createElement('textarea');
                    textarea.className = 'edit-cell';
                    textarea.value = rawCellData;
                    
                    // Set exact dimensions to match the original cell
                    textarea.style.width = originalWidth + 'px';
                    textarea.style.height = originalHeight + 'px';
                    textarea.style.minHeight = originalHeight + 'px';
                    textarea.style.padding = computedStyle.padding;
                    textarea.style.fontSize = computedStyle.fontSize;
                    textarea.style.fontFamily = computedStyle.fontFamily;
                    textarea.style.lineHeight = computedStyle.lineHeight;
                    textarea.style.boxSizing = 'border-box';
                    textarea.style.resize = 'none'; // Prevent manual resizing to maintain layout
                    
                    // Replace cell content with textarea
                    cell.innerHTML = '';
                    cell.appendChild(textarea);
                    
                    // Store the raw data as a data attribute for easy access
                    cell.dataset.originalValue = rawCellData;
                });
            }
        });
    }

    // Collect edited data from table
    function collectEditedData() {
        const editedData = [];
        
        if (!body) return editedData;
        
        const rows = body.querySelectorAll('tr');
        rows.forEach(row => {
            const rowData = [];
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                rowData.push(cell.textContent || '');
            });
            if (rowData.length > 0) {
                editedData.push(rowData);
            }
        });
        
        // Add header if it exists
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        if (hasHeader && fileData.length > 0) {
            editedData.unshift(fileData[0]); // Add original header row
        }
        
        return editedData;
    }

    function collectEditedData2() {
        const editedData = [];
        
        if (!body) return editedData;
        
        const rows = body.querySelectorAll('tr');
        rows.forEach(row => {
            const rowData = [];
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                const textarea = cell.querySelector('textarea.edit-cell');
                if (textarea) {
                    rowData.push(textarea.value || '');
                } else {
                    rowData.push(cell.textContent || '');
                }
            });
            if (rowData.length > 0) {
                editedData.push(rowData);
            }
        });
        
        // Add header if it exists
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        if (hasHeader && fileData.length > 0) {
            editedData.unshift(fileData[0]); // Add original header row
        }
        
        return editedData;
    }
})();
