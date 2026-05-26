/* ════════════════════════════════════════════════════════════
   js/utils.js — Utility Functions
   ════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const Utils = {
    /* ── UUID ── */
    uuid() {
      return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    },

    /* ── Math ── */
    clamp(val, min, max) { return Math.max(min, Math.min(max, val)); },

    lerp(a, b, t) { return a + (b - a) * t; },

    dist(x1, y1, x2, y2) {
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    /* ── Deep clone ── */
    clone(obj) { return JSON.parse(JSON.stringify(obj)); },

    /* ── Escape HTML ── */
    esc(str) {
      const d = document.createElement('div');
      d.appendChild(document.createTextNode(String(str)));
      return d.innerHTML;
    },

    /* ── Table color palette ── */
    tableColors: [
      '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
      '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
      '#84cc16', '#f97316'
    ],

    randomColor() {
      return this.tableColors[Math.floor(Math.random() * this.tableColors.length)];
    },

    /* ── Common SQL types ── */
    sqlTypes: [
      'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
      'FLOAT', 'DOUBLE', 'DECIMAL',
      'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT',
      'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
      'JSON', 'BLOB', 'UUID'
    ],

    /* ── Lightened version of hex color ── */
    lighten(hex, amount = 40) {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, (num >> 16) + amount);
      const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
      const b = Math.min(255, (num & 0x0000FF) + amount);
      return `rgb(${r},${g},${b})`;
    },

    /* ── Format date ── */
    formatDate(ts) {
      return new Date(ts).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    },

    /* ── Download text ── */
    download(filename, content, mime = 'text/plain') {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },

    /* ── Read file as text ── */
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },

    /* ── Debounce ── */
    debounce(fn, delay) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
      };
    }
  };

  global.Utils = Utils;
})(window);
