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

    /**
     * Parse CSV content into a 2D array
     * @param content The raw CSV content as string
     * @param delimiter The delimiter to use for parsing (default: ',')
     * @returns Array of arrays representing rows and columns
     */
    static parse(content: string, delimiter: string = ','): string[][] {
        // Process escape sequences in delimiter
        const processedDelimiter = this.processEscapeSequences(delimiter);
        
        const rows: string[][] = [];
        let currentRow: string[] = [];
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
            row.map(field => {
                // Escape fields that contain the delimiter, quotes, or newlines
                if (field.includes(processedDelimiter) || field.includes('"') || field.includes('\n')) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            }).join(processedDelimiter)
        ).join('\n');
    }
}
