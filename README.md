# 🗄️ Web-Based Database Designer (SQL Editor & ER Diagram)

A powerful, entirely client-side web application for designing, visualizing, and managing database schemas. Build Entity-Relationship (ER) diagrams intuitively through a drag-and-drop interface, while seamlessly syncing with a fully-featured SQL editor that supports real-time syntax highlighting and auto-completion.

## ✨ Key Features

- **Interactive Canvas & ER Diagrams**: Drag and drop to create Tables, Views, and Notes. Visually establish relationships (Foreign Keys) using standard Crow's Foot notation.
- **Smart SQL Editor**: Integrated CodeMirror SQL editor with live syntax highlighting and auto-completion.
- **Dialect Support**: Seamlessly switch between **MySQL**, **PostgreSQL**, and **SQLite**. The SQL editor dynamically updates its keyword suggestions based on the selected dialect.
- **Two-Way Sync**: 
  - **Code to Visual**: Write or paste SQL `CREATE TABLE` scripts to automatically generate the ER diagram (`Parse to Canvas`).
  - **Visual to Code**: Visually design your diagram and generate the corresponding SQL DDL script instantly.
- **Customization & Note-Taking**: Color-code your tables for better organization. Use sticky "Notes" with adjustable background colors to document your schema directly on the canvas.
- **Local File System**: Organize your diagrams into folders and files directly in the browser. Everything is stored securely in your browser's `localStorage`.
- **Export Options**: Export your diagrams as high-resolution PNG images, JSON backup files, or raw SQL scripts.

## 🛠️ Technology Stack

- **Frontend**: Pure HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+). No heavy frameworks like React or Vue, ensuring lightning-fast load times.
- **Code Editor**: [CodeMirror](https://codemirror.net/) (via CDN) for rich SQL editing and intelligent auto-completion.
- **Image Export**: [html2canvas](https://html2canvas.hertzen.com/) (via CDN) for capturing the canvas into PNG images.

## 🚀 Getting Started

Since this is a 100% frontend application, no backend server or database installation is required.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/database-designer.git
   ```
2. **Open the project**:
   - Simply double-click `index.html` to open it in your preferred web browser.
   - *Optional:* Use an extension like [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code for a better development experience.

## 🔒 Security & Privacy

Your data belongs to you. This application operates entirely on the client side. All diagrams, folders, and SQL scripts are saved exclusively to your browser's `localStorage`. **No data is ever sent to an external server**, making it completely safe to work with your proprietary database schemas.

## 📂 File Structure

```text
📁 DB_Template/
├── 📄 index.html      # Main application interface
├── 📄 style.css       # Core styling and theme (CSS Variables, Flexbox, Grid)
├── 📁 js/
│   ├── 📄 main.js     # Application boot, dialog handling, and CodeMirror init
│   ├── 📄 canvas.js   # SVG Canvas rendering, Drag & Drop, Zoom/Pan mechanics
│   ├── 📄 sql.js      # SQL Parser (DDL -> JSON) and Exporter (JSON -> DDL)
│   ├── 📄 state.js    # Global Application State management
│   ├── 📄 files.js    # LocalStorage File Explorer mechanics
│   └── 📄 utils.js    # Utility functions, colors, and data types
└── 📄 .gitignore      # Ignored files for clean Git tracking
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/database-designer/issues) if you want to contribute.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
