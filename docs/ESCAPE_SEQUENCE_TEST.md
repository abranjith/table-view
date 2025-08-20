# Escape Sequence Test Results

## Testing Instructions:
1. Open `tab-delimited-test.csv` in VS Code
2. Right-click and select "Open with CSV Table Viewer"  
3. Change the delimiter field from "," to "\t"
4. The table should re-render with proper column separation

## Expected Results:
- With delimiter "," - All content appears in first column (incorrect)
- With delimiter "\t" - Content properly separated into 4 columns (correct)

## Supported Escape Sequences:
- `\t` - Tab character
- `\n` - Newline
- `\r` - Carriage return  
- `\b` - Backspace
- `\f` - Form feed
- `\v` - Vertical tab
- `\0` - Null character
- `\\` - Literal backslash

## Test Files:
- `tab-delimited-test.csv` - Tab-separated values (use `\t` delimiter)
- `pipe-delimited-test.csv` - Pipe-separated values (use `|` delimiter)
- `double-colon-test.csv` - Double colon separated (use `::` delimiter)
