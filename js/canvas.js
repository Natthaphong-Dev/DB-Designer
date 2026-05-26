/* ════════════════════════════════════════════════════════════
   js/canvas.js — Canvas Rendering, Interaction & Connection Drawing
   ════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const TABLE_WIDTH = 240;
  const HEADER_HEIGHT = 44;
  const ROW_HEIGHT = 30;
  const ADD_ROW_HEIGHT = 32;
  const CANVAS_SIZE = 8000;
  const INITIAL_X = 4000; // center of 8000px canvas
  const INITIAL_Y = 3800;

  /* ════════════════════ MAIN CANVAS OBJECT ════════════════════ */
  const Canvas = {

    /* ── Elements ── */
    wrap: null,
    viewport: null,
    svgLayer: null,
    connGroup: null,
    previewGroup: null,

    /* ── Drag state ── */
    _drag: null,   // { tableId, startX, startY, origX, origY }
    _pan: null,    // { startX, startY, origPanX, origPanY }
    _isMiddleDown: false,

    /* ── Connect preview ── */
    _previewLine: null,

    /* ════════ INIT ════════ */
    init() {
      this.wrap = document.getElementById('canvas-wrap');
      this.viewport = document.getElementById('canvas-viewport');
      this.svgLayer = document.getElementById('svg-layer');
      this.connGroup = document.getElementById('connections-group');
      this.previewGroup = document.getElementById('preview-connection-group');

      this._initPan();
      this._initDragDrop();
      this._initMouseEvents();
      this._initKeyboard();
      this._applyTransform();
    },

    /* ════ Initial View ════ */
    resetView() {
      const rect = this.wrap.getBoundingClientRect();
      AppState.canvas.panX = rect.width / 2 - INITIAL_X;
      AppState.canvas.panY = rect.height / 2 - INITIAL_Y;
      AppState.canvas.scale = 1;
      this._applyTransform();
      this._updateZoomLabel();
    },

    /* ════ Transform ════ */
    _applyTransform() {
      const { scale, panX, panY } = AppState.canvas;
      this.viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      this.viewport.style.transformOrigin = '0 0';
    },

    _updateZoomLabel() {
      const el = document.getElementById('zoom-display');
      if (el) el.textContent = Math.round(AppState.canvas.scale * 100) + '%';
    },

    /* Screen → Viewport coordinates */
    screenToVP(sx, sy) {
      const rect = this.wrap.getBoundingClientRect();
      const { scale, panX, panY } = AppState.canvas;
      return {
        x: (sx - rect.left - panX) / scale,
        y: (sy - rect.top  - panY) / scale
      };
    },

    /* ════════ PAN ════════ */
    _initPan() {
      this.wrap.addEventListener('mousedown', (e) => {
        // Middle mouse button OR space+left
        if (e.button === 1 || (e.button === 0 && e.target === this.wrap) || (e.button === 0 && e.target === this.viewport) || (e.button === 0 && e.target.id === 'svg-bg')) {
          if (AppState.connectMode) return;
          this._pan = {
            startX: e.clientX,
            startY: e.clientY,
            origPanX: AppState.canvas.panX,
            origPanY: AppState.canvas.panY
          };
          this.wrap.classList.add('panning');
          e.preventDefault();
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (this._pan) {
          AppState.canvas.panX = this._pan.origPanX + (e.clientX - this._pan.startX);
          AppState.canvas.panY = this._pan.origPanY + (e.clientY - this._pan.startY);
          this._applyTransform();
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (this._pan) {
          this._pan = null;
          this.wrap.classList.remove('panning');
        }
      });

      // Scroll to pan (horizontal)
      this.wrap.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Zoom
          this._zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
        } else {
          // Pan
          AppState.canvas.panX -= e.deltaX;
          AppState.canvas.panY -= e.deltaY;
          this._applyTransform();
        }
      }, { passive: false });
    },

    /* ════ ZOOM ════ */
    _zoom(factor, cx, cy) {
      const { scale, panX, panY } = AppState.canvas;
      const newScale = Utils.clamp(scale * factor, 0.15, 4);
      const rect = this.wrap.getBoundingClientRect();
      const mouseVX = (cx - rect.left - panX) / scale;
      const mouseVY = (cy - rect.top  - panY) / scale;
      AppState.canvas.scale = newScale;
      AppState.canvas.panX = cx - rect.left - mouseVX * newScale;
      AppState.canvas.panY = cy - rect.top  - mouseVY * newScale;
      this._applyTransform();
      this._updateZoomLabel();
    },

    zoomIn()  { this._zoom(1.15, this.wrap.getBoundingClientRect().left + this.wrap.offsetWidth / 2, this.wrap.getBoundingClientRect().top + this.wrap.offsetHeight / 2); },
    zoomOut() { this._zoom(0.87, this.wrap.getBoundingClientRect().left + this.wrap.offsetWidth / 2, this.wrap.getBoundingClientRect().top + this.wrap.offsetHeight / 2); },

    fitView() {
      if (AppState.tables.length === 0) { this.resetView(); return; }
      const padding = 60;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const t of AppState.tables) {
        const el = this.viewport.querySelector(`[data-table-id="${t.id}"]`);
        const h = el ? el.offsetHeight : 120;
        minX = Math.min(minX, t.x);
        minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x + TABLE_WIDTH);
        maxY = Math.max(maxY, t.y + h);
      }
      const wrapRect = this.wrap.getBoundingClientRect();
      const diagW = maxX - minX + padding * 2;
      const diagH = maxY - minY + padding * 2;
      const scaleX = wrapRect.width / diagW;
      const scaleY = wrapRect.height / diagH;
      AppState.canvas.scale = Utils.clamp(Math.min(scaleX, scaleY), 0.2, 2);
      AppState.canvas.panX = (wrapRect.width  - diagW * AppState.canvas.scale) / 2 - (minX - padding) * AppState.canvas.scale;
      AppState.canvas.panY = (wrapRect.height - diagH * AppState.canvas.scale) / 2 - (minY - padding) * AppState.canvas.scale;
      this._applyTransform();
      this._updateZoomLabel();
    },

    /* ════════ DRAG-DROP FROM TOOLBOX ════════ */
    _initDragDrop() {
      // Prevent default drag behavior on viewport
      this.wrap.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });

      this.wrap.addEventListener('drop', (e) => {
        e.preventDefault();
        const shape = e.dataTransfer.getData('text/plain');
        if (!shape) return;
        const vp = this.screenToVP(e.clientX, e.clientY);
        this._createShapeAt(shape, vp.x, vp.y);
      });

      // Setup draggable items in toolbox
      document.querySelectorAll('.shape-card[draggable]').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', card.dataset.shape);
          e.dataTransfer.effectAllowed = 'copy';
        });
      });
    },

    _createShapeAt(shape, x, y) {
      if (shape === 'note') {
        const note = {
          id: Utils.uuid(),
          name: 'Note',
          type: 'note',
          x: x - 100,
          y: y - 40,
          color: '#f59e0b',
          text: 'Double-click to edit...',
          columns: []
        };
        AppState.addTable(note);
        this.renderAll();
        return;
      }
      // Show name dialog then create
      App.showCreateTableDialog(shape, Math.round(x - TABLE_WIDTH / 2), Math.round(y - 40));
    },

    /* ════════ MOUSE EVENTS ════════ */
    _initMouseEvents() {
      // Canvas background click → deselect
      this.wrap.addEventListener('click', (e) => {
        if (e.target === this.wrap || e.target === this.viewport || e.target.id === 'svg-bg') {
          if (AppState.connectMode && AppState.connectStep === 0) {
            AppState.connectStep = 1;
            document.getElementById('connect-step-text').textContent = 'Click source table…';
          } else if (!AppState.connectMode) {
            AppState.deselect();
            this.renderAll();
            App.renderProperties();
          }
        }
      });

      // Right-click context menu on canvas
      this.wrap.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const tableEl = e.target.closest('.table-node, .note-node');
        if (tableEl) {
          App.showContextMenu(e.clientX, e.clientY, 'table', tableEl.dataset.tableId);
        } else {
          const connEl = e.target.closest('.conn-hit');
          if (connEl) {
            App.showContextMenu(e.clientX, e.clientY, 'connection', connEl.dataset.connId);
          } else {
            const vp = this.screenToVP(e.clientX, e.clientY);
            App.showContextMenu(e.clientX, e.clientY, 'canvas', null, vp);
          }
        }
      });

      // Mouse move for connection preview
      this.wrap.addEventListener('mousemove', (e) => {
        if (AppState.connectMode && AppState.connectStep === 2 && AppState.connectSource) {
          const vp = this.screenToVP(e.clientX, e.clientY);
          this._updatePreviewLine(AppState.connectSource, vp.x, vp.y);
        }
      });
    },

    /* ════════ KEYBOARD ════════ */
    _initKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (AppState.undo()) { this.renderAll(); App.renderProperties(); App.toast('Undo', 'info'); }
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
          e.preventDefault();
          if (AppState.redo()) { this.renderAll(); App.renderProperties(); App.toast('Redo', 'info'); }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          App.saveCurrentFile();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (AppState.selected) {
            if (AppState.selected.type === 'table') {
              AppState.removeTable(AppState.selected.id);
            } else if (AppState.selected.type === 'connection') {
              AppState.removeConnection(AppState.selected.id);
            }
            this.renderAll();
            App.renderProperties();
          }
        }
        if (e.key === 'Escape') {
          if (AppState.connectMode) App.cancelConnectMode();
          AppState.deselect();
          this.renderAll();
          App.renderProperties();
        }
        if (e.key === '+' || e.key === '=') this.zoomIn();
        if (e.key === '-') this.zoomOut();
        if (e.key === '0') this.fitView();
      });
    },

    /* ════════ RENDER ALL ════════ */
    renderAll() {
      this._renderTables();
      this._renderConnections();
      this._updateEmptyHint();
      this._updateUndoRedoBtns();
    },

    _updateEmptyHint() {
      const hint = document.getElementById('empty-hint');
      if (hint) hint.classList.toggle('hidden', AppState.tables.length > 0);
    },

    _updateUndoRedoBtns() {
      const undoBtn = document.getElementById('btn-undo');
      const redoBtn = document.getElementById('btn-redo');
      if (undoBtn) undoBtn.disabled = AppState._histIdx <= 0;
      if (redoBtn) redoBtn.disabled = AppState._histIdx >= AppState._history.length - 1;
    },

    /* ════════ RENDER TABLES ════════ */
    _renderTables() {
      // Remove deleted tables
      const existing = new Set(AppState.tables.map(t => t.id));
      this.viewport.querySelectorAll('[data-table-id]').forEach(el => {
        if (!existing.has(el.dataset.tableId)) el.remove();
      });

      for (const table of AppState.tables) {
        let el = this.viewport.querySelector(`[data-table-id="${table.id}"]`);
        if (!el) {
          el = this._createTableEl(table);
          if (table.type === 'note') {
            el.className = 'note-node';
          }
          this.viewport.appendChild(el);
        }
        this._updateTableEl(el, table);
      }
    },

    /* ─── Create Table DOM Element ─── */
    _createTableEl(table) {
      const el = document.createElement('div');
      el.className = 'table-node';
      el.dataset.tableId = table.id;

      // Observe resize
      const ro = new ResizeObserver(() => {
        const t = AppState.getTable(table.id);
        if (t && el.offsetWidth > 0 && el.offsetHeight > 0) {
          // Only update if actually changed
          if (t.w !== el.offsetWidth || t.h !== el.offsetHeight) {
            t.w = el.offsetWidth;
            t.h = el.offsetHeight;
            this._renderConnections();
          }
        }
      });
      ro.observe(el);

      // Header or Note drag
      el.addEventListener('mousedown', (e) => {
        const hd = e.target.closest('.table-header') || e.target.closest('.note-header');
        if (!hd) return;
        if (e.target.closest('.table-hd-actions, [contenteditable], textarea, input, button, select')) return;
        e.preventDefault();
        const vp = this.screenToVP(e.clientX, e.clientY);
        this._drag = {
          tableId: table.id,
          startX: vp.x,
          startY: vp.y,
          origX: table.x,
          origY: table.y
        };
      });

      window.addEventListener('mousemove', (e) => {
        if (!this._drag || this._drag.tableId !== table.id) return;
        const vp = this.screenToVP(e.clientX, e.clientY);
        const dx = vp.x - this._drag.startX;
        const dy = vp.y - this._drag.startY;
        const t = AppState.getTable(table.id);
        if (t) {
          t.x = Math.round(this._drag.origX + dx);
          t.y = Math.round(this._drag.origY + dy);
          el.style.left = t.x + 'px';
          el.style.top  = t.y + 'px';
          this._renderConnections(); // Live update connections
        }
      });

      window.addEventListener('mouseup', () => {
        if (this._drag && this._drag.tableId === table.id) {
          AppState.isDirty = true;
          this._drag = null;
        }
      });

      // Click to select
      el.addEventListener('click', (e) => {
        if (e.target.closest('[contenteditable], .col-act-btn, .table-hd-btn, .btn-add-col-row')) return;

        if (AppState.connectMode) {
          this._handleConnectClick(table.id);
          return;
        }

        AppState.select('table', table.id);
        this.renderAll();
        App.renderProperties();
      });

      return el;
    },

    _updateTableEl(el, table) {
      el.style.left = table.x + 'px';
      el.style.top  = table.y + 'px';
      if (table.w) el.style.width = table.w + 'px';
      if (table.h) el.style.height = table.h + 'px';
      el.classList.toggle('selected', AppState.selected?.id === table.id);

      if (table.type === 'note') {
        const color = table.color || '#fef08a';
        el.style.setProperty('--note-bg', color);
        el.innerHTML = `
          <div class="note-container" style="background: ${color}; width: 100%; height: 100%; min-height: 140px; border-radius: var(--r-lg); box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden;">
            <!-- Top Drag Area & Title -->
            <div class="note-header" style="display: flex; align-items: center; padding: 8px 12px; background: rgba(0,0,0,0.06); cursor: grab; user-select: none;">
              <div style="flex:1; font-weight:600; font-size:13px; color:rgba(0,0,0,0.6); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Utils.esc(table.name || 'Note')}</div>
              <div class="table-hd-actions" style="opacity:1;">
                <button class="table-hd-btn" data-action="delete" title="Delete Note" style="color: rgba(0,0,0,0.5); background: transparent;">✕</button>
              </div>
            </div>
            <!-- Text Area -->
            <div style="flex:1; padding: 10px;">
              <textarea class="note-textarea" spellcheck="false" placeholder="Write your note..." style="width:100%; height:100%; resize:none; background:transparent; border:none; color:#1f2937; font-family:var(--font); outline:none; font-size:14px; line-height:1.5;">${Utils.esc(table.text || '')}</textarea>
            </div>
          </div>
        `;
        
        el.querySelector('.note-textarea').addEventListener('input', (e) => {
          table.text = e.target.value;
          AppState.isDirty = true;
        });

        el.querySelectorAll('[data-action="delete"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            App.confirmDeleteTable(table.id);
          });
        });
        
        // Prevent double click on note from showing rename dialog
        el.querySelector('.note-textarea').addEventListener('dblclick', (e) => e.stopPropagation());
      } else {
        // Compute header color gradient
        const color = table.color || '#6366f1';
        const lighter = Utils.lighten(color, 30);

        el.innerHTML = `
          <!-- Connection ports -->
          <div class="conn-port" data-side="top"    data-table-id="${table.id}"></div>
          <div class="conn-port" data-side="right"  data-table-id="${table.id}"></div>
          <div class="conn-port" data-side="bottom" data-table-id="${table.id}"></div>
          <div class="conn-port" data-side="left"   data-table-id="${table.id}"></div>

          <!-- Header -->
          <div class="table-header" style="background: linear-gradient(135deg, ${color}, ${lighter});">
            <span class="table-type-badge">${table.type === 'view' ? '👁' : '📋'}</span>
            <div class="table-name-wrap">
              <div class="table-name" data-table-id="${table.id}" spellcheck="false">${Utils.esc(table.name)}</div>
              <div class="table-row-count">${table.columns.length} col${table.columns.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="table-hd-actions">
              ${table.type !== 'view' ? `<button class="table-hd-btn btn-add-col" data-table-id="${table.id}" title="Add Column">+</button>` : ''}
              <button class="table-hd-btn" data-table-id="${table.id}" data-action="delete" title="Delete ${table.type === 'view' ? 'View' : 'Table'}">✕</button>
            </div>
          </div>

          <!-- Columns -->
          <div class="table-columns">
            ${table.columns.map(col => this._colRowHTML(table.id, col)).join('')}
          </div>

          <!-- Add column row -->
          ${table.type !== 'view' ? `
          <div class="table-add-col">
            <button class="btn-add-col-row" data-table-id="${table.id}">+ Add Column</button>
          </div>` : ''}`;
      }

      this._bindTableEvents(el, table);
    },

    _colRowHTML(tableId, col) {
      const badges = [];
      if (col.pk) badges.push(`<span class="c-badge c-pk">PK</span>`);
      if (col.fk) badges.push(`<span class="c-badge c-fk">FK</span>`);
      if (col.nn && !col.pk) badges.push(`<span class="c-badge c-nn">NN</span>`);
      if (col.uq) badges.push(`<span class="c-badge c-uq">UQ</span>`);
      if (col.ai) badges.push(`<span class="c-badge c-ai">AI</span>`);

      return `
        <div class="table-col-row ${col.pk ? 'pk-row' : col.fk ? 'fk-row' : ''}" data-col-id="${col.id}">
          <div class="col-constraints">${badges.join('')}</div>
          <div class="col-name">${Utils.esc(col.name)}</div>
          <div class="col-type">${Utils.esc(col.type)}</div>
          <div class="col-actions">
            <button class="col-act-btn" data-action="edit-col" data-col-id="${col.id}" data-table-id="${tableId}" title="Edit column">✏</button>
            <button class="col-act-btn col-del-btn" data-action="del-col" data-col-id="${col.id}" data-table-id="${tableId}" title="Delete column">✕</button>
          </div>
        </div>`;
    },

    _bindTableEvents(el, table) {
      // Table name double-click to rename
      const nameEl = el.querySelector('.table-name');
      if (nameEl) {
        nameEl.addEventListener('dblclick', () => {
          App.showRenameTableDialog(table.id, table.name);
        });
      }

      // Header add button
      el.querySelectorAll('.btn-add-col').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          App.showAddColumnDialog(btn.dataset.tableId);
        });
      });

      // Add column row button
      el.querySelectorAll('.btn-add-col-row').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          App.showAddColumnDialog(btn.dataset.tableId);
        });
      });

      // Delete table
      el.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          App.confirmDeleteTable(btn.dataset.tableId);
        });
      });

      // Edit / Delete column
      el.querySelectorAll('[data-action="edit-col"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          App.showEditColumnDialog(btn.dataset.tableId, btn.dataset.colId);
        });
      });
      el.querySelectorAll('[data-action="del-col"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          AppState.removeColumn(btn.dataset.tableId, btn.dataset.colId);
          this.renderAll();
          App.renderProperties();
        });
      });

      // Connection ports
      el.querySelectorAll('.conn-port').forEach(port => {
        port.addEventListener('click', (e) => {
          e.stopPropagation();
          if (AppState.connectMode) {
            this._handleConnectClick(table.id);
          }
        });
      });

      // ── FK Hover: glow + flowing dots ──
      el.addEventListener('mouseenter', () => this._highlightFKConnections(table.id, true));
      el.addEventListener('mouseleave', () => this._highlightFKConnections(table.id, false));
    },

    /* ─── FK connection glow + animated flow dots ─── */
    _highlightFKConnections(tableId, highlight) {
      if (AppState.traceFkMode) {
        // Red reverse flow for incoming FKs
        const incomingConns = AppState.connections.filter(c => c.fromTableId === tableId);
        if (incomingConns.length === 0) return;
        
        const childTableIds = new Set(incomingConns.map(c => c.toTableId));
        
        if (highlight) {
          childTableIds.forEach(id => {
            const el = this.viewport.querySelector(`[data-table-id="${id}"]`);
            if (el) el.classList.add('fk-glow-red');
          });
          incomingConns.forEach(conn => {
            const g = this.connGroup.querySelector(`g[data-conn-id="${conn.id}"]`);
            if (!g || g.querySelector('.conn-flow-anim')) return;
            const visPath = g.querySelector('.conn-path');
            if (!visPath) return;
            const d = visPath.getAttribute('d');
            
            const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            glowPath.setAttribute('d', d);
            glowPath.setAttribute('class', 'conn-glow-red conn-flow-anim');
            glowPath.setAttribute('pointer-events', 'none');
            
            const flowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            flowPath.setAttribute('d', d);
            flowPath.setAttribute('class', 'conn-flow-red conn-flow-anim');
            flowPath.setAttribute('pointer-events', 'none');
            
            g.insertBefore(glowPath, visPath);
            g.appendChild(flowPath);
          });
        } else {
          childTableIds.forEach(id => {
            const el = this.viewport.querySelector(`[data-table-id="${id}"]`);
            if (el) el.classList.remove('fk-glow-red');
          });
          incomingConns.forEach(conn => {
            const g = this.connGroup.querySelector(`g[data-conn-id="${conn.id}"]`);
            if (g) g.querySelectorAll('.conn-flow-anim').forEach(el => el.remove());
          });
        }
        return;
      }

      // Normal purple highlight (all related)
      const relatedConns = AppState.connections.filter(
        c => c.fromTableId === tableId || c.toTableId === tableId
      );
      if (relatedConns.length === 0) return;

      // Collect all related table IDs
      const relatedTableIds = new Set();
      relatedConns.forEach(c => {
        relatedTableIds.add(c.fromTableId);
        relatedTableIds.add(c.toTableId);
      });
      relatedTableIds.delete(tableId);

      if (highlight) {
        // Glow related tables
        relatedTableIds.forEach(id => {
          const el = this.viewport.querySelector(`[data-table-id="${id}"]`);
          if (el) el.classList.add('fk-glow');
        });

        // Animate connections
        relatedConns.forEach(conn => {
          const g = this.connGroup.querySelector(`g[data-conn-id="${conn.id}"]`);
          if (!g) return;
          if (g.querySelector('.conn-flow-anim')) return;

          const visPath = g.querySelector('.conn-path');
          if (!visPath) return;
          const d = visPath.getAttribute('d');

          // Glow backdrop
          const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          glowPath.setAttribute('d', d);
          glowPath.setAttribute('class', 'conn-glow conn-flow-anim');
          glowPath.setAttribute('pointer-events', 'none');

          // Flowing dot path
          const flowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          flowPath.setAttribute('d', d);
          flowPath.setAttribute('class', 'conn-flow conn-flow-anim');
          flowPath.setAttribute('pointer-events', 'none');

          g.insertBefore(glowPath, visPath);
          g.appendChild(flowPath);
        });
      } else {
        // Remove glow from tables
        relatedTableIds.forEach(id => {
          const el = this.viewport.querySelector(`[data-table-id="${id}"]`);
          if (el) el.classList.remove('fk-glow');
        });
        // Remove animated paths
        relatedConns.forEach(conn => {
          const g = this.connGroup.querySelector(`g[data-conn-id="${conn.id}"]`);
          if (!g) return;
          g.querySelectorAll('.conn-flow-anim').forEach(el => el.remove());
        });
      }
    },

    /* ─── Create Note DOM Element ─── */
    _createNoteEl(table) {
      const el = document.createElement('div');
      el.className = 'note-node';
      el.dataset.tableId = table.id;

      el.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        const vp = this.screenToVP(e.clientX, e.clientY);
        this._drag = { tableId: table.id, startX: vp.x, startY: vp.y, origX: table.x, origY: table.y };
      });

      window.addEventListener('mousemove', (e) => {
        if (!this._drag || this._drag.tableId !== table.id) return;
        const vp = this.screenToVP(e.clientX, e.clientY);
        const t = AppState.getTable(table.id);
        if (t) {
          t.x = Math.round(this._drag.origX + (vp.x - this._drag.startX));
          t.y = Math.round(this._drag.origY + (vp.y - this._drag.startY));
          el.style.left = t.x + 'px';
          el.style.top  = t.y + 'px';
        }
      });

      window.addEventListener('mouseup', () => {
        if (this._drag && this._drag.tableId === table.id) { AppState.isDirty = true; this._drag = null; }
      });

      el.addEventListener('click', (e) => {
        if (e.target.tagName === 'TEXTAREA') return;
        AppState.select('table', table.id);
        this.renderAll();
        App.renderProperties();
      });

      return el;
    },

    _updateNoteEl(el, table) {
      el.style.left = table.x + 'px';
      el.style.top  = table.y + 'px';
      el.classList.toggle('selected', AppState.selected?.id === table.id);
      if (!el.querySelector('textarea')) {
        el.innerHTML = `
          <textarea placeholder="Note...">${Utils.esc(table.text || '')}</textarea>
          <div style="position:absolute;top:6px;right:6px;">
            <button class="table-hd-btn" data-action="delete" data-table-id="${table.id}" title="Delete">✕</button>
          </div>`;
        el.querySelector('textarea').addEventListener('input', (e) => {
          AppState.updateTable(table.id, { text: e.target.value });
        });
        const delBtn = el.querySelector('[data-action="delete"]');
        if (delBtn) delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          App.confirmDeleteTable(table.id);
        });
      }
    },

    /* Unified update dispatcher */
    _updateTableElAny(el, table) {
      if (table.type === 'note') {
        this._updateNoteEl(el, table);
      } else {
        this._updateTableEl(el, table);
      }
    },

    /* ════════ CONNECT MODE ════════ */
    _handleConnectClick(tableId) {
      if (AppState.connectStep === 1) {
        // Pick source
        AppState.connectSource = tableId;
        AppState.connectStep = 2;
        document.getElementById('connect-step-text').textContent = 'Now click target table…';
        // Highlight source
        const el = this.viewport.querySelector(`[data-table-id="${tableId}"]`);
        if (el) el.classList.add('connect-ready');
      } else if (AppState.connectStep === 2) {
        // Pick target
        const fromId = AppState.connectSource;
        const toId = tableId;

        if (fromId === toId) {
          App.toast('Cannot connect table to itself', 'error');
          return;
        }

        // Check duplicate
        const dup = AppState.connections.find(c =>
          (c.fromTableId === fromId && c.toTableId === toId) ||
          (c.fromTableId === toId && c.toTableId === fromId)
        );

        const fromTable = AppState.getTable(fromId);
        const toTable   = AppState.getTable(toId);
        if (!fromTable || !toTable) return;

        // Show connection details dialog
        App.showConnectionDialog(fromId, toId, fromTable, toTable);
      }
    },

    /* ════════ CONNECTION PREVIEW LINE ════════ */
    _updatePreviewLine(fromTableId, toX, toY) {
      const fromTable = AppState.getTable(fromTableId);
      if (!fromTable) return;

      const fromEl = this.viewport.querySelector(`[data-table-id="${fromTableId}"]`);
      const fromW = fromEl ? fromEl.offsetWidth : 240;
      const fromH = fromEl ? fromEl.offsetHeight : 80;
      const fx = fromTable.x + fromW;
      const fy = fromTable.y + fromH / 2;

      const pathData = this._bezierPath(fx, fy, 'right', toX, toY, 'none');

      if (!this._previewLine) {
        this._previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this._previewLine.setAttribute('class', 'preview-path');
        this.previewGroup.appendChild(this._previewLine);
      }
      this._previewLine.setAttribute('d', pathData);
    },

    clearPreview() {
      this.previewGroup.innerHTML = '';
      this._previewLine = null;
    },

    /* ════════ RENDER CONNECTIONS ════════ */
    _renderConnections() {
      this.connGroup.innerHTML = '';
      
      const tableSides = {}; // { tableId: { left: [], right: [], top: [], bottom: [] } }
      for (const t of AppState.tables) {
         tableSides[t.id] = { left: [], right: [], top: [], bottom: [] };
      }
      
      const connData = [];
      
      for (const conn of AppState.connections) {
         const ft = AppState.getTable(conn.fromTableId);
         const tt = AppState.getTable(conn.toTableId);
         if (!ft || !tt) continue;
         
         const fromEl = this.viewport.querySelector(`[data-table-id="${conn.fromTableId}"]`);
         const toEl   = this.viewport.querySelector(`[data-table-id="${conn.toTableId}"]`);
         const fromW = fromEl ? fromEl.offsetWidth : 240;
         const fromH = fromEl ? fromEl.offsetHeight : 80;
         const toW   = toEl   ? toEl.offsetWidth   : 240;
         const toH   = toEl   ? toEl.offsetHeight   : 80;
         
         const fCX = ft.x + fromW / 2;
         const fCY = ft.y + fromH / 2;
         const tCX = tt.x + toW / 2;
         const tCY = tt.y + toH / 2;
         const dx = tCX - fCX;
         const dy = tCY - fCY;
         
         let fromSide, toSide;
         if (Math.abs(dx) >= Math.abs(dy)) {
           fromSide = dx >= 0 ? 'right' : 'left';
           toSide   = dx >= 0 ? 'left'  : 'right';
         } else {
           fromSide = dy >= 0 ? 'bottom' : 'top';
           toSide   = dy >= 0 ? 'top'    : 'bottom';
         }
         
         const data = { conn, ft, tt, fromW, fromH, toW, toH, fromSide, toSide };
         connData.push(data);
         
         if (tableSides[ft.id]) tableSides[ft.id][fromSide].push(data);
         if (tableSides[tt.id]) tableSides[tt.id][toSide].push(data);
      }
      
      for (const data of connData) {
         const fList = tableSides[data.ft.id] ? tableSides[data.ft.id][data.fromSide] : [data];
         const fIdx = fList.indexOf(data);
         const fTotal = fList.length;
         
         const tList = tableSides[data.tt.id] ? tableSides[data.tt.id][data.toSide] : [data];
         const tIdx = tList.indexOf(data);
         const tTotal = tList.length;
         
         this._renderOneConnection(data.conn, data.ft, data.tt, data.fromW, data.fromH, data.toW, data.toH, data.fromSide, data.toSide, fIdx, fTotal, tIdx, tTotal);
      }
    },

    _renderOneConnection(conn, ft, tt, fromW, fromH, toW, toH, fromSide, toSide, fIdx, fTotal, tIdx, tTotal) {
      const SPACING = 20;
      const fOffset = (fIdx - (fTotal - 1) / 2) * SPACING;
      const tOffset = (tIdx - (tTotal - 1) / 2) * SPACING;
      
      const pts = {
        right:  { x: ft.x + fromW, y: ft.y + fromH / 2 + fOffset },
        left:   { x: ft.x,               y: ft.y + fromH / 2 + fOffset },
        bottom: { x: ft.x + fromW / 2 + fOffset, y: ft.y + fromH },
        top:    { x: ft.x + fromW / 2 + fOffset, y: ft.y }
      };
      
      const epts = {
        left:   { x: tt.x,               y: tt.y + toH / 2 + tOffset },
        right:  { x: tt.x + toW, y: tt.y + toH / 2 + tOffset },
        top:    { x: tt.x + toW / 2 + tOffset, y: tt.y },
        bottom: { x: tt.x + toW / 2 + tOffset, y: tt.y + toH }
      };

      const fx = pts[fromSide].x;
      const fy = pts[fromSide].y;
      const tx = epts[toSide].x;
      const ty = epts[toSide].y;
      
      const pathData = this._bezierPath(fx, fy, fromSide, tx, ty, toSide);

      const isSelected = AppState.selected?.type === 'connection' && AppState.selected?.id === conn.id;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-conn-id', conn.id);

      // Invisible wide hit area
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', pathData);
      hitPath.setAttribute('class', 'conn-hit');
      hitPath.setAttribute('fill', 'none');
      hitPath.setAttribute('stroke', 'transparent');
      hitPath.setAttribute('stroke-width', '12');
      hitPath.setAttribute('data-conn-id', conn.id);
      hitPath.style.cursor = 'pointer';
      hitPath.style.pointerEvents = 'stroke';

      hitPath.addEventListener('click', (e) => {
        e.stopPropagation();
        AppState.select('connection', conn.id);
        this._renderConnections();
        App.renderProperties();
      });

      // Visible path
      const visPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      visPath.setAttribute('d', pathData);
      visPath.setAttribute('class', `conn-path${isSelected ? ' selected' : ''}`);

      g.appendChild(hitPath);
      g.appendChild(visPath);

      // Crow's foot markers
      const markerColor = isSelected ? '#818cf8' : 'rgba(99,102,241,0.55)';
      this._drawMarkers(g, conn.type, fx, fy, fromSide, tx, ty, toSide, markerColor);

      // Label
      if (conn.label) {
        const mx = (fx + tx) / 2;
        const my = (fy + ty) / 2;
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', mx - 30);
        bg.setAttribute('y', my - 8);
        bg.setAttribute('width', '60');
        bg.setAttribute('height', '16');
        bg.setAttribute('rx', '4');
        bg.setAttribute('fill', '#1a1d2e');
        bg.setAttribute('stroke', 'rgba(99,102,241,0.2)');
        bg.setAttribute('stroke-width', '1');
        const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('x', mx);
        lbl.setAttribute('y', my + 4);
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('class', 'conn-label');
        lbl.textContent = conn.label.length > 10 ? conn.label.slice(0, 9) + '…' : conn.label;
        g.appendChild(bg);
        g.appendChild(lbl);
      }

      this.connGroup.appendChild(g);
    },


    /* ─── Bezier Path ─── */
    _bezierPath(fx, fy, fromSide, tx, ty, toSide) {
      const CTRL = 80;
      let cp1x = fx, cp1y = fy, cp2x = tx, cp2y = ty;

      switch (fromSide) {
        case 'right':  cp1x = fx + CTRL; break;
        case 'left':   cp1x = fx - CTRL; break;
        case 'bottom': cp1y = fy + CTRL; break;
        case 'top':    cp1y = fy - CTRL; break;
      }
      switch (toSide) {
        case 'left':   cp2x = tx - CTRL; break;
        case 'right':  cp2x = tx + CTRL; break;
        case 'top':    cp2y = ty - CTRL; break;
        case 'bottom': cp2y = ty + CTRL; break;
      }

      return `M ${fx} ${fy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}`;
    },

    /* ─── Draw Crow's Foot Markers ─── */
    _drawMarkers(g, type, fx, fy, fromSide, tx, ty, toSide, color) {
      const fromMany = type === 'many-to-many';
      const toMany   = type === 'one-to-many' || type === 'many-to-many';

      if (fromMany) {
        this._addCrowsFoot(g, fx, fy, fromSide, color);
      } else {
        this._addOneMark(g, fx, fy, fromSide, color);
      }

      if (toMany) {
        this._addCrowsFoot(g, tx, ty, toSide, color);
      } else {
        this._addOneMark(g, tx, ty, toSide, color);
      }
    },

    _addOneMark(g, x, y, side, color) {
      const DIST = 12;
      const LEN  = 8;
      // Two parallel tick marks
      for (const offset of [-DIST, -DIST - 6]) {
        let x1, y1, x2, y2;
        switch (side) {
          case 'right':  x1 = x + offset; y1 = y - LEN; x2 = x + offset; y2 = y + LEN; break;
          case 'left':   x1 = x - offset; y1 = y - LEN; x2 = x - offset; y2 = y + LEN; break;
          case 'bottom': x1 = x - LEN; y1 = y + offset; x2 = x + LEN; y2 = y + offset; break;
          case 'top':    x1 = x - LEN; y1 = y - offset; x2 = x + LEN; y2 = y - offset; break;
          default: return;
        }
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '1.8');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('pointer-events', 'none');
        g.appendChild(line);
      }
    },

    _addCrowsFoot(g, x, y, side, color) {
      const DIST = 14;
      const SPREAD = 10;
      let bx, by, lx1, ly1, lx2, ly2, cx, cy;

      // Base of crow's foot (farther from table)
      // Tips closer to table
      switch (side) {
        case 'right':
          bx = x + DIST; by = y;
          lx1 = x; ly1 = y - SPREAD;
          lx2 = x; ly2 = y + SPREAD;
          cx  = x; cy  = y;
          break;
        case 'left':
          bx = x - DIST; by = y;
          lx1 = x; ly1 = y - SPREAD;
          lx2 = x; ly2 = y + SPREAD;
          cx  = x; cy  = y;
          break;
        case 'bottom':
          bx = x; by = y + DIST;
          lx1 = x - SPREAD; ly1 = y;
          lx2 = x + SPREAD; ly2 = y;
          cx  = x; cy  = y;
          break;
        case 'top':
          bx = x; by = y - DIST;
          lx1 = x - SPREAD; ly1 = y;
          lx2 = x + SPREAD; ly2 = y;
          cx  = x; cy  = y;
          break;
        default: return;
      }

      const paths = [
        [bx, by, lx1, ly1],
        [bx, by, lx2, ly2],
        [bx, by, cx,  cy ]
      ];

      for (const [x1, y1, x2, y2] of paths) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '1.8');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('pointer-events', 'none');
        g.appendChild(line);
      }

      // Tick mark at base
      const TICK = 8;
      let tx1, ty1, tx2, ty2;
      switch (side) {
        case 'right':  tx1 = bx; ty1 = by - TICK; tx2 = bx; ty2 = by + TICK; break;
        case 'left':   tx1 = bx; ty1 = by - TICK; tx2 = bx; ty2 = by + TICK; break;
        case 'bottom': tx1 = bx - TICK; ty1 = by; tx2 = bx + TICK; ty2 = by; break;
        case 'top':    tx1 = bx - TICK; ty1 = by; tx2 = bx + TICK; ty2 = by; break;
        default: return;
      }
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', tx1); tick.setAttribute('y1', ty1);
      tick.setAttribute('x2', tx2); tick.setAttribute('y2', ty2);
      tick.setAttribute('stroke', color);
      tick.setAttribute('stroke-width', '1.8');
      tick.setAttribute('stroke-linecap', 'round');
      tick.setAttribute('pointer-events', 'none');
      g.appendChild(tick);
    }
  };

  global.Canvas = Canvas;
  global.TABLE_WIDTH = TABLE_WIDTH;
})(window);
