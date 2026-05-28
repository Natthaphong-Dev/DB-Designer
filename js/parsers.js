/**
 * Multi-Framework Parsers for DB Designer
 * Parses framework-specific code back into Canvas tables with Foreign Key connections.
 */

(function(global) {
  const Utils = global.Utils || {
    uuid: () => Math.random().toString(36).substring(2, 9),
    tableColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
    sqlTypes: ['INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'DECIMAL', 'JSON']
  };

  const AppState = global.AppState || {
    newColumn: (opts) => Object.assign({ id: Utils.uuid(), name: '', type: 'VARCHAR(255)', pk: false, nn: false, uq: false, ai: false, fk: false, defaultVal: null }, opts),
    newConnection: (opts) => Object.assign({ id: Utils.uuid(), fromTableId: '', fromColumn: '', toTableId: '', toColumn: '', type: 'one-to-many', label: '' }, opts)
  };

  // Base utilities
  function _createTable(name, columns, idx) {
    return {
      id: Utils.uuid(),
      name: name,
      type: 'table',
      color: Utils.tableColors[idx % Utils.tableColors.length],
      x: 50 + (idx * 20),
      y: 50 + (idx * 20),
      columns: columns,
      note: ''
    };
  }

  function _resolveConnections(tables, rawConns) {
    const connections = [];
    for (const rc of rawConns) {
      // Find source table (the one with the FK column)
      const fromTable = tables.find(t => t.name.toLowerCase() === rc.fromTableName.toLowerCase());
      
      // Find target table (can be plural or singular in various frameworks)
      let toTable = tables.find(t => t.name.toLowerCase() === rc.toTableName.toLowerCase());
      if (!toTable) {
        // Try with 's' or without 's'
        const altName1 = rc.toTableName.toLowerCase() + 's';
        const altName2 = rc.toTableName.toLowerCase().replace(/s$/, '');
        const altName3 = rc.toTableName.toLowerCase().replace(/ys$/, 'ies'); // Handle categorys -> categories
        const altName4 = rc.toTableName.toLowerCase().replace(/ies$/, 'ys'); // Handle categories -> categorys (just in case)
        toTable = tables.find(t => {
          const name = t.name.toLowerCase();
          return name === altName1 || name === altName2 || name === altName3 || name === altName4;
        });
      }

      if (!fromTable || !toTable) continue;
      
      const fkCol = fromTable.columns.find(c => c.name.toLowerCase() === rc.fromColumn.toLowerCase());
      if (fkCol) fkCol.fk = true;
      
      const isM2M = rc.type === 'many-to-many';
      
      // Deduplicate connections
      if (isM2M) {
         const exists = connections.find(c => 
            (c.fromTableId === toTable.id && c.toTableId === fromTable.id) ||
            (c.fromTableId === fromTable.id && c.toTableId === toTable.id)
         );
         if (exists) continue; // Already handled
      } else {
         const exists = connections.find(c =>
            c.fromTableId === toTable.id && c.toTableId === fromTable.id &&
            c.fromColumn === rc.toColumn && c.toColumn === rc.fromColumn
         );
         if (exists) continue;
      }
      
      const isOneToOne = fkCol && fkCol.uq;
      
      // For M2M: fromTable = the table that declares the relation (e.g. Branch)
      //          toTable   = the target table (e.g. User)
      // Keep them in original order (no swap) for M2M
      // For 1:N / 1:1: swap so that fromTableId = One side (referenced), toTableId = Many side (FK holder)
      if (isM2M) {
        connections.push(AppState.newConnection({
          fromTableId: fromTable.id, // source table (e.g. Branch)
          fromColumn: 'id',
          toTableId: toTable.id,     // target table (e.g. User)
          toColumn: 'id',
          type: 'many-to-many',
          label: 'm:n'
        }));
      } else {
        connections.push(AppState.newConnection({
          fromTableId: toTable.id, // One side (referenced)
          fromColumn: rc.toColumn || 'id',
          toTableId: fromTable.id, // Many side (FK holder)
          toColumn: rc.fromColumn || 'id',
          type: isOneToOne ? 'one-to-one' : 'one-to-many',
          label: isOneToOne ? '1:1' : `fk_${rc.fromColumn}`
        }));
      }

    }
    
    // Cleanup step: remove M2M connections if a 1:N or 1:1 connection already exists between the same tables
    const finalConnections = connections.filter(c => {
       if (c.type === 'many-to-many') {
          return !connections.find(other => 
             other.type !== 'many-to-many' &&
             ((other.fromTableId === c.fromTableId && other.toTableId === c.toTableId) ||
              (other.fromTableId === c.toTableId && other.toTableId === c.fromTableId))
          );
       }
       return true;
    });
    
    return finalConnections;
  }

  /* ═══════════════════ PRISMA PARSER ═══════════════════ */
  const PrismaParser = {
    _typeMap: {
      'Int': 'INT',
      'String': 'VARCHAR(255)',
      'Boolean': 'BOOLEAN',
      'DateTime': 'DATETIME',
      'Float': 'FLOAT',
      'Decimal': 'DECIMAL',
      'Json': 'JSON',
      'BigInt': 'BIGINT'
    },
    parse(code) {
      const tables = [];
      const rawConns = [];
      const regex = /model\s+(\w+)\s*\{([^}]*)\}/g;
      let match, idx = 0;
      
      while ((match = regex.exec(code)) !== null) {
        const tableName = match[1];
        const body = match[2];
        const columns = [];
        
        let cleanBody = body;
        const relRegex = /(\w+)\s+(\w+)(?:\[\]|\?)?\s*@relation\s*\(\s*fields:\s*\[([^\]]+)\],\s*references:\s*\[([^\]]+)\]\s*\)/g;
        let rm;
        while ((rm = relRegex.exec(body)) !== null) {
          rawConns.push({
            fromTableName: tableName,
            fromColumn: rm[3].trim(),
            toTableName: rm[2].trim(),
            toColumn: rm[4].trim(),
            type: 'one-to-many' // will be resolved to 1:1 in _resolveConnections if needed
          });
          cleanBody = cleanBody.replace(rm[0], ''); // Remove relation block from body
        }

        const lines = cleanBody.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
        for (const line of lines) {
          if (line.startsWith('@@')) continue;
          
          const parts = line.split(/\s+/);
          if (parts.length < 2) continue;
          
          const colName = parts[0];
          const colRawType = parts[1].replace('?', '').replace('[]', '');
          
          if (!this._typeMap[colRawType] && /^[A-Z]/.test(colRawType)) {
             if (parts[1].includes('[]')) {
               rawConns.push({
                 fromTableName: tableName,
                 fromColumn: 'id',
                 toTableName: colRawType,
                 toColumn: 'id',
                 type: 'many-to-many'
               });
             } else if (parts[1].includes('?')) {
               // Usually the side without @relation in 1:1, or it could just be missing @relation. We let resolveConnections handle it.
             }
             continue;
          }

          let type = this._typeMap[colRawType] || 'VARCHAR(255)';
          const pk = line.includes('@id');
          const uq = line.includes('@unique');
          const ai = line.includes('@default(autoincrement())');
          const nn = !parts[1].includes('?');

          columns.push(AppState.newColumn({ name: colName, type, pk, nn: nn || pk, ai, uq }));
        }
        tables.push(_createTable(tableName, columns, idx++));
      }
      return { tables, connections: _resolveConnections(tables, rawConns) };
    }
  };

  /* ═══════════════════ SQLALCHEMY PARSER ═══════════════════ */
  const SqlAlchemyParser = {
    _typeMap: {
      'Integer': 'INT',
      'String': 'VARCHAR(255)',
      'Text': 'TEXT',
      'Boolean': 'BOOLEAN',
      'DateTime': 'DATETIME',
      'Date': 'DATE',
      'Float': 'FLOAT',
      'JSON': 'JSON',
      'BigInteger': 'BIGINT'
    },
    parse(code) {
      const clean = code.replace(/#.*$/gm, '').trim();
      const tables = [];
      const rawConns = [];
      const classBlocks = clean.split(/^class\s+/m).filter(b => b.trim());

      let idx = 0;
      for (const block of classBlocks) {
        const classMatch = block.match(/^(\w+)(?:\([^)]*\))?:/);
        if (!classMatch) continue;
        const className = classMatch[1];
        
        const tnMatch = block.match(/__tablename__\s*=\s*['"]([^'"]+)['"]/);
        const tableName = tnMatch ? tnMatch[1] : className.toLowerCase();
        
        const columns = [];
        
        // Check for M2M relationship(secondary='table')
        const relRegex = /Mapped\[(?:List\[)?['"]?(\w+)['"]?\]?\]?\s*=\s*relationship\s*\([^)]*secondary\s*=\s*['"]([^'"]+)['"][^)]*\)/g;
        let relMatch;
        while ((relMatch = relRegex.exec(block)) !== null) {
          rawConns.push({
            fromTableName: tableName,
            fromColumn: 'id',
            toTableName: relMatch[1],
            toColumn: 'id',
            type: 'many-to-many'
          });
        }
        
        const colRegex = /(\w+)(?:\s*:\s*[^=]+)?\s*=\s*(?:mapped_column|Column)\s*\(([\s\S]*?)\)(?:\s*(?:#.*)?\n|\s*$)/g;
        let m;
        while ((m = colRegex.exec(block)) !== null) {
          const colName = m[1];
          const args = m[2];
          
          // Check for ForeignKey('table.id')
          const fkMatch = args.match(/ForeignKey\s*\(\s*['"]([^.]+)\.([^'"]+)['"]/);
          if (fkMatch) {
            rawConns.push({
              fromTableName: tableName,
              fromColumn: colName,
              toTableName: fkMatch[1],
              toColumn: fkMatch[2]
            });
          }

          const typeMatch = args.match(/^([A-Za-z_]+)/);
          let rawType = typeMatch ? typeMatch[1] : 'String';
          let type = this._typeMap[rawType] || 'VARCHAR(255)';
          
          const lenMatch = args.match(/String\s*\(\s*(\d+)\s*\)/);
          if (lenMatch) type = `VARCHAR(${lenMatch[1]})`;

          const pk = args.includes('primary_key=True');
          const uq = args.includes('unique=True');
          const nn = pk || args.includes('nullable=False');

          columns.push(AppState.newColumn({ name: colName, type, pk, nn, uq }));
        }
        if (columns.length > 0) {
          tables.push(_createTable(tableName, columns, idx++));
        }
      }
      return { tables, connections: _resolveConnections(tables, rawConns) };
    }
  };

  /* ═══════════════════ TYPEORM PARSER ═══════════════════ */
  const TypeOrmParser = {
    _typeMap: {
      'number': 'INT',
      'string': 'VARCHAR(255)',
      'boolean': 'BOOLEAN',
      'Date': 'DATETIME',
      'any': 'JSON'
    },
    parse(code) {
      const tables = [];
      const rawConns = [];
      const blocks = code.split(/@Entity[^(]*\([^)]*\)/).filter(b => b.includes('class '));
      let idx = 0;

      for (const block of blocks) {
        const classMatch = block.match(/class\s+(\w+)/);
        if (!classMatch) continue;
        const tableName = classMatch[1];

        const columns = [];
        
        // Parse basic columns
        const colRegex = /@(PrimaryGeneratedColumn|Column|PrimaryColumn)\s*\(([^)]*)\)[\s\S]*?(?:public\s+|private\s+|protected\s+)?(\w+)\s*[:!]+\s*([\w]+)/g;
        let m;
        while ((m = colRegex.exec(block)) !== null) {
          const decorator = m[1];
          const args = m[2];
          const colName = m[3];
          const rawType = m[4];

          let type = this._typeMap[rawType] || 'VARCHAR(255)';
          const pk = decorator.includes('Primary');
          const ai = decorator === 'PrimaryGeneratedColumn';
          const uq = args.includes('unique: true');
          const nn = pk || !args.includes('nullable: true');

          columns.push(AppState.newColumn({ name: colName, type, pk, nn, ai, uq }));
        }
        
        // Parse relations: @ManyToOne/@OneToOne followed by @JoinColumn
        // Strategy: find each @JoinColumn and look backwards for the relation decorator
        const joinColRegex2 = /@JoinColumn\s*\(\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?\}\s*\)\s*\n\s*(?:public\s+|private\s+|protected\s+)?(\w+)\s*:/g;
        const joinColResults = [];
        let jc2;
        while ((jc2 = joinColRegex2.exec(block)) !== null) {
          joinColResults.push({ colName: jc2[1], propName: jc2[2], index: jc2.index });
        }

        const relRegex = /@(ManyToOne|OneToOne)\s*\(\s*\(\)\s*=>\s*(\w+)[^)]*\)/g;
        let r;
        while ((r = relRegex.exec(block)) !== null) {
          const relType = r[1];
          const targetClass = r[2];
          const relEnd = r.index + r[0].length;
          
          // Find the JoinColumn that comes right after this relation decorator
          const nextJc = joinColResults.find(jcr => jcr.index >= relEnd && jcr.index < relEnd + 200);
          
          let colName;
          if (nextJc) {
            colName = nextJc.colName;
          } else {
            // Fallback: find the property name after this decorator
            const afterRel = block.substring(relEnd);
            const propMatch = afterRel.match(/(?:@\w+[^;]*\n)*\s*(?:public\s+|private\s+|protected\s+)?(\w+)\s*:/);
            const propName = propMatch ? propMatch[1] : 'unknown';
            colName = propName + 'Id';
          }
          
          rawConns.push({
            fromTableName: tableName,
            fromColumn: colName,
            toTableName: targetClass,
            toColumn: 'id',
            type: relType === 'OneToOne' ? 'one-to-one' : 'one-to-many'
          });
          
          // Ensure the FK column exists in the table if it wasn't explicitly defined via @Column
          if (!columns.find(c => c.name === colName)) {
            columns.push(AppState.newColumn({ name: colName, type: 'INT', fk: true }));
          }
        }
        
        // Parse ManyToMany
        const m2mRegex = /@ManyToMany\s*\(\s*\(\)\s*=>\s*(\w+)[^)]*\)[\s\S]*?(?:public\s+|private\s+|protected\s+)?(\w+)\s*:/g;
        let m2m;
        while ((m2m = m2mRegex.exec(block)) !== null) {
          rawConns.push({
            fromTableName: tableName,
            fromColumn: 'id',
            toTableName: m2m[1],
            toColumn: 'id',
            type: 'many-to-many'
          });
        }

        if (columns.length > 0) tables.push(_createTable(tableName, columns, idx++));
      }
      return { tables, connections: _resolveConnections(tables, rawConns) };
    }
  };

  /* ═══════════════════ GORM PARSER ═══════════════════ */
  const GormParser = {
    _typeMap: {
      'uint': 'INT',
      'int': 'INT',
      'int64': 'BIGINT',
      'string': 'VARCHAR(255)',
      'bool': 'BOOLEAN',
      'time.Time': 'DATETIME',
      'float32': 'FLOAT',
      'float64': 'DOUBLE'
    },
    parse(code) {
      const tables = [];
      const rawConns = [];
      const blocks = code.split(/type\s+(\w+)\s+struct\s*\{/);
      let idx = 0;

      for (let i = 1; i < blocks.length; i += 2) {
        const className = blocks[i];
        const bodyMatch = blocks[i+1].match(/^([^}]*)\}/);
        if (!bodyMatch) continue;
        const body = bodyMatch[1];
        
        // Try to get actual table name from TableName() function
        const tableNameMatch = blocks[i+1].match(/TableName\(\)\s+string\s*\{[^}]*return\s+"([^"]+)"/);
        const tableName = tableNameMatch ? tableNameMatch[1] : className.toLowerCase() + 's';
        const columns = [];
        const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

        for (const line of lines) {
          if (line.includes('gorm.Model')) {
            columns.push(AppState.newColumn({ name: 'id', type: 'INT', pk: true, ai: true }));
            columns.push(AppState.newColumn({ name: 'created_at', type: 'DATETIME' }));
            columns.push(AppState.newColumn({ name: 'updated_at', type: 'DATETIME' }));
            columns.push(AppState.newColumn({ name: 'deleted_at', type: 'DATETIME' }));
            continue;
          }

          const parts = line.split(/\s+/);
          if (parts.length < 2) continue;
          
          const fieldName = parts[0];
          const rawType = parts[1];
          let type = this._typeMap[rawType] || 'VARCHAR(255)';

          const tag = line.match(/gorm:"([^"]+)"/);
          
          // Prefer column: tag value for actual DB column name
          let colName;
          if (tag) {
            const colMatch = tag[1].match(/column:([^;]+)/);
            if (colMatch) {
              colName = colMatch[1].trim();
            }
          }
          // Fall back to snake_case conversion
          if (!colName) {
            colName = fieldName.replace(/ID/g, 'Id').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
            if (colName === 'i_d') colName = 'id';
          }
          
          const pk = tag ? tag[1].includes('primaryKey') : colName === 'id';
          const uq = tag ? tag[1].includes('unique') : false;
          const nn = tag ? tag[1].includes('not null') : pk;

          if (tag) {
            const typeMatch = tag[1].match(/type:([^;]+)/);
            if (typeMatch) type = typeMatch[1].toUpperCase();
            
            const m2mMatch = tag[1].match(/many2many:([^;]+)/);
            if (m2mMatch && rawType.startsWith('[]')) {
              const targetClass = rawType.substring(2);
              rawConns.push({
                fromTableName: tableName,
                fromColumn: 'id',
                toTableName: targetClass.toLowerCase() + 's',
                toColumn: 'id',
                type: 'many-to-many'
              });
              continue; // Don't add a column for a many2many field
            }
            
            const fkMatch = tag[1].match(/foreignKey:([^;"]+)/);
            if (fkMatch && !m2mMatch) {
              const fkCol = fkMatch[1].trim();
              const isSlice = rawType.startsWith('[]');
              const targetType = isSlice ? rawType.substring(2) : rawType.replace(/^\*/, '');
              const targetTable = targetType.toLowerCase() + 's';
              
              if (isSlice) {
                 // hasMany -> FK is on target table
                 rawConns.push({
                   fromTableName: targetTable,
                   fromColumn: fkCol,
                   toTableName: tableName,
                   toColumn: 'id'
                 });
              } else {
                 // belongsTo/hasOne -> FK is on this table
                 rawConns.push({
                   fromTableName: tableName,
                   fromColumn: fkCol,
                   toTableName: targetTable,
                   toColumn: 'id'
                 });
              }
              
              // Skip adding actual column for relations, only primitive types get columns
              if (isSlice || (rawType[0] === rawType[0].toUpperCase() && !['JSON', 'UUID'].includes(targetType.toUpperCase()))) {
                 continue;
              }
            }
          }
          
          // FK heuristic: column ends with 'Id' (camelCase) or '_id' (snake_case)
          const isIdSuffix = (colName.endsWith('Id') || colName.endsWith('_id')) && colName.length > 3 && colName.toLowerCase() !== 'id';
          if (isIdSuffix) {
            const base = colName.endsWith('Id')
              ? colName.slice(0, -2).toLowerCase()
              : colName.slice(0, -3);
            const targetTable = base + 's';
            rawConns.push({
              fromTableName: tableName,
              fromColumn: colName,
              toTableName: targetTable,
              toColumn: 'id'
            });
          }

          columns.push(AppState.newColumn({ name: colName, type, pk, nn, uq }));

        }

        if (columns.length > 0) {
          tables.push(_createTable(tableName, columns, idx++));
        }
      }
      return { tables, connections: _resolveConnections(tables, rawConns) };
    }
  };

  /* ═══════════════════ LARAVEL PARSER ═══════════════════ */
  const LaravelParser = {
    parse(code) {
      const tables = [];
      const rawConns = [];
      let idx = 0;
      
      const regex = /Schema::create\s*\(\s*['"]([^'"]+)['"]\s*,\s*function\s*\([^)]+\)\s*\{([^}]*)\}/g;
      let match;
      let foundSchema = false;

      while ((match = regex.exec(code)) !== null) {
        foundSchema = true;
        const tableName = match[1];
        const body = match[2];
        const columns = [];

        // Parse regular columns
        const colRegex = /\$table->([a-zA-Z0-9_]+)\s*\(\s*(?:['"]([^'"]+)['"]|([^)]+))\s*\)/g;
        let cMatch;
        while ((cMatch = colRegex.exec(body)) !== null) {
          const fn = cMatch[1];
          let colName = cMatch[2] || cMatch[3];
          
          let type = 'VARCHAR(255)';
          if (fn === 'id' || fn === 'bigIncrements') type = 'BIGINT';
          else if (fn === 'integer' || fn === 'increments') type = 'INT';
          else if (fn === 'string') type = 'VARCHAR(255)';
          else if (fn === 'text') type = 'TEXT';
          else if (fn === 'boolean') type = 'BOOLEAN';
          else if (fn === 'timestamp' || fn === 'dateTime') type = 'DATETIME';
          else if (fn === 'date') type = 'DATE';
          else if (fn === 'decimal' || fn === 'float') type = 'DECIMAL';
          else if (fn === 'json') type = 'JSON';
          else if (fn === 'foreignId') {
            type = 'BIGINT';
            
            // Check for ->constrained('table') or ->constrained()
            const lineMatch = body.substring(cMatch.index).split(';')[0];
            const constMatch = lineMatch.match(/->constrained\(\s*(?:['"]([^'"]+)['"])?\s*\)/);
            
            let targetTable = '';
            if (constMatch) {
              targetTable = constMatch[1] || (colName.replace(/_id$/, '') + 's');
            } else {
              targetTable = colName.replace(/_id$/, '') + 's';
            }
            
            rawConns.push({
              fromTableName: tableName,
              fromColumn: colName,
              toTableName: targetTable,
              toColumn: 'id'
            });
          }

          else if (fn === 'foreignIdFor') {
            type = 'BIGINT';
            
            const targetModel = colName.replace(/::class.*/, '').trim();
            const targetTable = targetModel.toLowerCase() + 's';
            colName = targetModel.toLowerCase() + '_id';
            
            rawConns.push({
              fromTableName: tableName,
              fromColumn: colName,
              toTableName: targetTable,
              toColumn: 'id'
            });
          }

          columns.push(AppState.newColumn({ name: colName, type }));
        }
        
        // Match explicit foreign keys: $table->foreign('user_id')->references('id')->on('users');
        const fkRegex = /\$table->foreign\s*\(\s*['"]([^'"]+)['"]\s*\)->references\s*\(\s*['"]([^'"]+)['"]\s*\)->on\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let fkMatch;
        while ((fkMatch = fkRegex.exec(body)) !== null) {
          rawConns.push({
            fromTableName: tableName,
            fromColumn: fkMatch[1],
            toTableName: fkMatch[3],
            toColumn: fkMatch[2]
          });
        }
        
        if (body.includes('$table->id()') && !columns.find(c => c.name === 'id')) {
          columns.unshift(AppState.newColumn({ name: 'id', type: 'BIGINT', pk: true, ai: true }));
        }
        if (body.includes('$table->timestamps()')) {
          columns.push(AppState.newColumn({ name: 'created_at', type: 'DATETIME' }));
          columns.push(AppState.newColumn({ name: 'updated_at', type: 'DATETIME' }));
        }

        tables.push(_createTable(tableName, columns, idx++));
      }

      if (!foundSchema) {
        const blocks = code.split(/class\s+(\w+)\s+extends\s+Model/);
        for (let i = 1; i < blocks.length; i += 2) {
          const className = blocks[i];
          const body = blocks[i + 1];
          const tableNameMatch = body.match(/protected\s+\$table\s*=\s*['"]([^'"]+)['"]/);
          const tableName = tableNameMatch ? tableNameMatch[1] : className.toLowerCase() + 's';
          
          const columns = [AppState.newColumn({ name: 'id', type: 'BIGINT', pk: true, ai: true })];
          
          const fillableMatch = body.match(/protected\s+\$fillable\s*=\s*\[(.*?)\]/s);
          if (fillableMatch) {
            const fields = fillableMatch[1].match(/['"]([^'"]+)['"]/g);
            if (fields) {
              for (const f of fields) {
                const colName = f.replace(/['"]/g, '');
                columns.push(AppState.newColumn({ name: colName, type: 'VARCHAR(255)' }));
                
                // Heuristic for eloquent models
                if (colName.endsWith('_id')) {
                  rawConns.push({
                    fromTableName: tableName,
                    fromColumn: colName,
                    toTableName: colName.replace(/_id$/, '') + 's',
                    toColumn: 'id'
                  });
                }
              }
            }
          }
          
          // Parse belongsToMany (Many-to-Many in Models)
          const btmRegex = /belongsToMany\s*\(\s*([^:]+)::class/g;
          let btm;
          while ((btm = btmRegex.exec(body)) !== null) {
             const targetModel = btm[1];
             const targetTable = targetModel.toLowerCase() + 's';
             rawConns.push({
               fromTableName: tableName,
               fromColumn: 'id',
               toTableName: targetTable,
               toColumn: 'id',
               type: 'many-to-many'
             });
          }
          
          // Parse hasOne
          const hasOneRegex = /hasOne\s*\(\s*([^:]+)::class/g;
          let hasOne;
          while ((hasOne = hasOneRegex.exec(body)) !== null) {
             const targetModel = hasOne[1];
             const targetTable = targetModel.toLowerCase() + 's';
             const fkName = className.toLowerCase() + '_id';
             rawConns.push({
               fromTableName: targetTable,
               fromColumn: fkName,
               toTableName: tableName,
               toColumn: 'id',
               type: 'one-to-one'
             });
          }
          
          // Parse belongsTo and hasMany
          const relRegex = /(belongsTo|hasMany)\s*\(\s*([^:]+)::class\s*(?:,\s*['"]([^'"]+)['"])?\s*(?:,\s*['"]([^'"]+)['"])?\s*\)/g;
          let relMatch;
          while ((relMatch = relRegex.exec(body)) !== null) {
             const relType = relMatch[1];
             const targetModel = relMatch[2];
             const targetTable = targetModel.toLowerCase() + 's';
             
             if (relType === 'belongsTo') {
               const fkName = relMatch[3] || targetModel.toLowerCase() + '_id';
               rawConns.push({
                 fromTableName: tableName,
                 fromColumn: fkName,
                 toTableName: targetTable,
                 toColumn: 'id'
               });
             } else if (relType === 'hasMany') {
               const fkName = relMatch[3] || className.toLowerCase() + '_id';
               rawConns.push({
                 fromTableName: targetTable,
                 fromColumn: fkName,
                 toTableName: tableName,
                 toColumn: 'id'
               });
             }
          }
          
          columns.push(AppState.newColumn({ name: 'created_at', type: 'DATETIME' }));
          columns.push(AppState.newColumn({ name: 'updated_at', type: 'DATETIME' }));
          
          tables.push(_createTable(tableName, columns, idx++));
        }
      }

      return { tables, connections: _resolveConnections(tables, rawConns) };
    }
  };

  global.PrismaParser = PrismaParser;
  global.SqlAlchemyParser = SqlAlchemyParser;
  global.TypeOrmParser = TypeOrmParser;
  global.GormParser = GormParser;
  global.LaravelParser = LaravelParser;

})(window);
