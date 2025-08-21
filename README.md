# Simple File Viewer

A Visual Studio Code extension that provides a clear, readable table view for text files with delimiter (such as CSV) with advanced features for data presentation.

## Features

### 🔍 **Clear Data Presentation**
- View files with delimiter (such as CSV) in a clean, formatted table with proper column alignment
- Distinct color coding for each column to improve readability
- Automatic theme integration (supports both light and dark VS Code themes)
- Support for files with or without headers

### 📏 **Flexible Column Management**
- Automatic column width calculation based on content
- Resizable columns by dragging column dividers
- Proper text wrapping to prevent horizontal overflow

### 📋 **Smart Content Handling**
- Truncation of large cell content (>3 lines) with "Show More" links. Modal dialog for viewing full text content
- Robust CSV parsing that handles:
  - Quoted and unquoted fields
  - Commas and newlines within quoted fields
  - Escaped quotes
  - Files with varying column counts per row

### ✂️ **Selection and Copying**
- Single row selection by clicking
- Multi-row selection with `Ctrl+Click`
- Range selection with `Shift+Click`
- Select all rows with `Ctrl+A`
- Copy selected rows to clipboard in original format

## Usage

### Opening Delimited Files

1. **Right-click method**: Right-click any delimited file in the Explorer and select "Open as Table"
2. **Command Palette**: Use `Ctrl+Shift+P` and search for "File Viewer: Open as Table"
3. **Editor title**: Click the "Open as Table" button in the editor title bar when viewing a delimited file

### Keyboard Shortcuts

- `Ctrl+A` - Select all rows
- `Ctrl+C` - Copy selected rows (via Copy button in toolbar)
- `Escape` - Close modal dialog

## Installation

1. Install the extension from the VS Code marketplace
2. Open any delimited text file
3. Choose to open it with "File Viewer"

## Requirements

- Visual Studio Code version 1.103.0 or higher

## Extension Settings

This extension contributes the following commands:

- `fileViewer.openAsTable`: Open the current CSV file as a table view

## Known Issues

- Very large CSV files (>100MB) may experience performance issues
- Virtual scrolling for extremely large datasets is planned for future releases

## Release Notes

### 0.0.1

Initial release of File Viewer:
- Basic table rendering with sticky headers
- Column resizing and text wrapping
- Row selection and copying
- Modal dialogs for large text content
- Theme integration

---

**Enjoy viewing your file data in a beautiful, readable format!** 📊
