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
    }
  };

  /* ═══════════════════ DJANGO PARSER ═══════════════════ */
  const DjangoParser = {
    _typeMap: {
      'CharField': 'VARCHAR(255)',
      'TextField': 'TEXT',
      'IntegerField': 'INT',
      'BigIntegerField': 'BIGINT',
      'SmallIntegerField': 'SMALLINT',
      'FloatField': 'FLOAT',
      'DecimalField': 'DECIMAL',
      'BooleanField': 'BOOLEAN',
      'DateField': 'DATE',
      'DateTimeField': 'DATETIME',
      'TimeField': 'TIME',
      'JSONField': 'JSON',
      'BinaryField': 'BLOB',
      'UUIDField': 'UUID',
      'EmailField': 'VARCHAR(255)',
      'AutoField': 'INT',
      'BigAutoField': 'BIGINT'
    },

    parse(code) {
      // Remove python comments
      const clean = code.replace(/#.*$/gm, '').trim();
      const tables = [];
      const rawConns = [];

      // Split code by top-level "class " to parse class by class
      const classBlocks = clean.split(/^class\s+/m).filter(b => b.trim());

      let idx = 0;
      for (const block of classBlocks) {
        // Match ModelName(models.Model):
        const classMatch = block.match(/^(\w+)(?:\([^)]*\))?:/);
        if (!classMatch) continue;
        const className = classMatch[1];
        
        // Skip Meta or other non-models
        if (className === 'Meta') continue;

        const tableName = this._toTableName(className);
        const parsed = this._parseModelBody(tableName, block);

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
          toTableName: this._toTableName(fk.toClass),
          toColumn: 'id' // Default PK in Django is usually 'id'
        })));

        delete parsed._fks;
        idx++;
      }

      // Resolve connections
      const connections = rawConns.map(rc => {
        const from = tables.find(t => t.name.toLowerCase() === rc.fromTableName.toLowerCase());
        const to   = tables.find(t => t.name.toLowerCase() === rc.toTableName.toLowerCase());
        if (!from || !to) return null;
        
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

    _toTableName(className) {
      // PascalCase to snake_case and basic pluralization
      let snake = className.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
      if (!snake.endsWith('s')) {
        if (snake.endsWith('y')) snake = snake.slice(0, -1) + 'ies';
        else if (!snake.endsWith('ss')) snake += 's';
      }
      return snake;
    },

    _parseModelBody(tableName, body) {
      const columns = [];
      const fks = [];
      const lines = body.split('\n');
      
      let hasPk = false;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        // Skip methods, nested classes, and empty lines
        if (!line || line.startsWith('def ') || line.startsWith('class ')) continue;

        // Match: field_name = models.FieldType(...)
        const fieldMatch = line.match(/^(\w+)\s*=\s*models\.(\w+)\((.*)\)/);
        if (fieldMatch) {
          const colName = fieldMatch[1];
          const fieldType = fieldMatch[2];
          const args = fieldMatch[3];

          // Handle Foreign Keys
          if (fieldType === 'ForeignKey' || fieldType === 'OneToOneField') {
            const targetMatch = args.match(/^['"]?(\w+)['"]?/);
            if (targetMatch) {
              fks.push({
                fromCol: colName,
                toClass: targetMatch[1] // The related Model name
              });
              
              const nn = !args.includes('null=True');
              columns.push(AppState.newColumn({
                name: colName,
                type: 'INT',
                pk: false,
                nn: nn,
                ai: false,
                uq: fieldType === 'OneToOneField',
                fk: true,
                defaultVal: null
              }));
              continue;
            }
          }

          // Regular Fields
          let colType = this._typeMap[fieldType] || 'VARCHAR(255)';
          
          if (fieldType === 'CharField' || fieldType === 'EmailField') {
            const m = args.match(/max_length\s*=\s*(\d+)/);
            if (m) colType = `VARCHAR(${m[1]})`;
          } else if (fieldType === 'DecimalField') {
            const mdMatch = args.match(/max_digits\s*=\s*(\d+)/);
            const dpMatch = args.match(/decimal_places\s*=\s*(\d+)/);
            if (mdMatch && dpMatch) {
              colType = `DECIMAL(${mdMatch[1]}, ${dpMatch[1]})`;
            }
          }

          const pk = args.includes('primary_key=True');
          const nn = !(args.includes('null=True') || args.includes('blank=True'));
          const uq = args.includes('unique=True');
          const ai = fieldType === 'AutoField' || fieldType === 'BigAutoField';

          let defaultVal = null;
          const defMatch = args.match(/default\s*=\s*([^,)]+)/);
          if (defMatch) {
            defaultVal = defMatch[1].trim();
            if (defaultVal === 'timezone.now') defaultVal = 'CURRENT_TIMESTAMP';
          }

          if (pk) hasPk = true;

          columns.push(AppState.newColumn({
            name: colName,
            type: colType,
            pk,
            nn: nn || pk,
            ai,
            uq,
            fk: false,
            defaultVal
          }));
        }
      }

      // Django automatically adds an 'id' primary key if none is specified
      if (!hasPk) {
        columns.unshift(AppState.newColumn({
          name: 'id',
          type: 'INT',
          pk: true,
          nn: true,
          ai: true,
          uq: false,
          fk: false,
          defaultVal: null
        }));
      }

      return { columns, _fks: fks };
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

  /* ═══════════════════ DJANGO EXPORTER ═══════════════════ */
  const DjangoExporter = {

    /* ── SQL Type → Django Field Mapping ── */
    _fieldMap: {
      'INT':        { field: 'IntegerField',      args: {} },
      'INTEGER':    { field: 'IntegerField',      args: {} },
      'BIGINT':     { field: 'BigIntegerField',   args: {} },
      'SMALLINT':   { field: 'SmallIntegerField', args: {} },
      'TINYINT':    { field: 'SmallIntegerField', args: {} },
      'FLOAT':      { field: 'FloatField',        args: {} },
      'DOUBLE':     { field: 'FloatField',        args: {} },
      'DECIMAL':    { field: 'DecimalField',      args: { max_digits: 10, decimal_places: 2 } },
      'VARCHAR':    { field: 'CharField',         args: { max_length: 255 } },
      'CHAR':       { field: 'CharField',         args: { max_length: 255 } },
      'TEXT':       { field: 'TextField',         args: {} },
      'LONGTEXT':   { field: 'TextField',         args: {} },
      'MEDIUMTEXT': { field: 'TextField',         args: {} },
      'BOOLEAN':    { field: 'BooleanField',      args: { default: 'False' } },
      'BOOL':       { field: 'BooleanField',      args: { default: 'False' } },
      'DATE':       { field: 'DateField',         args: {} },
      'DATETIME':   { field: 'DateTimeField',     args: {} },
      'TIMESTAMP':  { field: 'DateTimeField',     args: {} },
      'TIME':       { field: 'TimeField',         args: {} },
      'JSON':       { field: 'JSONField',         args: {} },
      'JSONB':      { field: 'JSONField',         args: {} },
      'BLOB':       { field: 'BinaryField',       args: {} },
      'UUID':       { field: 'UUIDField',         args: {} },
      'EMAIL':      { field: 'EmailField',        args: {} },
      'SERIAL':     { field: 'AutoField',         args: {} },
      'BIGSERIAL':  { field: 'BigAutoField',      args: {} },
    },

    /* ── Main Export Function ── */
    export(tables, connections) {
      let code = '';

      // ── Imports ──
      code += 'from django.db import models\n';
      code += 'from django.utils import timezone\n';
      code += '\n';
      code += '\n';

      // ── Build table name → class name map ──
      const classNameMap = {};
      for (const table of tables) {
        if (table.type === 'note') continue;
        classNameMap[table.name] = this._toClassName(table.name);
      }

      // ── Generate each model ──
      for (const table of tables) {
        if (table.type === 'note') continue;
        code += this._modelCode(table, connections, tables, classNameMap);
        code += '\n';
      }

      return code.trimEnd() + '\n';
    },

    /* ── Convert table_name → ClassName (PascalCase, singular) ── */
    _toClassName(name) {
      // Remove trailing 's' for simple plural (basic singularization)
      let singular = name;
      if (singular.endsWith('ies')) {
        singular = singular.slice(0, -3) + 'y';
      } else if (singular.endsWith('ses') || singular.endsWith('xes') || singular.endsWith('zes') || singular.endsWith('ches') || singular.endsWith('shes')) {
        singular = singular.slice(0, -2);
      } else if (singular.endsWith('s') && !singular.endsWith('ss') && !singular.endsWith('us')) {
        singular = singular.slice(0, -1);
      }

      // snake_case → PascalCase
      return singular
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('');
    },

    /* ── Generate a single model class ── */
    _modelCode(table, connections, allTables, classNameMap) {
      const className = classNameMap[table.name];
      const indent = '    ';
      let code = '';

      // ── Comment block ──
      code += `# ${'-'.repeat(40)}\n`;
      code += `# ${className}\n`;
      code += `# ${'-'.repeat(40)}\n`;

      // ── Class declaration ──
      code += `class ${className}(models.Model):\n`;

      // ── Find FK connections TO this table (this table holds the FK column) ──
      const fkConns = connections.filter(c => c.toTableId === table.id);
      const fkColNames = new Set(fkConns.map(c => c.toColumn).filter(Boolean));

      // ── Fields ──
      let hasFields = false;
      for (const col of table.columns) {
        // Skip auto-increment PK (Django adds it automatically)
        if (col.pk && col.ai) continue;

        // Check if this column is a FK
        if (fkColNames.has(col.name)) {
          // Find the connection for this FK column
          const fkConn = fkConns.find(c => c.toColumn === col.name);
          if (fkConn) {
            const refTable = allTables.find(t => t.id === fkConn.fromTableId);
            if (refTable) {
              const refClassName = classNameMap[refTable.name];
              const relatedName = this._toRelatedName(table.name);

              // Determine on_delete
              const onDelete = col.nn ? 'models.CASCADE' : 'models.SET_NULL';

              code += `${indent}${col.name} = models.ForeignKey(\n`;
              code += `${indent}${indent}${refClassName},\n`;
              code += `${indent}${indent}on_delete=${onDelete},\n`;
              if (!col.nn) {
                code += `${indent}${indent}null=True,\n`;
                code += `${indent}${indent}blank=True,\n`;
              }
              code += `${indent}${indent}related_name='${relatedName}'\n`;
              code += `${indent})\n`;
              hasFields = true;
              continue;
            }
          }
        }

        // Regular field
        code += `${indent}${this._fieldLine(col)}`;
        hasFields = true;
      }

      // ── Auto-add created_at / updated_at if not present ──
      const colNames = table.columns.map(c => c.name.toLowerCase());
      if (!colNames.includes('created_at')) {
        code += `${indent}created_at = models.DateTimeField(default=timezone.now)\n`;
        hasFields = true;
      }
      if (!colNames.includes('updated_at')) {
        code += `${indent}updated_at = models.DateTimeField(auto_now=True)\n`;
        hasFields = true;
      }

      if (!hasFields) {
        code += `${indent}pass\n`;
      }

      // ── __str__ method ──
      code += `\n${indent}def __str__(self):\n`;
      const strField = this._findStrField(table);
      code += `${indent}${indent}return self.${strField}\n`;

      // ── Meta class (unique constraints) ──
      const uqCols = table.columns.filter(c => c.uq && !c.pk);
      if (uqCols.length > 0) {
        code += `\n${indent}class Meta:\n`;
        code += `${indent}${indent}constraints = [\n`;
        for (const uqCol of uqCols) {
          const constraintName = `unique_${table.name}_${uqCol.name}`;
          code += `${indent}${indent}${indent}models.UniqueConstraint(\n`;
          code += `${indent}${indent}${indent}${indent}fields=['${uqCol.name}'],\n`;
          code += `${indent}${indent}${indent}${indent}name='${constraintName}'\n`;
          code += `${indent}${indent}${indent}),\n`;
        }
        code += `${indent}${indent}]\n`;
      }

      code += '\n';
      return code;
    },

    /* ── Generate a field line ── */
    _fieldLine(col) {
      // Parse type: VARCHAR(100) → base=VARCHAR, params=100
      const typeMatch = (col.type || 'VARCHAR(255)').match(/^(\w+)(?:\(([^)]*)\))?$/);
      const baseType = typeMatch ? typeMatch[1].toUpperCase() : 'VARCHAR';
      const typeParams = typeMatch ? typeMatch[2] : null;

      const mapping = this._fieldMap[baseType] || { field: 'CharField', args: { max_length: 255 } };
      let fieldType = mapping.field;
      const fieldArgs = Object.assign({}, mapping.args);

      // ── Handle special cases ──

      // PK field (non auto-increment)
      if (col.pk && !col.ai) {
        fieldArgs.primary_key = 'True';
      }

      // CharField with max_length from type params
      if ((fieldType === 'CharField' || fieldType === 'EmailField') && typeParams) {
        fieldArgs.max_length = parseInt(typeParams) || 255;
      }

      // DecimalField with precision
      if (fieldType === 'DecimalField' && typeParams) {
        const parts = typeParams.split(',').map(s => parseInt(s.trim()));
        if (parts.length >= 2) {
          fieldArgs.max_digits = parts[0];
          fieldArgs.decimal_places = parts[1];
        } else if (parts.length === 1) {
          fieldArgs.max_digits = parts[0];
          fieldArgs.decimal_places = 2;
        }
      }

      // NOT NULL / nullable
      if (!col.nn && !col.pk) {
        fieldArgs.null = 'True';
        fieldArgs.blank = 'True';
      }

      // UNIQUE
      if (col.uq && !col.pk) {
        fieldArgs.unique = 'True';
      }

      // DEFAULT value
      if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal !== '') {
        const dv = col.defaultVal;
        // Handle common defaults
        if (dv.toUpperCase() === 'CURRENT_TIMESTAMP' || dv.toUpperCase() === 'NOW()') {
          fieldArgs.default = 'timezone.now';
        } else if (dv === '0' || dv === '1') {
          if (fieldType === 'BooleanField') {
            fieldArgs.default = dv === '1' ? 'True' : 'False';
          } else {
            fieldArgs.default = dv;
          }
        } else if (dv.startsWith("'") && dv.endsWith("'")) {
          fieldArgs.default = dv;
        } else if (!isNaN(dv)) {
          fieldArgs.default = dv;
        } else {
          fieldArgs.default = `'${dv}'`;
        }
      }

      // ── Build args string ──
      const argsStr = this._buildArgs(fieldArgs, fieldType);

      return `${col.name} = models.${fieldType}(${argsStr})\n`;
    },

    /* ── Build arguments string ── */
    _buildArgs(args, fieldType) {
      const parts = [];
      // Define argument order
      const order = ['max_length', 'max_digits', 'decimal_places', 'primary_key', 'unique', 'null', 'blank', 'default'];
      
      for (const key of order) {
        if (args[key] !== undefined) {
          const val = args[key];
          // Don't quote Python keywords and special values
          if (typeof val === 'string' && (val === 'True' || val === 'False' || val === 'None' || val === 'timezone.now' || val === 'list' || val === 'dict')) {
            parts.push(`${key}=${val}`);
          } else if (typeof val === 'number') {
            parts.push(`${key}=${val}`);
          } else {
            parts.push(`${key}=${val}`);
          }
        }
      }
      
      // Any remaining args not in order
      for (const [key, val] of Object.entries(args)) {
        if (!order.includes(key)) {
          parts.push(`${key}=${val}`);
        }
      }

      // Multi-line if too long
      if (parts.length > 2 || parts.join(', ').length > 50) {
        return '\n        ' + parts.join(',\n        ') + '\n    ';
      }
      return parts.join(', ');
    },

    /* ── Find the best field for __str__ ── */
    _findStrField(table) {
      const nameFields = ['name', 'title', 'username', 'user_name', 'full_name',
                          'email', 'code', 'label', 'description'];
      
      // Check for common name patterns
      for (const col of table.columns) {
        const lower = col.name.toLowerCase();
        if (nameFields.includes(lower)) return col.name;
        if (lower.endsWith('_name') || lower.endsWith('_title')) return col.name;
      }
      
      // Check for any CharField/TextField that's not a FK
      for (const col of table.columns) {
        const baseType = (col.type || '').replace(/\(.*\)/, '').toUpperCase();
        if ((baseType === 'VARCHAR' || baseType === 'CHAR' || baseType === 'TEXT') && !col.fk) {
          return col.name;
        }
      }

      // Fallback to first non-PK column or PK
      const nonPk = table.columns.find(c => !c.pk);
      return nonPk ? nonPk.name : (table.columns[0]?.name || 'id');
    },

    /* ── Generate related_name from table name ── */
    _toRelatedName(tableName) {
      // products → products, order_items → order_items
      return tableName.toLowerCase();
    }
  };

  global.SqlParser = SqlParser;
  global.DjangoParser = DjangoParser;
  global.SqlExporter = SqlExporter;
  global.DjangoExporter = DjangoExporter;
})(window);
