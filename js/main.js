/* ════════════════════════════════════════════════════════════
   js/main.js — App Boot, Toolbar, Dialogs, Properties, Editor
   ════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ════════════════════════════════════════════════════════════
     APP — Central Application Controller
  ════════════════════════════════════════════════════════════ */
  const App = {

    _editor: null,  // CodeMirror instance
    _modalResolve: null,

    /* ════ INIT ════ */
    init() {
      AppState.init();
      FileManager.load();

      // Init Canvas
      Canvas.init();
      Canvas.resetView();

      // Init CodeMirror
      this._initEditor();

      // Init toolbar buttons
      this._initToolbar();

      // Init toolbox buttons
      this._initToolbox();

      // Init File Explorer
      this._renderFileTree();

      // Init modal
      this._initModal();

      // Init panel resize & toggle
      this._initPanelResize();
      this._initPanelToggles();

      // Close context menu on click
      document.addEventListener('click', () => this.hideContextMenu());

      // Global keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            this.saveCurrentFile();
          } else if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            this.newDiagram();
          }
        }
      });

      // Drag over canvas (shapes)
      document.querySelectorAll('.shape-card[draggable]').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', card.dataset.shape);
          e.dataTransfer.effectAllowed = 'copy';
        });
      });

      // First render
      Canvas.renderAll();
      this.renderProperties();

      // Auto-save every 3s if dirty
      setInterval(() => {
        if (AppState.isDirty && AppState.currentFile) {
          FileManager.saveCurrentFile(AppState.serialize());
          AppState.isDirty = false;
        }
      }, 3000);

      console.log('✅ DB Designer initialized');
    },

    /* ════ CODE MIRROR ════ */
    _initEditor() {
      const ta = document.getElementById('sql-editor');
      if (!ta || !window.CodeMirror) return;
      
      const dialectMap = {
        mysql: 'text/x-mysql',
        postgresql: 'text/x-pgsql',
        sqlite: 'text/x-sqlite'
      };

      this._editor = CodeMirror.fromTextArea(ta, {
        mode: dialectMap[document.getElementById('sql-dialect')?.value] || 'text/x-mysql',
        theme: 'dracula',
        lineNumbers: true,
        indentWithTabs: false,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: false,
        autofocus: false,
        extraKeys: {
          'Tab': 'indentMore',
          'Shift-Tab': 'indentLess',
          'Ctrl-Space': 'autocomplete'
        }
      });
      
      const dialectSel = document.getElementById('sql-dialect');
      if (dialectSel) {
        dialectSel.addEventListener('change', (e) => {
          this._editor.setOption('mode', dialectMap[e.target.value] || 'text/x-mysql');
        });
      }

      // Custom Hint with Snippets
      const snippets = [
        { text: "CREATE TABLE table_name (\n  id INT NOT NULL AUTO_INCREMENT,\n  name VARCHAR(100) NOT NULL,\n  PRIMARY KEY (id)\n);", displayText: "CREATE TABLE (Snippet)" },
        { text: "FOREIGN KEY (col_name) REFERENCES table_name(id)", displayText: "FOREIGN KEY (Snippet)" },
        { text: "PRIMARY KEY (id)", displayText: "PRIMARY KEY (Snippet)" },
        { text: "VARCHAR(255) NOT NULL", displayText: "VARCHAR (Snippet)" },
        { text: "INT NOT NULL AUTO_INCREMENT", displayText: "AUTO_INCREMENT (Snippet)" }
      ];

      const origSqlHint = CodeMirror.hint.sql;
      CodeMirror.hint.customSql = function(cm, options) {
        const cur = cm.getCursor();
        const token = cm.getTokenAt(cur);
        const searchWord = token.string.toLowerCase();
        
        let from = { line: cur.line, ch: token.start };
        let to = { line: cur.line, ch: token.end };

        // If the token is empty or whitespace, adjust 'from' and 'to'
        if (!/\S/.test(token.string)) {
          from = cur;
          to = cur;
        }

        const origResult = origSqlHint ? origSqlHint(cm, options) : null;
        let list = origResult ? origResult.list : [];

        // Dynamically get keywords from the current CodeMirror mode (MySQL, Postgres, SQLite)
        const modeName = cm.getOption("mode");
        const modeInfo = CodeMirror.resolveMode(modeName);
        let sqlKeywords = [];
        if (modeInfo) {
          if (modeInfo.keywords) sqlKeywords.push(...Object.keys(modeInfo.keywords));
          if (modeInfo.builtin) sqlKeywords.push(...Object.keys(modeInfo.builtin));
          if (modeInfo.atoms) sqlKeywords.push(...Object.keys(modeInfo.atoms));
        }
        // Fallback to basic keywords if none found
        if (sqlKeywords.length === 0) {
          sqlKeywords = ["CREATE", "TABLE", "SELECT", "INSERT", "UPDATE", "DELETE", "FROM", "WHERE", "PRIMARY", "FOREIGN", "KEY", "REFERENCES", "INT", "VARCHAR", "NOT", "NULL", "AUTO_INCREMENT"];
        }

        // Add matching keywords manually
        if (searchWord && /\S/.test(searchWord)) {
          const matchedKeywords = sqlKeywords
            .filter(kw => kw.toLowerCase().startsWith(searchWord))
            .map(kw => ({ text: kw, displayText: kw }));
            
          // Avoid duplicates
          matchedKeywords.forEach(mk => {
            if (!list.some(item => (item.text || item) === mk.text)) {
              list.push(mk);
            }
          });
        }

        // Add matching snippets
        const matchSnippets = snippets.filter(s => s.displayText.toLowerCase().includes(searchWord) || s.text.toLowerCase().includes(searchWord));
        if (matchSnippets.length > 0) {
          list = [...matchSnippets, ...list];
        }

        return { list, from, to };
      };

      this._editor.setOption("hintOptions", {
        hint: CodeMirror.hint.customSql,
        completeSingle: false
      });

      // Auto-trigger hint on typing letters
      this._editor.on("keyup", (cm, event) => {
        if (!cm.state.completionActive && 
            event.keyCode >= 65 && event.keyCode <= 90) { // A-Z
          CodeMirror.commands.autocomplete(cm, null, {completeSingle: false});
        }
      });

      this._editor.setSize('100%', '100%');

      // Set example SQL
      const example = `-- E-Commerce Database Schema

-- =========================
-- Categories
-- =========================
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================
-- Users
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================
-- Products
-- =========================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- =========================
-- Orders
-- =========================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    order_status ENUM(
        'pending',
        'paid',
        'shipped',
        'delivered',
        'cancelled'
    ) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- =========================
-- Order Items
-- =========================
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (
        quantity * unit_price
    ) STORED,

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);`;
      this._editor.setValue(example);
    },

    getSql() {
      return this._editor ? this._editor.getValue() : '';
    },

    setSql(sql) {
      if (this._editor) this._editor.setValue(sql || '');
    },

    /* ════ TOOLBAR ════ */
    _initToolbar() {
      // Toolbar buttons
      this._on('btn-new', 'click', () => this.newDiagram());
      this._on('btn-save', 'click', () => this.saveCurrentFile());
      this._on('btn-undo', 'click', () => { if (AppState.undo()) { Canvas.renderAll(); this.renderProperties(); this.toast('Undo', 'info'); } });
      this._on('btn-redo', 'click', () => { if (AppState.redo()) { Canvas.renderAll(); this.renderProperties(); this.toast('Redo', 'info'); } });
      this._on('btn-import-sql', 'click', () => this.showImportSqlDialog());
      this._on('btn-export-sql', 'click', () => this.exportSQL());
      this._on('btn-export-png', 'click', () => this.exportPNG());
      this._on('btn-export-json', 'click', () => this.exportJSON());
      this._on('btn-zoom-in', 'click', () => { Canvas.zoomIn(); });
      this._on('btn-zoom-out', 'click', () => { Canvas.zoomOut(); });
      this._on('btn-zoom-fit', 'click', () => Canvas.fitView());

      this._on('btn-trace-fk', 'click', (e) => {
        AppState.traceFkMode = !AppState.traceFkMode;
        const btn = document.getElementById('btn-trace-fk');
        if (btn) btn.classList.toggle('active', AppState.traceFkMode);
        this.toast(`Trace FK Mode: ${AppState.traceFkMode ? 'ON' : 'OFF'}`, 'info');
      });

      // Canvas zoom controls
      this._on('cc-zoom-in', 'click', () => Canvas.zoomIn());
      this._on('cc-zoom-out', 'click', () => Canvas.zoomOut());
      this._on('cc-fit', 'click', () => Canvas.fitView());
      this._on('cc-reset', 'click', () => Canvas.resetView());

      // SQL editor actions
      this._on('btn-clear-sql', 'click', () => this.setSql(''));
      this._on('btn-parse-sql', 'click', () => this.parseSqlToCanvas());
      this._on('btn-gen-sql', 'click', () => this.generateSQL());

      // File explorer buttons
      this._on('btn-new-folder', 'click', () => this.newFolder());
      this._on('btn-new-file', 'click', () => this.newFile());

      // Panel toggle buttons (in toolbar)
      this._on('btn-toggle-sql', 'click', () => this.togglePanel('left'));
      this._on('btn-toggle-shapes', 'click', () => this.togglePanel('right'));
    },

    _on(id, ev, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    },

    /* ════ TOOLBOX ════ */
    _initToolbox() {
      // Relationship type buttons
      document.querySelectorAll('.rel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.rel-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          AppState.relType = btn.dataset.rel;
        });
      });

      // Connect mode button
      this._on('btn-connect-mode', 'click', () => {
        if (AppState.connectMode) {
          this.cancelConnectMode();
        } else {
          this.enterConnectMode();
        }
      });
    },

    /* ════ CONNECT MODE ════ */
    enterConnectMode() {
      AppState.connectMode = true;
      AppState.connectStep = 1;
      AppState.connectSource = null;
      document.getElementById('canvas-wrap').classList.add('connect-mode');
      document.getElementById('connect-banner').classList.remove('hidden');
      document.getElementById('connect-step-text').textContent = 'Click source table…';
      document.getElementById('btn-connect-mode').classList.add('active');
      document.getElementById('btn-connect-mode').textContent = '✗ Cancel Connect';
    },

    cancelConnectMode() {
      AppState.connectMode = false;
      AppState.connectStep = 0;
      AppState.connectSource = null;
      document.getElementById('canvas-wrap').classList.remove('connect-mode', 'connect-ready');
      document.getElementById('connect-banner').classList.add('hidden');
      document.getElementById('btn-connect-mode').classList.remove('active');
      document.getElementById('btn-connect-mode').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="3" cy="7" r="2" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="11" cy="7" r="2" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5 7h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        Connect Tables`;
      Canvas.clearPreview();
      document.getElementById('btn-cancel-connect')?.addEventListener('click', () => this.cancelConnectMode());
    },

    /* ════ DIALOGS ════ */

    /* ── Create Table ── */
    showCreateTableDialog(shapeType, x, y) {
      const colors = Utils.tableColors;
      let selectedColor = Utils.randomColor();

      this.openModal('New ' + (shapeType === 'view' ? 'View' : 'Table'), `
        <div class="form-group">
          <label class="form-label">Table Name</label>
          <input class="form-input" id="dlg-table-name" placeholder="e.g. users, products" autofocus/>
        </div>
        <div class="form-group">
          <label class="form-label">Header Color</label>
          <div class="color-full-wrap">
            <input type="color" id="dlg-color-native" value="${selectedColor}" title="Pick any color"/>
            <div class="color-presets-row" id="dlg-color-row">
              ${colors.map(c => `<div class="cp-swatch ${c === selectedColor ? 'active' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}
            </div>
          </div>
        </div>`,
        () => {
          const name = document.getElementById('dlg-table-name')?.value.trim();
          if (!name) { this.toast('Table name required', 'error'); return false; }
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) { this.toast('Invalid name: use letters, numbers, _', 'error'); return false; }
          const table = AppState.newTable({ name, type: shapeType || 'table', x, y, color: selectedColor });
          AppState.addTable(table);
          Canvas.renderAll();
          AppState.select('table', table.id);
          Canvas.renderAll();
          this.renderProperties();
          this.toast(`Table "${name}" created`, 'success');
          return true;
        }
      );

      // Bind color controls after modal opens
      setTimeout(() => {
        const native = document.getElementById('dlg-color-native');
        if (native) {
          native.addEventListener('input', (e) => {
            selectedColor = e.target.value;
            document.querySelectorAll('#dlg-color-row .cp-swatch').forEach(s => s.classList.remove('active'));
          });
        }
        document.querySelectorAll('#dlg-color-row .cp-swatch').forEach(sw => {
          sw.addEventListener('click', () => {
            document.querySelectorAll('#dlg-color-row .cp-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            selectedColor = sw.dataset.color;
            const nat = document.getElementById('dlg-color-native');
            if (nat) nat.value = selectedColor;
          });
        });
        document.getElementById('dlg-table-name')?.focus();
      }, 50);
    },

    /* ── Rename Table ── */
    showRenameTableDialog(tableId, currentName) {
      this.openModal('Rename Table', `
        <div class="form-group">
          <label class="form-label">New Name</label>
          <input class="form-input" id="dlg-rename" value="${Utils.esc(currentName)}" />
        </div>`,
        () => {
          const name = document.getElementById('dlg-rename')?.value.trim();
          if (!name) return false;
          AppState.updateTable(tableId, { name });
          Canvas.renderAll();
          this.renderProperties();
          return true;
        }
      );
      setTimeout(() => {
        const inp = document.getElementById('dlg-rename');
        if (inp) { inp.focus(); inp.select(); }
      }, 50);
    },

    /* ── Add Column ── */
    showAddColumnDialog(tableId) {
      this.openModal('Add Column', this._colFormHTML(), () => {
        const col = this._readColForm();
        if (!col.name) { this.toast('Column name required', 'error'); return false; }
        AppState.addColumn(tableId, col);
        Canvas.renderAll();
        this.renderProperties();
        return true;
      });
      setTimeout(() => {
        document.getElementById('dlg-col-name')?.focus();
        this._bindColFormEvents();
      }, 50);
    },

    /* ── Edit Column ── */
    showEditColumnDialog(tableId, colId) {
      const table = AppState.getTable(tableId);
      if (!table) return;
      const col = table.columns.find(c => c.id === colId);
      if (!col) return;

      this.openModal('Edit Column', this._colFormHTML(col), () => {
        const updates = this._readColForm();
        if (!updates.name) { this.toast('Column name required', 'error'); return false; }
        AppState.updateColumn(tableId, colId, updates);
        Canvas.renderAll();
        this.renderProperties();
        return true;
      });
      setTimeout(() => {
        const inp = document.getElementById('dlg-col-name');
        if (inp) { inp.focus(); inp.select(); }
        this._bindColFormEvents();
      }, 50);
    },

    _bindColFormEvents() {
      const typeSel = document.getElementById('dlg-col-type');
      const customWrap = document.getElementById('dlg-custom-type-wrap');
      const customInp = document.getElementById('dlg-custom-type');
      if (typeSel && customWrap) {
        typeSel.addEventListener('change', () => {
          if (typeSel.value === '__custom__') {
            customWrap.style.display = 'block';
            if (customInp) customInp.focus();
          } else {
            customWrap.style.display = 'none';
          }
        });
      }
    },

    _colFormHTML(col = {}) {
      const types = Utils.sqlTypes;
      
      let baseType = col.type || 'VARCHAR';
      let typeLen = col.type === undefined ? '255' : '';
      
      const match = (col.type || '').match(/^([A-Za-z_]+)\((.*)\)$/);
      if (match) {
        baseType = match[1].toUpperCase();
        typeLen = match[2];
      }

      const isCustom = !types.includes(baseType.toUpperCase());

      const constraintToggle = (id, label, active) =>
        `<label class="constraint-toggle ${active ? 'active' : ''}" id="ct-${id}">
           <input type="checkbox" id="chk-${id}" ${active ? 'checked' : ''}/> ${label}
         </label>`;

      return `
        <div class="form-group">
          <label class="form-label">Column Name</label>
          <input class="form-input" id="dlg-col-name" value="${Utils.esc(col.name || '')}" placeholder="column_name"/>
        </div>
        <div style="display:flex; gap:8px;">
          <div class="form-group" style="flex:2">
            <label class="form-label">Data Type</label>
            <select class="form-select" id="dlg-col-type">
              ${types.map(t => `<option value="${t}" ${t.toUpperCase() === baseType.toUpperCase() ? 'selected' : ''}>${t}</option>`).join('')}
              <option value="__custom__" ${isCustom ? 'selected' : ''}>Custom…</option>
            </select>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Length/Values</label>
            <input class="form-input" id="dlg-col-len" value="${Utils.esc(typeLen)}" placeholder="e.g. 255"/>
          </div>
        </div>
        <div class="form-group" id="dlg-custom-type-wrap" style="display:${isCustom ? 'block' : 'none'}">
          <label class="form-label">Custom Type</label>
          <input class="form-input" id="dlg-custom-type" value="${isCustom ? Utils.esc(baseType) : ''}" placeholder="e.g. ENUM"/>
        </div>
        <div class="form-group">
          <label class="form-label">Default Value (optional)</label>
          <input class="form-input" id="dlg-col-default" value="${Utils.esc(col.defaultVal || '')}" placeholder="NULL"/>
        </div>
        <div class="form-group">
          <label class="form-label">Constraints</label>
          <div class="constraint-row">
            ${constraintToggle('pk', 'PK', col.pk)}
            ${constraintToggle('fk', 'FK', col.fk)}
            ${constraintToggle('nn', 'NN', col.nn)}
            ${constraintToggle('uq', 'UQ', col.uq)}
            ${constraintToggle('ai', 'AI', col.ai)}
          </div>
        </div>`;
    },

    _readColForm() {
      const typeEl = document.getElementById('dlg-col-type');
      let type = typeEl?.value || 'VARCHAR';
      if (type === '__custom__') {
        type = document.getElementById('dlg-custom-type')?.value.trim() || 'VARCHAR';
      }
      
      const len = document.getElementById('dlg-col-len')?.value.trim();
      if (len) {
        type = `${type}(${len})`;
      }

      const getChk = id => !!document.getElementById('chk-' + id)?.checked;

      return {
        name: document.getElementById('dlg-col-name')?.value.trim() || '',
        type: type,
        defaultVal: document.getElementById('dlg-col-default')?.value.trim() || null,
        pk: getChk('pk'),
        fk: getChk('fk'),
        nn: getChk('nn') || getChk('pk'),
        uq: getChk('uq'),
        ai: getChk('ai')
      };
    },

    /* ── Connection Dialog ── */
    showConnectionDialog(fromId, toId, fromTable, toTable) {
      // Build toCols — include auto-generated FK col name suggestion
      let singularFrom = fromTable.name;
      if (singularFrom.endsWith('ies')) singularFrom = singularFrom.slice(0, -3) + 'y';
      else if (singularFrom.endsWith('es')) singularFrom = singularFrom.slice(0, -2);
      else if (singularFrom.endsWith('s')) singularFrom = singularFrom.slice(0, -1);

      const fkSuggest = `${singularFrom}_id`;
      const toHasFkCol = toTable.columns.some(c => c.name === fkSuggest);

      const fromCols = fromTable.columns.map(c =>
        `<option value="${c.name}">${c.name} (${c.type})</option>`).join('');
      const toCols = toTable.columns.map(c =>
        `<option value="${c.name}">${c.name} (${c.type})</option>`).join('');

      this.openModal('Create Relationship', `
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:14px;">
          <div style="text-align:center;padding:10px;background:var(--c-surface);border-radius:var(--r);border:1px solid var(--c-border);">
            <div style="font-size:16px">📋</div>
            <div style="font-weight:600;margin-top:4px;font-size:12px">${Utils.esc(fromTable.name)}</div>
          </div>
          <div style="font-size:18px;color:var(--c-accent)">→</div>
          <div style="text-align:center;padding:10px;background:var(--c-surface);border-radius:var(--r);border:1px solid var(--c-border);">
            <div style="font-size:16px">📋</div>
            <div style="font-weight:600;margin-top:4px;font-size:12px">${Utils.esc(toTable.name)}</div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Relationship Type</label>
          <select class="form-select" id="dlg-rel-type">
            <option value="one-to-many" ${AppState.relType === 'one-to-many' ? 'selected' : ''}>One to Many (1:N)</option>
            <option value="one-to-one"  ${AppState.relType === 'one-to-one'  ? 'selected' : ''}>One to One (1:1)</option>
            <option value="many-to-many" ${AppState.relType === 'many-to-many' ? 'selected' : ''}>Many to Many (N:M)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">From Column (${Utils.esc(fromTable.name)})</label>
          <select class="form-select" id="dlg-from-col">${fromCols}</select>
        </div>
        <div class="form-group">
          <label class="form-label">To Column (${Utils.esc(toTable.name)})</label>
          <select class="form-select" id="dlg-to-col">${toCols}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Label / FK Name (optional)</label>
          <input class="form-input" id="dlg-conn-label" placeholder="fk_${fromTable.name}_${toTable.name}"/>
        </div>
        ${!toHasFkCol ? `
        <div style="padding:8px 10px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:var(--r);font-size:12px;color:var(--c-accent2);">
          ✨ Column <strong>${Utils.esc(fkSuggest)}</strong> will be auto-added to <strong>${Utils.esc(toTable.name)}</strong> as FK
        </div>` : ''}`,
        () => {
          const relType = document.getElementById('dlg-rel-type')?.value || 'one-to-many';
          const fromCol = document.getElementById('dlg-from-col')?.value || null;
          let toCol   = document.getElementById('dlg-to-col')?.value   || null;
          const label   = document.getElementById('dlg-conn-label')?.value.trim() || `fk_${fromTable.name}_${toTable.name}`;

          // Auto-add FK column to toTable if it doesn't already exist
          if (!toHasFkCol && relType !== 'many-to-many') {
            const pkCol  = fromTable.columns.find(c => c.pk);
            const pkType = pkCol
              ? pkCol.type.replace(/\s*AUTO_INCREMENT|\s*AUTOINCREMENT/i, '').trim()
              : 'INT';
            const newFkCol = AppState.newColumn({
              name: fkSuggest,
              type: (pkType === 'SERIAL' || pkType === 'BIGSERIAL') ? 'BIGINT' : pkType,
              fk: true, nn: true, ai: false
            });
            // Add directly to state (already have history from addConnection below)
            const t = AppState.getTable(toId);
            if (t) t.columns.push(newFkCol);
            toCol = fkSuggest;
          }

          const conn = AppState.newConnection({
            fromTableId: fromId,
            toTableId: toId,
            type: relType,
            fromColumn: fromCol,
            toColumn:   toCol,
            label
          });
          AppState.addConnection(conn);
          // Mark FK column
          const t2 = AppState.getTable(toId);
          if (t2) {
            const fkCol = t2.columns.find(c => c.name === toCol);
            if (fkCol) AppState.updateColumn(toId, fkCol.id, { fk: true });
          }

          Canvas.renderAll();
          this.cancelConnectMode();
          this.toast('Connection created', 'success');
          return true;
        },
        () => this.cancelConnectMode()
      );

      // Auto-select likely FK columns
      setTimeout(() => {
        const fromSel = document.getElementById('dlg-from-col');
        const toSel   = document.getElementById('dlg-to-col');
        if (fromSel && toSel) {
          // Try to find PK in fromTable
          const pkCol = fromTable.columns.find(c => c.pk);
          if (pkCol) fromSel.value = pkCol.name;
          
          // Try to find a FK-likely column in toTable
          const fkCol = toTable.columns.find(c => c.name === fkSuggest || c.name.endsWith('_id'));
          if (fkCol) toSel.value = fkCol.name;
        }
      }, 60);
    },

    /* ── Delete Confirm ── */
    confirmDeleteTable(tableId) {
      const table = AppState.getTable(tableId);
      if (!table) return;
      this.openModal('Delete Table', `
        <p style="color:var(--c-text2)">Are you sure you want to delete <strong>${Utils.esc(table.name)}</strong>?<br/>All connections from/to this table will also be removed.</p>`,
        () => {
          AppState.removeTable(tableId);
          Canvas.renderAll();
          this.renderProperties();
          this.toast(`Deleted "${table.name}"`, 'info');
          return true;
        }
      );
    },

    /* ── Import SQL ── */
    showImportSqlDialog() {
      this.openModal('Import SQL', `
        <p style="color:var(--c-text2);margin-bottom:12px;font-size:12.5px;">Paste SQL DDL (CREATE TABLE statements) to auto-generate the diagram.</p>
        <textarea class="import-area" id="dlg-import-sql" placeholder="-- Paste CREATE TABLE statements here..."></textarea>
        <div style="margin-top:10px;display:flex;align-items:center;gap:10px;">
          <label class="btn-action btn-gen" style="cursor:pointer;flex:0 0 auto;">
            📂 Upload .sql
            <input type="file" accept=".sql,.txt" id="dlg-import-file" style="display:none"/>
          </label>
          <span style="font-size:11px;color:var(--c-text3)">or type above</span>
        </div>`,
        () => {
          const sql = document.getElementById('dlg-import-sql')?.value.trim();
          if (!sql) { this.toast('No SQL to import', 'error'); return false; }
          this.parseSqlText(sql);
          return true;
        }
      );

      setTimeout(() => {
        const fileInput = document.getElementById('dlg-import-file');
        if (fileInput) {
          fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await Utils.readFile(file);
            const ta = document.getElementById('dlg-import-sql');
            if (ta) ta.value = text;
          });
        }
      }, 50);
    },

    /* ════ SQL PARSE / EXPORT ════ */
    parseSqlToCanvas() {
      const sql = this.getSql().trim();
      if (!sql) { this.toast('SQL editor is empty', 'error'); return; }
      this.parseSqlText(sql);
    },

    parseSqlText(sql) {
      try {
        const { tables, connections } = SqlParser.parse(sql);
        if (tables.length === 0) { this.toast('No CREATE TABLE found in SQL', 'error'); return; }

        const existingNames = new Set(AppState.tables.map(t => t.name.toLowerCase()));
        let added = 0, skipped = 0;

        for (const t of tables) {
          if (existingNames.has(t.name.toLowerCase())) { skipped++; continue; }
          // Offset so it doesn't stack with existing
          t.x += AppState.tables.length * 10;
          t.y += AppState.tables.length * 10;
          AppState.addTable(t);
          added++;
        }
        for (const c of connections) {
          AppState.addConnection(c);
        }

        Canvas.renderAll();
        setTimeout(() => Canvas.fitView(), 100);
        this.toast(`Imported ${added} table(s), ${connections.length} connection(s)${skipped ? ` (${skipped} skipped)` : ''}`, 'success');
      } catch (err) {
        this.toast('Parse error: ' + err.message, 'error');
        console.error(err);
      }
    },

    generateSQL() {
      if (AppState.tables.length === 0) { this.toast('Canvas is empty', 'error'); return; }
      const dialect = document.getElementById('sql-dialect')?.value || 'mysql';
      const sql = SqlExporter.export(AppState.tables, AppState.connections, dialect);
      this.setSql(sql);
      this.toast('SQL generated in editor', 'success');
    },

    exportSQL() {
      if (AppState.tables.length === 0) { this.toast('Canvas is empty', 'error'); return; }
      const dialect = document.getElementById('sql-dialect')?.value || 'mysql';
      const sql = SqlExporter.export(AppState.tables, AppState.connections, dialect);
      Utils.download('schema.sql', sql, 'text/plain');
      this.toast('SQL exported', 'success');
    },

    exportJSON() {
      const data = AppState.serialize();
      Utils.download('diagram.dbdesign', JSON.stringify(data, null, 2), 'application/json');
      this.toast('JSON exported', 'success');
    },

    exportPNG() {
      if (!window.html2canvas) { this.toast('html2canvas not loaded', 'error'); return; }
      this.toast('Generating PNG…', 'info');
      html2canvas(Canvas.viewport, {
        backgroundColor: '#0d0f1a',
        scale: 2,
        useCORS: true,
        allowTaint: true
      }).then(c => {
        c.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'diagram.png';
          a.click();
          URL.revokeObjectURL(url);
          this.toast('PNG exported', 'success');
        });
      }).catch(err => this.toast('PNG export failed: ' + err.message, 'error'));
    },

    /* ════ NEW DIAGRAM ════ */
    newDiagram() {
      const folders = FileManager.getFolders();
      if (folders.length === 0) {
        this.toast('Please create a folder in the File Explorer first', 'error');
        return;
      }
      
      const proceed = () => {
        const foldersHtml = folders.map(f => `<option value="${f.id}">${Utils.esc(f.name)}</option>`).join('');
        this.openModal('New Diagram', `
          <div class="form-group">
            <label class="form-label">Folder</label>
            <select class="form-select" id="dlg-new-folder">${foldersHtml}</select>
          </div>
          <div class="form-group">
            <label class="form-label">File Name</label>
            <input class="form-input" id="dlg-new-name" value="untitled.dbdesign" placeholder="diagram.dbdesign"/>
          </div>`,
          () => {
            const folderId = document.getElementById('dlg-new-folder')?.value;
            let name = document.getElementById('dlg-new-name')?.value.trim();
            if (!name) { this.toast('File name required', 'error'); return false; }
            if (!name.endsWith('.dbdesign')) name += '.dbdesign';
            
            this._doNew(folderId, name);
            return true;
          }
        );
        setTimeout(() => {
          const inp = document.getElementById('dlg-new-name');
          if (inp) { inp.focus(); inp.select(); }
        }, 50);
      };

      if (AppState.isDirty && AppState.tables.length > 0) {
        this.openModal('Unsaved Changes', `
          <p style="color:var(--c-text2)">You have unsaved changes. Discard them and create a new diagram?</p>`,
          () => { proceed(); return true; }
        );
      } else {
        proceed();
      }
    },

    _doNew(folderId, name) {
      AppState.clear();
      this.setSql('');
      Canvas.resetView();
      Canvas.renderAll();
      this.renderProperties();
      
      // Save blank state to the new file immediately
      const data = AppState.serialize();
      const file = FileManager.createFile(folderId, name, data);
      AppState.currentFile = { folderId, fileId: file.id, name };
      AppState.isDirty = false;
      this._renderFileTree();
      
      document.title = `${name} — DB Designer`;
      this.toast(`New diagram "${name}" created`, 'success');
    },

    /* ════ FILE MANAGER ════ */
    _renderFileTree() {
      // Bind top buttons once
      if (!this._fileBtnBound) {
        this._on('btn-new-folder', 'click', () => this.newFolder());
        this._on('btn-new-file', 'click', () => this.newFile());
        this._fileBtnBound = true;
      }

      const container = document.getElementById('file-tree');
      if (!container) return;
      FileManager.renderTree(container, {
        onOpenFile:     (fid, fid2, name, data) => this.openFile(fid, fid2, name, data),
        onNewFile:      (fid) => this.newFileInFolder(fid),
        onRenameFolder: (fid, name) => this.renameFolder(fid, name),
        onDeleteFolder: (fid, name) => this.deleteFolder(fid, name),
        onRenameFile:   (fid, fileId, name) => this.renameFile(fid, fileId, name),
        onDeleteFile:   (fid, fileId, name) => this.deleteFile(fid, fileId, name)
      });
    },

    openFile(folderId, fileId, name, data) {
      if (AppState.isDirty && AppState.tables.length > 0) {
        this.openModal('Open File', `<p style="color:var(--c-text2)">Unsaved changes will be lost. Open "${Utils.esc(name)}" anyway?</p>`,
          () => { this._doOpenFile(folderId, fileId, name, data); return true; }
        );
      } else {
        this._doOpenFile(folderId, fileId, name, data);
      }
    },

    _doOpenFile(folderId, fileId, name, data) {
      if (data && data.version) {
        AppState.load(data);
      } else {
        AppState.clear();
      }
      AppState.currentFile = { folderId, fileId, name };
      Canvas.resetView();
      setTimeout(() => { Canvas.renderAll(); Canvas.fitView(); }, 50);
      this.renderProperties();
      this._renderFileTree();
      document.title = `${name} — DB Designer`;
      this.toast(`Opened "${name}"`, 'success');
    },

    saveCurrentFile() {
      if (!AppState.currentFile) {
        this.saveAs();
        return;
      }
      const data = AppState.serialize();
      FileManager.saveFile(AppState.currentFile.folderId, AppState.currentFile.fileId, data);
      AppState.isDirty = false;
      this.toast(`Saved "${AppState.currentFile.name}"`, 'success');
      this._renderFileTree();
    },

    saveAs() {
      const folders = FileManager.getFolders();
      if (folders.length === 0) {
        this.toast('Create a folder first in File Explorer', 'error');
        return;
      }
      const foldersHtml = folders.map(f => `<option value="${f.id}">${Utils.esc(f.name)}</option>`).join('');
      this.openModal('Save As', `
        <div class="form-group">
          <label class="form-label">Folder</label>
          <select class="form-select" id="dlg-save-folder">${foldersHtml}</select>
        </div>
        <div class="form-group">
          <label class="form-label">File Name</label>
          <input class="form-input" id="dlg-save-name" value="diagram.dbdesign" placeholder="diagram.dbdesign"/>
        </div>`,
        () => {
          const folderId = document.getElementById('dlg-save-folder')?.value;
          let name = document.getElementById('dlg-save-name')?.value.trim();
          if (!name) { this.toast('File name required', 'error'); return false; }
          if (!name.endsWith('.dbdesign')) name += '.dbdesign';
          const data = AppState.serialize();
          const file = FileManager.createFile(folderId, name, data);
          AppState.currentFile = { folderId, fileId: file.id, name };
          AppState.isDirty = false;
          this._renderFileTree();
          document.title = `${name} — DB Designer`;
          this.toast(`Saved as "${name}"`, 'success');
          return true;
        }
      );
      setTimeout(() => {
        const inp = document.getElementById('dlg-save-name');
        if (inp) { inp.focus(); inp.select(); }
      }, 50);
    },

    newFolder() {
      this.openModal('New Folder', `
        <div class="form-group">
          <label class="form-label">Folder Name</label>
          <input class="form-input" id="dlg-folder-name" placeholder="My Project"/>
        </div>`,
        () => {
          const name = document.getElementById('dlg-folder-name')?.value.trim();
          if (!name) { this.toast('Folder name required', 'error'); return false; }
          FileManager.createFolder(name);
          this._renderFileTree();
          this.toast(`Folder "${name}" created`, 'success');
          return true;
        }
      );
      setTimeout(() => document.getElementById('dlg-folder-name')?.focus(), 50);
    },

    newFile() {
      this.newDiagram();
    },

    newFileInFolder(folderId) {
      // Just call newDiagram, but pre-select the folder
      // To keep it simple, we can just call newDiagram() since it prompts for folder anyway
      this.newDiagram();
    },

    renameFolder(id, currentName) {
      this.openModal('Rename Folder', `
        <div class="form-group">
          <label class="form-label">New Name</label>
          <input class="form-input" id="dlg-ren-folder" value="${Utils.esc(currentName)}"/>
        </div>`,
        () => {
          const name = document.getElementById('dlg-ren-folder')?.value.trim();
          if (!name) return false;
          FileManager.renameFolder(id, name);
          this._renderFileTree();
          return true;
        }
      );
      setTimeout(() => {
        const inp = document.getElementById('dlg-ren-folder');
        if (inp) { inp.focus(); inp.select(); }
      }, 50);
    },

    deleteFolder(id, name) {
      this.openModal('Delete Folder', `
        <p style="color:var(--c-text2)">Delete folder "<strong>${Utils.esc(name)}</strong>" and ALL files inside?</p>`,
        () => { FileManager.deleteFolder(id); this._renderFileTree(); return true; }
      );
    },

    renameFile(folderId, fileId, currentName) {
      this.openModal('Rename File', `
        <div class="form-group">
          <label class="form-label">New Name</label>
          <input class="form-input" id="dlg-ren-file" value="${Utils.esc(currentName)}"/>
        </div>`,
        () => {
          const name = document.getElementById('dlg-ren-file')?.value.trim();
          if (!name) return false;
          FileManager.renameFile(folderId, fileId, name);
          if (AppState.currentFile?.fileId === fileId) AppState.currentFile.name = name;
          this._renderFileTree();
          return true;
        }
      );
      setTimeout(() => {
        const inp = document.getElementById('dlg-ren-file');
        if (inp) { inp.focus(); inp.select(); }
      }, 50);
    },

    deleteFile(folderId, fileId, name) {
      this.openModal('Delete File', `
        <p style="color:var(--c-text2)">Delete "<strong>${Utils.esc(name)}</strong>"?</p>`,
        () => {
          FileManager.deleteFile(folderId, fileId);
          if (AppState.currentFile?.fileId === fileId) AppState.currentFile = null;
          this._renderFileTree();
          return true;
        }
      );
    },

    /* ════ PROPERTIES PANEL ════ */
    renderProperties() {
      const container = document.getElementById('props-content');
      if (!container) return;

      if (!AppState.selected) {
        container.innerHTML = `
          <div class="props-empty">
            <svg width="32" height="32" viewBox="0 0 32 32" opacity="0.3"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 10v7M16 20v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <p>Select a table or connection</p>
          </div>`;
        return;
      }

      if (AppState.selected.type === 'table') {
        this._renderTableProperties(AppState.selected.id, container);
      } else if (AppState.selected.type === 'connection') {
        this._renderConnectionProperties(AppState.selected.id, container);
      }
    },

    _renderTableProperties(tableId, container) {
      const table = AppState.getTable(tableId);
      if (!table) { container.innerHTML = ''; return; }

      const colors = Utils.tableColors;
      
      if (table.type === 'note') {
        container.innerHTML = `
          <div class="prop-group">
            <label class="prop-label">Background Color</label>
            <div class="color-full-wrap">
              <input type="color" id="prop-color-native" value="${table.color || '#f59e0b'}" title="Pick any color"/>
              <div class="color-presets-row" id="prop-colors">
                ${colors.map(c => `<div class="color-swatch ${c === table.color ? 'active' : ''}" data-color="${c}" style="background:${c}" title="${c}"></div>`).join('')}
              </div>
            </div>
          </div>
          <div class="prop-group">
            <label class="prop-label">Note Text</label>
            <textarea class="prop-input" id="prop-note-text" style="min-height:150px;resize:vertical;padding:8px;">${Utils.esc(table.text || '')}</textarea>
          </div>
          <button class="btn-action" style="background:var(--c-danger);border-color:var(--c-danger);margin-top:16px;width:100%;" id="btn-prop-del">Delete Note</button>
        `;
        
        const textInp = document.getElementById('prop-note-text');
        if (textInp) {
          textInp.addEventListener('input', Utils.debounce((e) => {
            AppState.updateTable(tableId, { text: e.target.value });
            Canvas.renderAll();
          }, 300));
        }
      } else {
        container.innerHTML = `
          <div class="prop-group">
            <label class="prop-label">${table.type === 'view' ? 'View Name' : 'Table Name'}</label>
            <input class="prop-input" id="prop-tname" value="${Utils.esc(table.name)}"/>
          </div>
          <div class="prop-group">
            <label class="prop-label">Header Color</label>
            <div class="color-full-wrap">
              <input type="color" id="prop-color-native" value="${table.color || '#6366f1'}" title="Pick any color"/>
              <div class="color-presets-row" id="prop-colors">
                ${colors.map(c => `<div class="color-swatch ${c === table.color ? 'active' : ''}" data-color="${c}" style="background:${c}" title="${c}"></div>`).join('')}
              </div>
            </div>
          </div>
          <div class="prop-group">
            <label class="prop-label">Columns (${table.columns.length})</label>
            <div class="prop-col-list" id="prop-col-list" style="display:flex;flex-direction:column;gap:4px;">
              ${table.columns.map(col => `
                <div class="prop-col-item" draggable="true" data-col-id="${col.id}" style="cursor:grab;display:flex;align-items:center;padding:6px;background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--r-sm);gap:6px;">
                  <span style="color:var(--c-text3);font-size:12px;margin-right:2px;" title="Drag to reorder">⋮⋮</span>
                  <span style="font-family:var(--mono);font-size:11px;color:${col.pk ? 'var(--c-pk)' : col.fk ? 'var(--c-fk)' : 'var(--c-text2)'}">
                    ${col.pk ? '🔑' : col.fk ? '🔗' : '·'}
                  </span>
                  <span style="flex:1;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${Utils.esc(col.name)}</span>
                  <span style="font-family:var(--mono);font-size:10px;color:var(--c-text3)">${Utils.esc(col.type)}</span>
                  <button class="btn-prop-del" data-col-id="${col.id}" data-table-id="${tableId}" data-action="del-col" style="background:transparent;border:none;color:var(--c-text3);cursor:pointer;">✕</button>
                </div>`).join('')}
            </div>
            ${table.type !== 'view' ? `<button class="btn-prop-add" id="prop-add-col" style="margin-top:8px;">+ Add Column</button>` : ''}
          </div>
          <div class="prop-group">
            <label class="prop-label">Actions</label>
            <button class="btn-action btn-cancel" id="btn-prop-del" style="width:100%;justify-content:center;background:rgba(239,68,68,0.1);color:var(--c-danger);border-color:var(--c-danger);">
              🗑 Delete ${table.type === 'view' ? 'View' : 'Table'}
            </button>
          </div>
        `;
        
        const nameInp = document.getElementById('prop-tname');
        if (nameInp) {
          nameInp.addEventListener('change', (e) => {
            const name = e.target.value.trim();
            if (name) { AppState.updateTable(tableId, { name }); Canvas.renderAll(); }
          });
        }
        
        const btnAdd = document.getElementById('prop-add-col');
        if (btnAdd) btnAdd.addEventListener('click', () => this.showAddColumnDialog(tableId));
      }

      // Bind events
      document.getElementById('prop-tname')?.addEventListener('change', (e) => {
        AppState.updateTable(tableId, { name: e.target.value.trim() });
        Canvas.renderAll();
      });

      // Native color input
      document.getElementById('prop-color-native')?.addEventListener('input', (e) => {
        const color = e.target.value;
        document.querySelectorAll('#prop-colors .color-swatch').forEach(s => s.classList.remove('active'));
        AppState.updateTable(tableId, { color });
        Canvas.renderAll();
      });

      document.querySelectorAll('#prop-colors .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          document.querySelectorAll('#prop-colors .color-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          const color = sw.dataset.color;
          const nat = document.getElementById('prop-color-native');
          if (nat) nat.value = color;
          AppState.updateTable(tableId, { color });
          Canvas.renderAll();
        });
      });

      document.getElementById('prop-add-col')?.addEventListener('click', () => this.showAddColumnDialog(tableId));
      document.getElementById('prop-delete-table')?.addEventListener('click', () => this.confirmDeleteTable(tableId));

      container.querySelectorAll('[data-action="del-col"]').forEach(btn => {
        btn.addEventListener('click', () => {
          AppState.removeColumn(btn.dataset.tableId, btn.dataset.colId);
          Canvas.renderAll();
          this.renderProperties();
        });
      });

      // ── Drag & Drop Column Reordering ──
      let draggedColId = null;
      let dragTargetItem = null;

      container.querySelectorAll('.prop-col-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
          draggedColId = item.dataset.colId;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedColId);
          item.style.opacity = '0.5';
        });
        item.addEventListener('dragend', (e) => {
          item.style.opacity = '1';
          if (dragTargetItem) {
            dragTargetItem.style.borderTop = '1px solid var(--c-border2)';
            dragTargetItem.style.borderBottom = '1px solid var(--c-border2)';
          }
          dragTargetItem = null;
          draggedColId = null;
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = item.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (dragTargetItem && dragTargetItem !== item) {
            dragTargetItem.style.borderTop = '1px solid var(--c-border2)';
            dragTargetItem.style.borderBottom = '1px solid var(--c-border2)';
          }
          dragTargetItem = item;
          if (e.clientY < mid) {
            item.style.borderTop = '2px solid var(--c-accent)';
            item.style.borderBottom = '1px solid var(--c-border2)';
          } else {
            item.style.borderBottom = '2px solid var(--c-accent)';
            item.style.borderTop = '1px solid var(--c-border2)';
          }
        });
        item.addEventListener('dragleave', (e) => {
          item.style.borderTop = '1px solid var(--c-border2)';
          item.style.borderBottom = '1px solid var(--c-border2)';
        });
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.style.borderTop = '1px solid var(--c-border2)';
          item.style.borderBottom = '1px solid var(--c-border2)';
          if (!draggedColId || draggedColId === item.dataset.colId) return;

          const rect = item.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          const dropAfter = e.clientY >= mid;

          AppState.reorderColumn(tableId, draggedColId, item.dataset.colId, dropAfter);
          Canvas.renderAll();
          this.renderProperties();
        });
      });
    },

    _renderConnectionProperties(connId, container) {
      const conn = AppState.getConnection(connId);
      if (!conn) { container.innerHTML = ''; return; }
      const ft = AppState.getTable(conn.fromTableId);
      const tt = AppState.getTable(conn.toTableId);
      if (!ft || !tt) return;

      container.innerHTML = `
        <div class="prop-group">
          <label class="prop-label">Relationship</label>
          <select class="prop-select" id="prop-conn-type">
            <option value="one-to-many"  ${conn.type === 'one-to-many'  ? 'selected' : ''}>One to Many (1:N)</option>
            <option value="one-to-one"   ${conn.type === 'one-to-one'   ? 'selected' : ''}>One to One (1:1)</option>
            <option value="many-to-many" ${conn.type === 'many-to-many' ? 'selected' : ''}>Many to Many (N:M)</option>
          </select>
        </div>
        <div class="prop-group">
          <label class="prop-label">Label / FK Name</label>
          <input class="prop-input" id="prop-conn-label" value="${Utils.esc(conn.label || '')}"/>
        </div>
        <div class="prop-group">
          <label class="prop-label">Connection</label>
          <div style="padding:8px;background:var(--c-surface);border-radius:var(--r);font-size:11.5px;color:var(--c-text2)">
            <div>📋 <strong>${Utils.esc(ft.name)}</strong>.${conn.fromColumn || '—'}</div>
            <div style="margin:4px 0;color:var(--c-accent)">↓ ${conn.type}</div>
            <div>📋 <strong>${Utils.esc(tt.name)}</strong>.${conn.toColumn || '—'}</div>
          </div>
        </div>
        <div class="prop-group">
          <button class="btn-action btn-cancel" id="prop-delete-conn" style="width:100%;justify-content:center;">
            🗑 Delete Connection
          </button>
        </div>`;

      document.getElementById('prop-conn-type')?.addEventListener('change', (e) => {
        AppState.updateConnection(connId, { type: e.target.value });
        Canvas.renderAll();
      });

      document.getElementById('prop-conn-label')?.addEventListener('change', (e) => {
        AppState.updateConnection(connId, { label: e.target.value.trim() });
        Canvas.renderAll();
      });

      document.getElementById('prop-delete-conn')?.addEventListener('click', () => {
        AppState.removeConnection(connId);
        Canvas.renderAll();
        this.renderProperties();
      });
    },

    /* ════ MODAL ════ */
    _initModal() {
      document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal(false));
      document.getElementById('modal-cancel')?.addEventListener('click', () => this.closeModal(false));
      document.getElementById('modal-ok')?.addEventListener('click', () => this.closeModal(true));
      document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) this.closeModal(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.getElementById('modal-overlay')?.classList.contains('visible')) {
          // Only close on Enter if not in textarea
          if (e.target.tagName !== 'TEXTAREA') this.closeModal(true);
        }
        if (e.key === 'Escape' && document.getElementById('modal-overlay')?.classList.contains('visible')) {
          this.closeModal(false);
        }
      });

      // Bind col type select for custom type toggle
      document.getElementById('modal-body')?.addEventListener('change', (e) => {
        if (e.target.id === 'dlg-col-type') {
          const wrap = document.getElementById('dlg-custom-type-wrap');
          if (wrap) wrap.style.display = e.target.value === '__custom__' ? 'block' : 'none';
        }
        // Constraint toggle visual
        if (e.target.type === 'checkbox') {
          const label = e.target.closest('.constraint-toggle');
          if (label) label.classList.toggle('active', e.target.checked);
        }
      });
    },

    _modalOnConfirm: null,
    _modalOnCancel: null,

    openModal(title, bodyHtml, onConfirm, onCancel) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = bodyHtml;
      document.getElementById('modal-overlay').classList.add('visible');
      this._modalOnConfirm = onConfirm || null;
      this._modalOnCancel  = onCancel  || null;
    },

    closeModal(confirm) {
      if (confirm && this._modalOnConfirm) {
        const result = this._modalOnConfirm();
        if (result === false) return; // Validation failed
      } else if (!confirm && this._modalOnCancel) {
        this._modalOnCancel();
      }
      document.getElementById('modal-overlay').classList.remove('visible');
      this._modalOnConfirm = null;
      this._modalOnCancel  = null;
    },

    /* ════ CONTEXT MENU ════ */
    showContextMenu(x, y, type, id, vpPos) {
      const menu = document.getElementById('ctx-menu');
      const list = document.getElementById('ctx-menu-list');
      list.innerHTML = '';

      const items = [];

      if (type === 'canvas') {
        items.push(
          { label: '📋 New Table', action: () => { if (vpPos) Canvas._createShapeAt('table', vpPos.x, vpPos.y); } },
          { label: '👁 New View',  action: () => { if (vpPos) Canvas._createShapeAt('view',  vpPos.x, vpPos.y); } },
          { label: '📝 New Note',  action: () => { if (vpPos) Canvas._createShapeAt('note',  vpPos.x, vpPos.y); } },
          { sep: true },
          { label: '⊡ Fit View',  action: () => Canvas.fitView() },
          { label: '↺ Reset View', action: () => Canvas.resetView() }
        );
      } else if (type === 'table') {
        const table = AppState.getTable(id);
        items.push(
          { label: '✏️ Rename', action: () => this.showRenameTableDialog(id, table?.name || '') },
          { label: '+ Add Column', action: () => this.showAddColumnDialog(id) },
          { label: '🔗 Connect from here', action: () => { this.enterConnectMode(); AppState.connectSource = id; AppState.connectStep = 2; document.getElementById('connect-step-text').textContent = 'Now click target table…'; } },
          { sep: true },
          { label: '🗑 Delete', danger: true, action: () => this.confirmDeleteTable(id) }
        );
      } else if (type === 'connection') {
        items.push(
          { label: '🗑 Delete Connection', danger: true, action: () => { AppState.removeConnection(id); Canvas.renderAll(); this.renderProperties(); } }
        );
      }

      for (const item of items) {
        if (item.sep) {
          const sep = document.createElement('li');
          sep.className = 'ctx-sep';
          list.appendChild(sep);
          continue;
        }
        const li = document.createElement('li');
        li.className = `ctx-item${item.danger ? ' danger' : ''}`;
        li.innerHTML = item.label;
        li.addEventListener('click', () => { item.action(); this.hideContextMenu(); });
        list.appendChild(li);
      }

      menu.style.left = x + 'px';
      menu.style.top  = y + 'px';
      menu.classList.add('visible');

      // Adjust if off-screen
      requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect();
        if (r.right > window.innerWidth)  menu.style.left = (x - r.width)  + 'px';
        if (r.bottom > window.innerHeight) menu.style.top = (y - r.height) + 'px';
      });
    },

    hideContextMenu() {
      document.getElementById('ctx-menu')?.classList.remove('visible');
    },

    /* ════ TOAST ════ */
    toast(message, type = 'info') {
      const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
      const wrap = document.getElementById('toast-wrap');
      if (!wrap) return;

      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${Utils.esc(message)}</span>`;
      wrap.appendChild(el);

      setTimeout(() => {
        el.classList.add('fade-out');
        el.addEventListener('animationend', () => el.remove());
      }, 2800);
    },

    /* ════ FILE EXPLORER ════ */
    _renderFileTree() {
      const container = document.getElementById('file-tree');
      if (!container || !window.FileManager) return;

      FileManager.renderTree(container, {
        onNewFile: (folderId) => {
          const name = prompt('File name:', 'untitled.dbdesign');
          if (!name) return;
          const file = FileManager.createFile(folderId, name, AppState.serialize());
          if (file) {
            AppState.currentFile = { folderId, fileId: file.id, name: file.name };
            this._renderFileTree();
            this.toast('File created and saved', 'success');
          }
        },
        onOpenFile: (folderId, fileId, name, data) => {
          if (AppState.isDirty && AppState.currentFile) {
            FileManager.saveCurrentFile(AppState.serialize());
          }
          AppState.load(data);
          AppState.currentFile = { folderId, fileId, name };
          Canvas.renderAll();
          this.renderProperties();
          this._renderFileTree();
          this.toast(`Opened ${name}`, 'info');
        },
        onRenameFile: (folderId, fileId, name) => {
          const newName = prompt('New file name:', name);
          if (newName) {
            FileManager.renameFile(folderId, fileId, newName);
            if (AppState.currentFile && AppState.currentFile.fileId === fileId) {
              AppState.currentFile.name = newName;
            }
            this._renderFileTree();
          }
        },
        onDeleteFile: (folderId, fileId, name) => {
          if (confirm(`Delete file "${name}"?`)) {
            FileManager.deleteFile(folderId, fileId);
            if (AppState.currentFile && AppState.currentFile.fileId === fileId) {
              AppState.currentFile = null;
            }
            this._renderFileTree();
          }
        },
        onRenameFolder: (folderId, name) => {
          const newName = prompt('New folder name:', name);
          if (newName) {
            FileManager.renameFolder(folderId, newName);
            this._renderFileTree();
          }
        },
        onDeleteFolder: (folderId, name) => {
          if (confirm(`Delete folder "${name}" and all its contents?`)) {
            FileManager.deleteFolder(folderId);
            if (AppState.currentFile && AppState.currentFile.folderId === folderId) {
              AppState.currentFile = null;
            }
            this._renderFileTree();
          }
        }
      });
    },

    newFolder() {
      const name = prompt('New folder name:', 'New Project');
      if (name) {
        FileManager.createFolder(name);
        this._renderFileTree();
      }
    },

    newFile() {
      let folders = FileManager.getFolders();
      if (folders.length === 0) {
        FileManager.createFolder('My Project');
        folders = FileManager.getFolders();
      }
      const folderId = folders[0].id;
      const name = prompt('File name:', 'untitled.dbdesign');
      if (!name) return;
      const file = FileManager.createFile(folderId, name, AppState.serialize());
      if (file) {
        AppState.currentFile = { folderId, fileId: file.id, name: file.name };
        this._renderFileTree();
        this.toast('File created and saved', 'success');
      }
    },

    /* ════ PANEL TOGGLE ════ */
    togglePanel(side) {
      if (side === 'left') {
        const panel = document.getElementById('left-panel');
        if (!panel) return;
        const collapsed = panel.classList.toggle('collapsed');
        const btn = document.getElementById('btn-toggle-sql');
        if (btn) btn.classList.toggle('active', !collapsed);
        if (!collapsed && this._editor) setTimeout(() => this._editor.refresh(), 260);
      } else {
        const panel = document.getElementById('right-panel');
        if (!panel) return;
        panel.classList.toggle('collapsed');
        const btn = document.getElementById('btn-toggle-shapes');
        if (btn) btn.classList.toggle('active', !panel.classList.contains('collapsed'));
      }
    },

    /* ════ PANEL RESIZE ════ */
    _initPanelResize() {
      // ── Left panel resize ──
      const leftHandle = document.getElementById('left-resize-handle');
      const leftPanel  = document.getElementById('left-panel');
      if (leftHandle && leftPanel) {
        let dragging = false, startX = 0, startW = 0;
        leftHandle.addEventListener('mousedown', (e) => {
          dragging = true; startX = e.clientX; startW = leftPanel.offsetWidth;
          document.body.style.cursor = 'ew-resize';
          document.body.style.userSelect = 'none';
          e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const w = Math.max(288, Math.min(800, startW + (e.clientX - startX)));
          leftPanel.style.width = w + 'px';
          leftPanel.style.minWidth = w + 'px';
          leftPanel.classList.remove('collapsed');
          if (this._editor) this._editor.refresh();
        });
        document.addEventListener('mouseup', () => {
          if (!dragging) return;
          dragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        });
      }

      // ── Right panel resize ──
      const rightHandle = document.getElementById('right-resize-handle');
      const rightPanel  = document.getElementById('right-panel');
      if (rightHandle && rightPanel) {
        let dragging = false, startX = 0, startW = 0;
        rightHandle.addEventListener('mousedown', (e) => {
          dragging = true; startX = e.clientX; startW = rightPanel.offsetWidth;
          document.body.style.cursor = 'ew-resize';
          document.body.style.userSelect = 'none';
          e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const w = Math.max(0, Math.min(600, startW - (e.clientX - startX)));
          rightPanel.style.width = w + 'px';
          rightPanel.style.minWidth = w + 'px';
          if (w < 24) rightPanel.classList.add('collapsed');
          else rightPanel.classList.remove('collapsed');
        });
        document.addEventListener('mouseup', () => {
          if (!dragging) return;
          dragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        });
      }

      // ── Right panel internal: Toolbox ↕ Properties ──
      const tbDivider = document.getElementById('toolbox-divider');
      const toolbox = document.getElementById('toolbox');
      const rpDivider  = document.getElementById('rp-divider');
      const propsPanel = document.getElementById('properties-panel');
      const filePanel  = document.getElementById('file-explorer');
      
      if (toolbox) {
        toolbox.style.display = 'flex';
        toolbox.style.flexDirection = 'column';
        toolbox.style.overflowY = 'auto'; // allow scrolling if shrunk
      }

      if (tbDivider && toolbox && propsPanel) {
        let draggingTB = false, startYTB = 0, startTH = 0;
        tbDivider.addEventListener('mousedown', (e) => {
          draggingTB = true;
          startYTB = e.clientY;
          startTH = toolbox.offsetHeight;
          document.body.style.cursor = 'ns-resize';
          document.body.style.userSelect = 'none';
          e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
          if (!draggingTB) return;
          const dy = e.clientY - startYTB;
          const newTH = Math.max(60, startTH + dy);
          toolbox.style.flex = 'none';
          toolbox.style.height = newTH + 'px';
        });
        document.addEventListener('mouseup', () => {
          if (!draggingTB) return;
          draggingTB = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        });
      }

      // ── Right panel internal: Properties ↕ Files ──
      if (rpDivider && propsPanel && filePanel) {
        let dragging = false, startY = 0, startPH = 0, startFH = 0;
        rpDivider.addEventListener('mousedown', (e) => {
          dragging = true;
          startY = e.clientY;
          startPH = propsPanel.offsetHeight;
          startFH = filePanel.offsetHeight;
          document.body.style.cursor = 'ns-resize';
          document.body.style.userSelect = 'none';
          e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const dy = e.clientY - startY;
          const newPH = Math.max(80, startPH + dy);
          const newFH = Math.max(80, startFH - dy);
          propsPanel.style.flex = 'none';
          propsPanel.style.height = newPH + 'px';
          filePanel.style.flex = 'none';
          filePanel.style.height = newFH + 'px';
        });
        document.addEventListener('mouseup', () => {
          if (!dragging) return;
          dragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        });
      }
    },

    /* ════ PANEL TOGGLE INIT ════ */
    _initPanelToggles() {
      // Left panel toggle via panel header click
      const leftPanelHeader = document.getElementById('sql-panel-header');
      if (leftPanelHeader) {
        leftPanelHeader.addEventListener('dblclick', () => this.togglePanel('left'));
      }
    }
  };


  /* ════ BOOT ════ */
  document.addEventListener('DOMContentLoaded', () => {
    // Set initial pan
    App.init();

    // Cancel connect banner button
    document.getElementById('btn-cancel-connect')?.addEventListener('click', () => App.cancelConnectMode());
  });

  global.App = App;
})(window);
