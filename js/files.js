/* ════════════════════════════════════════════════════════════
   js/files.js — File/Folder Manager (localStorage)
   ════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const LS_KEY = 'db_designer_files';

  /* ─── Data structure in localStorage ───
  {
    folders: [
      {
        id: 'fld_xxx',
        name: 'My Project',
        createdAt: 1234567890,
        files: [
          {
            id: 'file_xxx',
            name: 'schema.dbdesign',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            data: { version, tables, connections, canvas }
          }
        ]
      }
    ]
  }
  ─────────────────────────────────────── */

  const FileManager = {

    _store: null,

    /* ── Load from localStorage ── */
    load() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        this._store = raw ? JSON.parse(raw) : { folders: [] };
      } catch {
        this._store = { folders: [] };
      }
      return this._store;
    },

    /* ── Persist to localStorage ── */
    save() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this._store));
        return true;
      } catch (e) {
        console.error('FileManager: save failed', e);
        return false;
      }
    },

    /* ── Ensure store is loaded ── */
    _ensure() {
      if (!this._store) this.load();
    },

    /* ═══ Folders ═══ */

    getFolders() {
      this._ensure();
      return this._store.folders;
    },

    getFolder(id) {
      this._ensure();
      return this._store.folders.find(f => f.id === id) || null;
    },

    createFolder(name) {
      this._ensure();
      const folder = {
        id: Utils.uuid(),
        name: name || 'New Folder',
        createdAt: Date.now(),
        files: []
      };
      this._store.folders.push(folder);
      this.save();
      return folder;
    },

    renameFolder(id, name) {
      const f = this.getFolder(id);
      if (f) { f.name = name; this.save(); }
    },

    deleteFolder(id) {
      this._ensure();
      this._store.folders = this._store.folders.filter(f => f.id !== id);
      this.save();
    },

    /* ═══ Files ═══ */

    getFile(folderId, fileId) {
      const folder = this.getFolder(folderId);
      if (!folder) return null;
      return folder.files.find(f => f.id === fileId) || null;
    },

    createFile(folderId, name, data) {
      const folder = this.getFolder(folderId);
      if (!folder) return null;
      const file = {
        id: Utils.uuid(),
        name: name || 'untitled.dbdesign',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: data || {}
      };
      folder.files.push(file);
      this.save();
      return file;
    },

    saveFile(folderId, fileId, data) {
      const file = this.getFile(folderId, fileId);
      if (!file) return false;
      file.data = data;
      file.updatedAt = Date.now();
      this.save();
      return true;
    },

    renameFile(folderId, fileId, name) {
      const file = this.getFile(folderId, fileId);
      if (file) { file.name = name; this.save(); }
    },

    deleteFile(folderId, fileId) {
      const folder = this.getFolder(folderId);
      if (!folder) return;
      folder.files = folder.files.filter(f => f.id !== fileId);
      this.save();
    },

    /* ═══ Quick Save / Load current ═══ */

    saveCurrentFile(data) {
      const cf = AppState.currentFile;
      if (!cf) return false;
      return this.saveFile(cf.folderId, cf.fileId, data);
    },

    /* ═══ Render File Tree ═══ */

    renderTree(container, callbacks = {}) {
      this._ensure();
      container.innerHTML = '';

      if (this._store.folders.length === 0) {
        container.innerHTML = `
          <div style="padding:14px 10px;color:var(--c-text3);font-size:12px;text-align:center;">
            No files yet.<br>Click 📁 to create a folder.
          </div>`;
        return;
      }

      for (const folder of this._store.folders) {
        const folderEl = this._mkFolder(folder, callbacks);
        container.appendChild(folderEl);
      }
    },

    _mkFolder(folder, callbacks) {
      const wrap = document.createElement('div');
      wrap.className = 'file-folder-wrap';

      const hd = document.createElement('div');
      hd.className = 'file-folder';
      hd.dataset.folderId = folder.id;
      hd.innerHTML = `
        <span class="file-folder-toggle">▶</span>
        <span class="file-folder-icon">📁</span>
        <span class="file-name">${Utils.esc(folder.name)}</span>
        <div class="file-actions-row">
          <button class="file-act-btn" data-action="rename-folder" title="Rename">✏️</button>
          <button class="file-act-btn" data-action="delete-folder" title="Delete">🗑</button>
        </div>`;

      hd.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (action === 'rename-folder' && callbacks.onRenameFolder) {
            callbacks.onRenameFolder(folder.id, folder.name);
          } else if (action === 'delete-folder' && callbacks.onDeleteFolder) {
            callbacks.onDeleteFolder(folder.id, folder.name);
          }
          return;
        }
        // Toggle folder open/close
        const isOpenNow = children.style.display === 'block';
        children.style.display = isOpenNow ? 'none' : 'block';
        hd.querySelector('.file-folder-toggle').textContent = isOpenNow ? '▶' : '▼';
        wrap.classList.toggle('open', !isOpenNow);
        hd.classList.toggle('open', !isOpenNow);
      });

      const children = document.createElement('div');
      children.className = 'file-children';
      children.style.paddingLeft = '14px';

      // Always open folders by default so users can see their files immediately
      const isOpen = true; 
      
      children.style.display = isOpen ? 'block' : 'none';
      if (isOpen) {
        wrap.classList.add('open');
        hd.classList.add('open');
      }

      const toggleIcon = hd.querySelector('.file-folder-toggle');
      toggleIcon.textContent = isOpen ? '▼' : '▶';

      // File items
      for (const file of folder.files) {
        const fileEl = this._mkFile(folder.id, file, callbacks);
        children.appendChild(fileEl);
      }

      // Add file button
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-add-col-row';
      addBtn.style.margin = '4px 0';
      addBtn.textContent = '+ New File';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks.onNewFile) callbacks.onNewFile(folder.id);
      });
      children.appendChild(addBtn);

      wrap.appendChild(hd);
      wrap.appendChild(children);
      return wrap;
    },

    _mkFile(folderId, file, callbacks) {
      const el = document.createElement('div');
      el.className = 'file-item';
      el.dataset.folderId = folderId;
      el.dataset.fileId = file.id;

      const cf = AppState.currentFile;
      if (cf && cf.folderId === folderId && cf.fileId === file.id) {
        el.classList.add('active');
      }

      el.innerHTML = `
        <span style="font-size:13px">📄</span>
        <span class="file-name" title="${Utils.esc(file.name)}">${Utils.esc(file.name)}</span>
        <div class="file-actions-row">
          <button class="file-act-btn" data-action="rename-file" title="Rename">✏️</button>
          <button class="file-act-btn" data-action="delete-file" title="Delete">🗑</button>
        </div>`;

      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (action === 'rename-file' && callbacks.onRenameFile) {
            callbacks.onRenameFile(folderId, file.id, file.name);
          } else if (action === 'delete-file' && callbacks.onDeleteFile) {
            callbacks.onDeleteFile(folderId, file.id, file.name);
          }
          return;
        }
        if (callbacks.onOpenFile) callbacks.onOpenFile(folderId, file.id, file.name, file.data);
      });

      return el;
    }
  };

  global.FileManager = FileManager;
})(window);
