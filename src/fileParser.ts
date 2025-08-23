/**
 * Robust CSV parser that handles various CSV format variations
 */
export class FileParser {
    /**
     * Process escape sequences in delimiter string
     * @param delimiter The delimiter string that may contain escape sequences
     * @returns Processed delimiter with escape sequences converted
     */
    private static processEscapeSequences(delimiter: string): string {
        return delimiter
            .replace(/\\t/g, '\t')      // Tab
            .replace(/\\n/g, '\n')      // Newline  
            .replace(/\\r/g, '\r')      // Carriage return
            .replace(/\\b/g, '\b')      // Backspace
            .replace(/\\f/g, '\f')      // Form feed
            .replace(/\\v/g, '\v')      // Vertical tab
            .replace(/\\0/g, '\0')      // Null character
            .replace(/\\\\/g, '\\');    // Backslash (must be last)
    }


    static parse(content: string, delimiter: string = ',', useRawContent: boolean = false): string[][] {
        // Process escape sequences in delimiter
        const processedDelimiter = this.processEscapeSequences(delimiter || ",");

        if(!content){
            return [];
        }

        // Raw text parsing - respect quotes for proper column separation but don't process the content
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField: string = '';
        let inQuotes: Boolean = false;
        let i: number = 0;

        while (i < content.length) {
            const char = content[i];
            const nextChar = content[i + 1];

            if (!inQuotes) {
                if (char === '"') {
                    inQuotes = true;
                    if (useRawContent) currentField += char; // Include quote in raw mode
                } else if (content.substring(i, i + processedDelimiter.length) === processedDelimiter) {
                    currentField = useRawContent ? currentField : currentField.trim();
                    currentRow.push(currentField);
                    currentField = '';
                    i += processedDelimiter.length - 1; // Skip delimiter characters (-1 because loop will increment)
                } else if (char === '\n' || char === '\r') {
                    currentField = useRawContent ? currentField : currentField.trim();
                    currentRow.push(currentField);
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
                    if (useRawContent) currentField += char; // Include quote in raw mode
                    if (nextChar === '"') {
                        // Escaped quote - include both quotes
                        currentField += nextChar;
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
            currentField = useRawContent ? currentField : currentField.trim();
            currentRow.push(currentField); // Don't trim in raw mode
        }
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        return this.normalizeRows(rows);
    }

    /**
     * Normalize rows to ensure all rows have the same number of columns
     * @param rows Array of rows with potentially different column counts
     * @returns Normalized array with consistent column count
     */
    private static normalizeRows(rows: string[][]): string[][] {
        if (rows.length === 0) {
            return [];
        }

        // Find the maximum number of columns
        const maxColumns = Math.max(...rows.map(row => row.length));

        // Fill missing columns with empty strings
        return rows.map(row => {
            while (row.length < maxColumns) {
                row.push('');
            }
            return row;
        });
    }

    /**
     * Convert rows back to CSV format for copying
     * @param rows Array of rows to convert
     * @param delimiter The delimiter to use (default: ',')
     * @returns CSV formatted string
     */
    static stringify(rows: string[][], delimiter: string = ','): string {
        const processedDelimiter = this.processEscapeSequences(delimiter);
        
        return rows.map(row => 
            row.join(processedDelimiter)
        ).join('\n');
    }
}
