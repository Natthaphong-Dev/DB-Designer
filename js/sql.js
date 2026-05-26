/* ════════════════════════════════════════════════════════════
   js/sql.js — SQL Parser + Exporter
   Supports MySQL, PostgreSQL, SQLite DDL
   ════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ═══════════════════ PARSER ═══════════════════ */
  const SqlParser = {

    parse(sql) {
      // Strip comments
      const clean = sql
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

      const tables = [];
      const rawConns = [];

      /* ── CREATE TABLE statements ── */
      const ctRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?(\w+)[`"\]]?\s*\(([^;]+?)\)\s*;/gi;
      let m;
      while ((m = ctRegex.exec(clean)) !== null) {
        const tableName = m[1];
        const body = m[2];
        const parsed = this._parseBody(tableName, body);
        const idx = tables.length;
        const cols = 3;
        tables.push(Object.assign(parsed, {
          id: Utils.uuid(),
          name: tableName,
          type: 'table',
          color: Utils.tableColors[idx % Utils.tableColors.length],
          x: 3800 + (idx % cols) * 290,
          y: 3400 + Math.floor(idx / cols) * 260
        }));
        rawConns.push(...parsed._fks.map(fk => ({
          fromTableName: tableName,
          fromColumn: fk.fromCol,
          toTableName: fk.toTable,
          toColumn: fk.toCol
        })));
        delete parsed._fks;
      }

      /* ── CREATE VIEW statements ── */
      const cvRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+[`"\[]?(\w+)[`"\]]?/gi;
      while ((m = cvRegex.exec(clean)) !== null) {
        const viewName = m[1];
        const idx = tables.length;
        tables.push({
          id: Utils.uuid(),
          name: viewName,
          type: 'view',
          columns: [],
          color: '#10b981', // Green for view
          x: 3800 + (idx % 3) * 290,
          y: 3400 + Math.floor(idx / 3) * 260
        });
      }

      /* ── ALTER TABLE … ADD FOREIGN KEY ── */
      const alterFkRegex = /ALTER\s+TABLE\s+[`"[]?(\w+)[`"\]]?\s+ADD\s+(?:CONSTRAINT\s+[`"[]?\w+[`"\]]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`"[]?(\w+)[`"\]]?\s*\(([^)]+)\)/gi;
      while ((m = alterFkRegex.exec(clean)) !== null) {
        rawConns.push({
          fromTableName: m[1],
          fromColumn: this._stripQuotes(m[2].trim()),
          toTableName: m[3],
          toColumn: this._stripQuotes(m[4].trim())
        });
      }

      /* ── Resolve FK → connection objects ── */
      const connections = rawConns.map(rc => {
        const from = tables.find(t => t.name.toLowerCase() === rc.fromTableName.toLowerCase());
        const to   = tables.find(t => t.name.toLowerCase() === rc.toTableName.toLowerCase());
        if (!from || !to) return null;
        // Mark FK column
        const fkCol = from.columns.find(c => c.name === rc.fromColumn);
        if (fkCol) fkCol.fk = true;
        return AppState.newConnection({
          fromTableId: to.id,
          fromColumn: rc.toColumn,
          toTableId: from.id,
          toColumn: rc.fromColumn,
          type: 'one-to-many',
          label: `fk_${rc.fromColumn}`
        });
      }).filter(Boolean);

      return { tables, connections };
    },

    _parseBody(tableName, body) {
      const columns = [];
      const pks = new Set();
      const uqs = new Set();
      const fks = [];

      const parts = this._splitComma(body);

      for (const raw of parts) {
        const part = raw.trim();
        if (!part) continue;

        // PRIMARY KEY (col, ...)
        const pkM = part.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkM) {
          pkM[1].split(',').forEach(c => pks.add(this._stripQuotes(c.trim())));
          continue;
        }

        // UNIQUE KEY / UNIQUE INDEX
        const uqM = part.match(/^UNIQUE\s+(?:KEY|INDEX)\s+[`"']?\w*[`"']?\s*\(([^)]+)\)/i);
        if (uqM) {
          uqM[1].split(',').forEach(c => uqs.add(this._stripQuotes(c.trim())));
          continue;
        }

        // KEY / INDEX (skip)
        if (/^(?:KEY|INDEX)\s/i.test(part)) continue;

        // FOREIGN KEY (inline or via CONSTRAINT)
        const fkM = part.match(/(?:CONSTRAINT\s+[`"']?\w+[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i);
        if (fkM) {
          fks.push({
            fromCol: this._stripQuotes(fkM[1].trim()),
            toTable: fkM[2],
            toCol: this._stripQuotes(fkM[3].trim())
          });
          continue;
        }

        // Column definition
        const colM = part.match(/^[`"[]?(\w+)[`"\]]?\s+([\s\S]+)/);
        if (!colM) continue;

        const colName = colM[1];
        const rest = colM[2];

        // Extract type (up to first space after optional parens)
        const typeM = rest.match(/^(\w+(?:\s*\([^)]*\))?)/);
        const colType = typeM ? typeM[1].trim().toUpperCase() : 'VARCHAR(255)';

        // Constraints from inline definition
        const nn = /NOT\s+NULL/i.test(rest);
        const ai = /AUTO_INCREMENT|AUTOINCREMENT|SERIAL/i.test(rest);
        const uq = /\bUNIQUE\b/i.test(rest);
        const pk = /\bPRIMARY\s+KEY\b/i.test(rest);

        // DEFAULT value
        const defM = rest.match(/DEFAULT\s+('[^']*'|[^\s,]+)/i);

        columns.push(AppState.newColumn({
          name: colName,
          type: colType,
          pk,
          nn: nn || pk,
          ai,
          uq,
          fk: false,
          defaultVal: defM ? defM[1] : null
        }));

        if (pk) pks.add(colName);
        if (uq) uqs.add(colName);
      }

      // Apply table-level PKs and UQs
      columns.forEach(col => {
        if (pks.has(col.name)) { col.pk = true; col.nn = true; }
        if (uqs.has(col.name)) col.uq = true;
      });

      return { columns, _fks: fks };
    },

    _stripQuotes(s) {
      return s.replace(/^[`"'\[]/, '').replace(/[`"'\]]$/, '');
    },

    _splitComma(str) {
      const parts = [];
      let depth = 0;
      let cur = '';
      for (const ch of str) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
          parts.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      if (cur.trim()) parts.push(cur);
      return parts;
    }
  };

  /* ═══════════════════ EXPORTER ═══════════════════ */
  const SqlExporter = {

    export(tables, connections, dialect = 'mysql') {
      const q = dialect === 'postgresql' ? '"' : '`';
      let sql = `-- Generated by DB Designer\n`;
      sql += `-- Dialect: ${dialect.toUpperCase()}\n`;
      sql += `-- Date: ${new Date().toLocaleString('th-TH')}\n\n`;

      if (dialect === 'mysql') {
        sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
      }

      for (const table of tables) {
        if (table.type === 'note') continue;
        sql += this._tableSQL(table, connections, dialect, q) + '\n\n';
      }

      // ALTER TABLE for MySQL FKs
      if (dialect === 'mysql') {
        for (const conn of connections) {
          const ft = tables.find(t => t.id === conn.fromTableId); // The One side (referenced)
          const tt = tables.find(t => t.id === conn.toTableId);   // The Many side (with FK)
          if (!ft || !tt) continue;
          if (ft.type === 'note' || tt.type === 'note') continue;
          const label = conn.label || `fk_${tt.name}_${conn.toColumn || 'ref'}`;
          
          // toCol is the FK column in the Many table
          const fkColName = conn.toColumn || (tt.columns[0] && tt.columns[0].name) || 'id';
          // fromCol is the PK column in the One table
          const refColName = conn.fromColumn || (ft.columns.find(c => c.pk) || ft.columns[0] || {}).name || 'id';
          
          sql += `ALTER TABLE \`${tt.name}\`\n`;
          sql += `  ADD CONSTRAINT \`${label}\`\n`;
          sql += `  FOREIGN KEY (\`${fkColName}\`)\n`;
          sql += `  REFERENCES \`${ft.name}\` (\`${refColName}\`);\n\n`;
        }
        sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
      }

      return sql.trim();
    },

    _tableSQL(table, connections, dialect, q) {
      const lines = [];

      for (const col of table.columns) {
        let def = `  ${q}${col.name}${q} `;

        if (dialect === 'postgresql' && col.ai) {
          def += col.type === 'BIGINT' ? 'BIGSERIAL' : 'SERIAL';
        } else {
          def += col.type;
          if (col.ai) def += ' AUTO_INCREMENT';
        }

        if (col.nn || col.pk) def += ' NOT NULL';
        if (col.uq && !col.pk) def += ' UNIQUE';
        if (col.defaultVal !== null && col.defaultVal !== undefined) {
          def += ` DEFAULT ${col.defaultVal}`;
        }
        lines.push(def);
      }

      // PRIMARY KEY constraint
      const pkCols = table.columns.filter(c => c.pk);
      if (pkCols.length > 0) {
        lines.push(`  PRIMARY KEY (${pkCols.map(c => `${q}${c.name}${q}`).join(', ')})`);
      }

      // PostgreSQL inline FKs
      if (dialect === 'postgresql') {
        for (const conn of connections) {
          // In Postgres, we want to add the inline FK to the table that HOLDS the FK (the Many side, toTable)
          if (conn.toTableId !== table.id) continue;
          const ft = AppState.tables.find(t => t.id === conn.fromTableId); // The One side (referenced)
          if (!ft) continue;
          const label = conn.label || `fk_${table.name}_${conn.toColumn}`;
          const fkColName = conn.toColumn || '';
          const refColName = conn.fromColumn || '';
          if (fkColName && refColName) {
            lines.push(`  CONSTRAINT "${label}" FOREIGN KEY ("${fkColName}") REFERENCES "${ft.name}" ("${refColName}")`);
          }
        }
      }

      const prefix = table.type === 'view'
        ? `CREATE OR REPLACE VIEW ${q}${table.name}${q} AS\nSELECT * FROM /* source */;\n-- (View DDL below for reference)\nCREATE TABLE`
        : 'CREATE TABLE';

      return `${prefix} ${q}${table.name}${q} (\n${lines.join(',\n')}\n);`;
    }
  };

  global.SqlParser = SqlParser;
  global.SqlExporter = SqlExporter;
})(window);
