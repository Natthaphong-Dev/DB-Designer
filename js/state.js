/* ════════════════════════════════════════════════════════════
   js/state.js — Global App State with Undo/Redo
   ════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ─── Default new column ─── */
  function newColumn(overrides = {}) {
    return Object.assign({
      id: Utils.uuid(),
      name: 'column',
      type: 'VARCHAR(255)',
      pk: false,
      fk: false,
      nn: false,
      uq: false,
      ai: false,
      defaultVal: null
    }, overrides);
  }

  /* ─── Default new table ─── */
  function newTable(overrides = {}) {
    return Object.assign({
      id: Utils.uuid(),
      name: 'new_table',
      type: 'table',   // 'table' | 'view' | 'note'
      x: 200,
      y: 200,
      color: Utils.randomColor(),
      columns: [
        newColumn({ name: 'id', type: 'INT', pk: true, nn: true, ai: true }),
        newColumn({ name: 'created_at', type: 'TIMESTAMP' })
      ]
    }, overrides);
  }

  /* ─── Default new connection ─── */
  function newConnection(overrides = {}) {
    return Object.assign({
      id: Utils.uuid(),
      fromTableId: null,
      fromColumn: null,
      toTableId: null,
      toColumn: null,
      type: 'one-to-many',  // 'one-to-one' | 'one-to-many' | 'many-to-many'
      label: ''
    }, overrides);
  }

  /* ────────────────────────────────────────────────
     AppState — Main application state container
  ──────────────────────────────────────────────── */
  const AppState = {
    /* ── Data ── */
    tables: [],
    connections: [],

    /* ── UI State ── */
    selected: null,        // { type: 'table'|'connection', id }
    connectMode: false,
    connectStep: 0,        // 0=idle, 1=picking source, 2=picking target
    connectSource: null,   // table id of source
    relType: 'one-to-many',
    traceFkMode: false,    // red trace highlight mode

    /* ── Canvas ── */
    canvas: { scale: 1, panX: 0, panY: 0 },

    /* ── Dirty flag ── */
    isDirty: false,

    /* ── Current file (in FileManager) ── */
    currentFile: null,  // { folderId, fileId, name }

    /* ── Undo/Redo history ── */
    _history: [],
    _histIdx: -1,

    /* ── Factories (exposed for external use) ── */
    newColumn,
    newTable,
    newConnection,

    /* ════ History ════ */
    _snapshot() {
      return {
        tables: Utils.clone(this.tables),
        connections: Utils.clone(this.connections)
      };
    },

    pushHistory() {
      // Truncate future
      this._history = this._history.slice(0, this._histIdx + 1);
      this._history.push(this._snapshot());
      if (this._history.length > 60) {
        this._history.shift();
      } else {
        this._histIdx++;
      }
      this.isDirty = true;
    },

    undo() {
      if (this._histIdx <= 0) return false;
      this._histIdx--;
      const snap = this._history[this._histIdx];
      this.tables = Utils.clone(snap.tables);
      this.connections = Utils.clone(snap.connections);
      this.selected = null;
      return true;
    },

    redo() {
      if (this._histIdx >= this._history.length - 1) return false;
      this._histIdx++;
      const snap = this._history[this._histIdx];
      this.tables = Utils.clone(snap.tables);
      this.connections = Utils.clone(snap.connections);
      this.selected = null;
      return true;
    },

    /* ════ Tables ════ */
    addTable(data) {
      this.pushHistory();
      this.tables.push(data);
    },

    removeTable(id) {
      this.pushHistory();
      this.tables = this.tables.filter(t => t.id !== id);
      this.connections = this.connections.filter(
        c => c.fromTableId !== id && c.toTableId !== id
      );
      if (this.selected && this.selected.id === id) this.selected = null;
    },

    getTable(id) {
      return this.tables.find(t => t.id === id) || null;
    },

    updateTable(id, updates) {
      const t = this.getTable(id);
      if (t) Object.assign(t, updates);
      this.isDirty = true;
    },

    /* ════ Columns ════ */
    addColumn(tableId, colData = {}) {
      this.pushHistory();
      const t = this.getTable(tableId);
      if (t) t.columns.push(newColumn(colData));
    },

    removeColumn(tableId, colId) {
      this.pushHistory();
      const t = this.getTable(tableId);
      if (t) t.columns = t.columns.filter(c => c.id !== colId);
    },

    updateColumn(tableId, colId, updates) {
      const t = this.getTable(tableId);
      if (!t) return;
      const col = t.columns.find(c => c.id === colId);
      if (col) Object.assign(col, updates);
      this.isDirty = true;
    },

    reorderColumn(tableId, draggedColId, targetColId, dropAfter) {
      if (draggedColId === targetColId) return;
      const t = this.getTable(tableId);
      if (!t) return;
      const dragIdx = t.columns.findIndex(c => c.id === draggedColId);
      const targetIdx = t.columns.findIndex(c => c.id === targetColId);
      if (dragIdx === -1 || targetIdx === -1) return;

      this.pushHistory();
      const [draggedCol] = t.columns.splice(dragIdx, 1);
      
      // Since we removed an element, the targetIdx might have shifted
      let newIdx = t.columns.findIndex(c => c.id === targetColId);
      if (dropAfter) newIdx += 1;
      
      t.columns.splice(newIdx, 0, draggedCol);
      this.isDirty = true;
    },

    /* ════ Connections ════ */
    addConnection(data) {
      this.pushHistory();
      this.connections.push(data);
    },

    removeConnection(id) {
      this.pushHistory();
      this.connections = this.connections.filter(c => c.id !== id);
      if (this.selected && this.selected.id === id) this.selected = null;
    },

    getConnection(id) {
      return this.connections.find(c => c.id === id) || null;
    },

    updateConnection(id, updates) {
      const c = this.getConnection(id);
      if (c) Object.assign(c, updates);
      this.isDirty = true;
    },

    /* ════ Selection ════ */
    select(type, id) {
      this.selected = id ? { type, id } : null;
    },

    deselect() {
      this.selected = null;
    },

    /* ════ Serialize / Load ════ */
    serialize() {
      return {
        version: '1.0',
        savedAt: Date.now(),
        tables: this.tables,
        connections: this.connections,
        canvas: this.canvas
      };
    },

    load(data) {
      this.tables = data.tables || [];
      this.connections = data.connections || [];
      if (data.canvas) this.canvas = data.canvas;
      this.selected = null;
      this.connectMode = false;
      this.connectStep = 0;
      this.connectSource = null;
      this._history = [this._snapshot()];
      this._histIdx = 0;
      this.isDirty = false;
    },

    /* ════ Clear ════ */
    clear() {
      this.pushHistory();
      this.tables = [];
      this.connections = [];
      this.selected = null;
      this.connectMode = false;
      this.connectStep = 0;
      this.connectSource = null;
      this.canvas = { scale: 1, panX: 0, panY: 0 };
      this.currentFile = null;
    },

    /* ════ Init ════ */
    init() {
      this._history = [this._snapshot()];
      this._histIdx = 0;
    }
  };

  global.AppState = AppState;
})(window);
