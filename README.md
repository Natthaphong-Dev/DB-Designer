
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
<img width="1920" height="1200" alt="db-designer " src="https://github.com/user-attachments/assets/3952809d-1183-4928-bff4-eaef733bf9bf" />

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
