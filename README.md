<div align="center">
  
  # 🗄️ DB-Designer
  
  **A Web-Based Database Schema Designer (SQL Editor & ER Diagram)**

  [![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()
  [![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)]()
  [![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)]()
  
  <br>

  <p align="center">
    A powerful, completely client-side web application for designing, visualizing, and managing database schemas intuitively via a drag-and-drop interface, synced with a live SQL editor.
  </p>

</div>

---

## ✨ Key Features

*   🖱️ **Interactive ER Diagrams**: Drag and drop Tables, Views, and Notes onto a dynamic canvas. Visually map Foreign Keys using standard Crow's Foot notation.
*   💻 **Smart SQL Editor**: Powered by CodeMirror, featuring live syntax highlighting and context-aware auto-completion.
*   🔄 **Dialect Support**: Seamlessly toggle between **MySQL**, **PostgreSQL**, and **SQLite**. Keyword suggestions automatically adapt to your chosen dialect.
*   ⚡ **Real-Time Two-Way Sync**:
    *   **Visual to Code**: Map your schemas visually, and the DDL scripts generate instantly.
    *   **Code to Visual**: Paste your `CREATE TABLE` scripts into the editor, click "Parse to Canvas", and watch your ER Diagram build itself.
*   📝 **Customization & Documentation**: Color-code tables for visual grouping. Use floating "Notes" with adjustable backgrounds to document logic directly on the canvas.
*   💾 **Local Workspace**: Create folders and organize diagram files right in the browser. 100% powered by `localStorage`.
*   📤 **Export Engine**: Export schemas as high-res PNG images, JSON backup files, or raw `.sql` files.

---

## 🛠️ Technology Stack

Built with speed and simplicity in mind, requiring absolutely zero backend setup:
- **Frontend Core**: Pure HTML5, CSS3, Vanilla JavaScript (ES6+). Zero bloat.
- **Code Editor**: [CodeMirror](https://codemirror.net/) via CDN for advanced SQL editing capabilities.
- **Rendering**: [html2canvas](https://html2canvas.hertzen.com/) via CDN for client-side image generation.

---

## 🚀 Getting Started

Since this is a frontend-only tool, installation is incredibly simple.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Natthaphong-Dev/DB-Designer.git
   ```
2. **Launch the app**:
   - Double-click `index.html` to open it in your browser directly.
   - *Alternatively*, run it through [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code for a better developer experience.

---

## 📖 How to Use

### 1. 🗂️ File Management (Left Panel)
*   **New Folder/File**: Click the 📁 or 📄 icons to organize your diagrams.
*   Everything is saved automatically to your browser's `localStorage`.
*   **Export/Import**: Right-click on any file in the tree to Export it as JSON, PNG, or SQL. You can also Import `.dbdesign` JSON files back into the editor.

### 2. 🗃️ Designing Tables (Canvas & Right Panel)
*   **Drag & Drop**: Grab a **Table** shape from the "Toolbox" on the right and drop it onto the canvas.
*   **Edit Columns**: Click the table on the canvas. The Properties panel will appear on the right. You can rename the table, pick a header color, and click **+ Add Column** to define its schema (Primary Key, Foreign Key, Type, etc.).
*   **Resize**: Tables and Notes can be resized by dragging their bottom-right corners.

### 3. 👁️ Creating Views
*   Views are virtual tables used to represent SQL Queries (e.g., `SELECT ... JOIN ...`).
*   Drag a **View** shape onto the canvas. While they do not have specific columns in the UI, you can visually connect them to the tables they depend on to map out data flow.
*   *Alternatively*, type a standard `CREATE VIEW view_name AS ...` in the SQL editor and click **Parse to Canvas** to instantly generate the View shape!

### 4. 📝 Adding Notes
*   Drag a **Note** from the Toolbox to document your schema. 
*   Notes are highly customizable. Click on the text area inside the note to type directly on the canvas. 
*   Change the background color of the note in the Properties panel, and the selection border will smartly adapt to match your color.

### 5. 🔗 Establishing Relationships
*   Click the **Connect Tables** button in the right panel.
*   Click the **Source Table** (the one with the Foreign Key), then click the **Target Table** (the one with the Primary Key).
*   A modal will pop up allowing you to select the exact columns and the type of relationship (e.g., 1:N, 1:1, N:M).

### 6. 💻 SQL Editor Sync
*   **Parse to Canvas**: Paste your `CREATE TABLE` and `CREATE VIEW` queries into the left-side SQL Editor, and click the parse button to instantly draw the ER diagram.
*   **Generate SQL**: After visually designing your diagram, click "Generate SQL" to write the DDL scripts into the editor, ready to be executed in your actual database.

---

## 🔒 Security & Privacy

**Your schemas are yours.** This application runs 100% locally on your machine. All files, queries, and diagrams are stored solely in your browser's `localStorage`. No data is ever transmitted to an external server.

---

## 📂 File Structure

```text
📁 DB-Designer/
├── 📄 index.html      # Main UI entry point
├── 📄 style.css       # Core styling & UI Theme
├── 📁 js/
│   ├── 📄 main.js     # Boot, event bindings, CodeMirror configuration
│   ├── 📄 canvas.js   # SVG Canvas rendering, pan/zoom, drag & drop
│   ├── 📄 sql.js      # Parser (DDL -> JSON) & Exporter (JSON -> DDL)
│   ├── 📄 state.js    # Global State Management
│   ├── 📄 files.js    # File Explorer & LocalStorage logic
│   └── 📄 utils.js    # Shared utilities and helpers
└── 📄 .gitignore      
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Check the [issues page](https://github.com/Natthaphong-Dev/DB-Designer/issues) to start contributing.

## 📝 License

Distributed under the [MIT License](LICENSE).