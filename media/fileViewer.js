// @ts-check

(function() {
    // @ts-ignore - acquireVsCodeApi is provided by VS Code webview context
    const vscode = acquireVsCodeApi();
    
    let csvData = [];
    let selectedRows = new Set();
    let rawTextData = '';
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let currentColumn = null;

    // DOM elements
    const table = document.getElementById('csvTable');
    const header = document.getElementById('csvHeader');
    const body = document.getElementById('csvBody');
    const copyBtn = document.getElementById('copyBtn');
    const selectionInfo = document.getElementById('selectionInfo');
    const modal = document.getElementById('textModal');
    const modalText = document.getElementById('modalText');
    const closeModal = document.getElementById('closeModal');
    const rawTextCheckbox = document.getElementById('rawTextCheckbox');
    const hasHeaderCheckbox = document.getElementById('hasHeaderCheckbox');
    const fitToScreenCheckbox = document.getElementById('fitToScreenCheckbox');
    const delimiterInput = document.getElementById('delimiterInput');

    // Event listeners
    if (copyBtn) {
        copyBtn.addEventListener('click', copySelectedRows);
    }
    if (closeModal) {
        closeModal.addEventListener('click', hideModal);
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
            hideModal();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.style.display === 'block') {
            hideModal();
        }
    });

    // Column resizing events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // CSV Parser function
    function parseCSV(content, delimiter = ',', rawText = false) {
        // Process escape sequences in delimiter
        const processedDelimiter = delimiter
            .replace(/\\t/g, '\t')      // Tab
            .replace(/\\n/g, '\n')      // Newline  
            .replace(/\\r/g, '\r')      // Carriage return
            .replace(/\\b/g, '\b')      // Backspace
            .replace(/\\f/g, '\f')      // Form feed
            .replace(/\\v/g, '\v')      // Vertical tab
            .replace(/\\0/g, '\0')      // Null character
            .replace(/\\\\/g, '\\');    // Backslash (must be last)

        if (rawText) {
            // Raw text parsing - respect quotes for proper column separation but don't process the content
            const rows = [];
            let currentRow = [];
            let currentField = '';
            let inQuotes = false;
            let i = 0;

            while (i < content.length) {
                const char = content[i];
                const nextChar = content[i + 1];

                if (!inQuotes) {
                    if (char === '"') {
                        inQuotes = true;
                        currentField += char; // Include quote in raw mode
                    } else if (content.substring(i, i + processedDelimiter.length) === processedDelimiter) {
                        currentRow.push(currentField); // Don't trim in raw mode
                        currentField = '';
                        i += processedDelimiter.length - 1; // Skip delimiter characters (-1 because loop will increment)
                    } else if (char === '\n' || char === '\r') {
                        currentRow.push(currentField); // Don't trim in raw mode
                        if (currentRow.length > 0 || currentField.length > 0) {
                            rows.push(currentRow);
                        }
                        currentRow = [];
                        currentField = '';
                        
                        // Skip \r\n combination
                        if (char === '\r' && nextChar === '\n') {
                            i++;
                        }
                    } else {
                        currentField += char;
                    }
                } else {
                    // Inside quotes - include everything as-is
                    if (char === '"') {
                        currentField += char; // Include quote in raw mode
                        if (nextChar === '"') {
                            // Escaped quote - include both quotes
                            currentField += '"';
                            i++; // Skip next quote
                        } else {
                            // End of quoted field
                            inQuotes = false;
                        }
                    } else {
                        currentField += char;
                    }
                }
                i++;
            }

            // Handle last field and row
            if (currentField.length > 0 || currentRow.length > 0) {
                currentRow.push(currentField); // Don't trim in raw mode
            }
            if (currentRow.length > 0) {
                rows.push(currentRow);
            }

            return rows;
        }
            
        // Standard CSV parsing with quote handling
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;
        let i = 0;

        while (i < content.length) {
            const char = content[i];
            const nextChar = content[i + 1];

            if (!inQuotes) {
                if (char === '"') {
                    inQuotes = true;
                } else if (content.substring(i, i + processedDelimiter.length) === processedDelimiter) {
                    currentRow.push(currentField.trim());
                    currentField = '';
                    i += processedDelimiter.length - 1; // Skip delimiter characters (-1 because loop will increment)
                } else if (char === '\n' || char === '\r') {
                    currentRow.push(currentField.trim());
                    if (currentRow.length > 0 || currentField.length > 0) {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    currentField = '';
                    
                    // Skip \r\n combination
                    if (char === '\r' && nextChar === '\n') {
                        i++;
                    }
                } else {
                    currentField += char;
                }
            } else {
                // Inside quotes
                if (char === '"') {
                    if (nextChar === '"') {
                        // Escaped quote
                        currentField += '"';
                        i++; // Skip next quote
                    } else {
                        // End of quoted field
                        inQuotes = false;
                    }
                } else {
                    currentField += char;
                }
            }
            i++;
        }

        // Handle last field and row
        if (currentField.length > 0 || currentRow.length > 0) {
            currentRow.push(currentField.trim());
        }
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        return rows;
    }

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'update':
                rawTextData = message.rawText;
                parseAndRenderTable();
                break;
        }
    });

    function parseAndRenderTable() {
        if (!rawTextData) {
            csvData = [];
        } else {
            const delimiter = delimiterInput ? delimiterInput.value || ',' : ',';
            const rawText = rawTextCheckbox && rawTextCheckbox.checked;
            csvData = parseCSV(rawTextData, delimiter, rawText);
        }
        renderTable();
    }

    // Handle delimiter change
    function handleDelimiterChange() {
        if (rawTextData) {
            parseAndRenderTable();
        }
    }

    // Handle raw text toggle
    function handleRawTextToggle() {
        if (rawTextData) {
            parseAndRenderTable();
        }
    }

    function renderTable() {
        if (!csvData || csvData.length === 0) {
            table.innerHTML = '<tbody><tr><td>No data to display</td></tr></tbody>';
            return;
        }

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
        const hasHeader = hasHeaderCheckbox && hasHeaderCheckbox.checked;
        
        if (hasHeader) {
            // Use first row as headers
            csvData[0].forEach((headerText, index) => {
                const th = document.createElement('th');
                th.textContent = headerText || `Column ${index + 1}`;
                th.className = `column-${index % 10}`;
                
                // Use appropriate width calculation based on fit-to-screen setting
                const width = fitToScreenCheckbox && fitToScreenCheckbox.checked ? 
                    calculateFitToScreenWidth(index) : 
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
            const columnCount = csvData[0] ? csvData[0].length : 0;
            for (let index = 0; index < columnCount; index++) {
                const th = document.createElement('th');
                th.textContent = (index + 1).toString();
                th.className = `column-${index % 10}`;
                
                // Use appropriate width calculation based on fit-to-screen setting
                const width = fitToScreenCheckbox && fitToScreenCheckbox.checked ? 
                    calculateFitToScreenWidth(index) : 
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
        
        for (let i = dataStartIndex; i < csvData.length; i++) {
            const row = document.createElement('tr');
            row.dataset.rowIndex = i.toString();
            
            csvData[i].forEach((cellText, columnIndex) => {
                const td = document.createElement('td');
                td.className = `column-${columnIndex % 10}`;
                
                const cellContent = createCellContent(cellText, i, columnIndex);
                td.appendChild(cellContent);
                
                row.appendChild(td);
            });
            
            // Add row selection event
            row.addEventListener('click', (e) => handleRowSelection(e, i));
            
            body.appendChild(row);
        }
    }

    function calculateInitialColumnWidth(columnIndex) {
        if (!csvData || csvData.length === 0) return 120;
        
        let maxLength = 0;
        for (const row of csvData) {
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

    function calculateFitToScreenWidth(columnIndex) {
        if (!csvData || csvData.length === 0) return 120;
        
        const tableContainer = document.getElementById('tableContainer');
        const containerWidth = tableContainer ? tableContainer.clientWidth - 40 : 800; // Leave padding
        const columnCount = csvData[0].length;
        
        // Distribute width evenly across all columns
        return Math.max(80, Math.floor(containerWidth / columnCount));
    }

    function createCellContent(text, rowIndex, columnIndex) {
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
                showModal(text);
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
        if (count === 0) {
            copyBtn.disabled = true;
            selectionInfo.textContent = 'No rows selected';
        } else {
            copyBtn.disabled = false;
            selectionInfo.textContent = `${count} row${count > 1 ? 's' : ''} selected`;
        }
    }

    function copySelectedRows() {
        if (selectedRows.size === 0) return;
        
        const rowsToCopy = [];
        
        // Add header row
        rowsToCopy.push(csvData[0]);
        
        // Add selected data rows
        const sortedIndices = Array.from(selectedRows).sort((a, b) => a - b);
        sortedIndices.forEach(rowIndex => {
            rowsToCopy.push(csvData[rowIndex]);
        });
        
        // Get current delimiter
        const currentDelimiter = delimiterInput ? delimiterInput.value || ',' : ',';
        
        // Send message to extension to copy to clipboard
        vscode.postMessage({
            type: 'copy',
            rows: rowsToCopy,
            delimiter: currentDelimiter
        });
    }

    function showModal(text) {
        modalText.textContent = text;
        modal.style.display = 'block';
    }

    function hideModal() {
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
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && modal.style.display !== 'block') {
            e.preventDefault();
            
            // Select all data rows (excluding header)
            selectedRows.clear();
            for (let i = 1; i < csvData.length; i++) {
                selectedRows.add(i);
            }
            
            updateRowHighlights();
            updateSelectionUI();
        }
    });

    // Handle has header toggle
    function handleHasHeaderToggle() {
        if (!csvData || csvData.length === 0) return;
        
        // Re-render the entire table since header structure changes
        renderTable();
    }

    // Handle fit to screen toggle
    function handleFitToScreenToggle() {
        if (!csvData || csvData.length === 0) return;
        
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
                    calculateFitToScreenWidth(index) : 
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
})();
