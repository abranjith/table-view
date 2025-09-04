# Table View

`table-view` is a Visual Studio Code extension that focuses on presenting delimited data in a clear, readable, and user-friendly table format.

**Primary Goal:** The extension's main purpose is **data presentation**. It is a **read-only viewer**. All features should prioritize displaying data effectively without modifying the source file. Editing capabilities are out of scope for the initial version.

---

## Core Viewer Features

### 1. Table Rendering
-   Render the contents of a `.csv` file in a webview as a data grid.
-   The first line of the CSV file should be treated as the header row and be visually distinct (e.g., bold, different background color).
-   The header should remain visible (sticky) when scrolling vertically.

### 2. Column and Cell Styling
-   **Column Alignment:** All columns must be vertically aligned.
-   **Column Width:**
    -   Calculate an initial, reasonable width for each column based on its content to ensure readability.
    -   Allow the user to resize columns by dragging the column dividers in the header.
-   **Text Wrapping:** Wrap text within cells to prevent horizontal overflow.
-   **Large Text Handling:**
    -   For cell content that exceeds 3 lines of text, truncate it and display a "Show More" button or link.
    -   Clicking "Show More" must open a modal dialog to display the full, un-truncated text.
    -   The modal must be closable by clicking a "Close" button or pressing the `Escape` key.
-   **Font Colors:** Use a distinct font color for each column to improve readability. The color scheme should be consistent and respect the user's current VS Code theme (light/dark).

### 3. CSV Parsing
-   The parser must be robust and handle common CSV format variations:
    -   Fields with and without quotes (e.g., `1,"John Doe",New York`).
    -   Fields containing commas and newlines when enclosed in quotes (e.g., `"Doe, John"`).
    -   Properly handle extra whitespace around fields and commas.
    -   Support for escaped quotes within quoted fields (e.g., `"He said, \"Hello\""`).
    -   Ensure that the parser can handle files with varying numbers of columns per row gracefully, filling missing values with empty strings.
---

## User Experience (UX)

### 1. Selection and Copying
-   Allow the user to select one or more rows by clicking on them.
-   Implement standard multi-selection behavior (e.g., using `Ctrl+Click` to select multiple individual rows and `Shift+Click` to select a range).
-   Provide a "Copy" button or context menu option to copy the selected rows to the clipboard in CSV format.

### 2. Performance
-   The viewer should be performant and handle medium-sized CSV files efficiently. Consider virtual scrolling for very large files if performance becomes an issue.

---

## Future Enhancements (Out of Scope for now)
-   Support for alternative delimiters (e.g., TSV, PSV).
-   In-place editing of cell data.
-   Adding or deleting rows and columns.
-   Data sorting and filtering.

---

## Tech Stack
-   **Framework:** Visual Studio Code API, using a Webview for the UI.
-   **UI:** Plain HTML, CSS, and JavaScript. Avoid frameworks like React for simplicity unless necessary.
-   **Styling:** Use VS Code CSS variables to match the editor's theme.