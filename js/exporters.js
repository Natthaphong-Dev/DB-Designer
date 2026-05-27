/* ════════════════════════════════════════════════════════════
   js/exporters.js — Multi-Framework ORM Exporters
   Supports: Prisma, TypeORM, GORM, SQLAlchemy, Laravel Eloquent
   ════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════
     SHARED TYPE MAPPER UTILITY
  ═══════════════════════════════════════════════ */
  const TypeMapper = {
    /**
     * Parse a raw SQL type like "VARCHAR(255)" into { base: "VARCHAR", params: "255" }
     */
    parse(rawType) {
      const m = (rawType || 'VARCHAR(255)').match(/^(\w+)(?:\(([^)]*)\))?$/);
      return {
        base: m ? m[1].toUpperCase() : 'VARCHAR',
        params: m ? m[2] || null : null
      };
    },

    /* ── Prisma type map ── */
    toPrisma(rawType) {
      const { base, params } = this.parse(rawType);
      const map = {
        INT: 'Int', INTEGER: 'Int', TINYINT: 'Int', SMALLINT: 'Int',
        BIGINT: 'BigInt', FLOAT: 'Float', DOUBLE: 'Float', REAL: 'Float',
        DECIMAL: 'Decimal', NUMERIC: 'Decimal',
        BOOLEAN: 'Boolean', BOOL: 'Boolean',
        VARCHAR: 'String', CHAR: 'String', TEXT: 'String',
        LONGTEXT: 'String', MEDIUMTEXT: 'String', TINYTEXT: 'String',
        DATE: 'DateTime', DATETIME: 'DateTime', TIMESTAMP: 'DateTime', TIME: 'DateTime',
        JSON: 'Json', JSONB: 'Json',
        BLOB: 'Bytes', BINARY: 'Bytes', LONGBLOB: 'Bytes',
        UUID: 'String', EMAIL: 'String',
        SERIAL: 'Int', BIGSERIAL: 'BigInt',
        ENUM: 'String'
      };
      return map[base] || 'String';
    },

    /* ── TypeORM type map ── */
    toTypeOrm(rawType) {
      const { base, params } = this.parse(rawType);
      const map = {
        INT: 'int', INTEGER: 'int', TINYINT: 'tinyint', SMALLINT: 'smallint',
        BIGINT: 'bigint', FLOAT: 'float', DOUBLE: 'double', REAL: 'real',
        DECIMAL: 'decimal', NUMERIC: 'numeric',
        BOOLEAN: 'boolean', BOOL: 'boolean',
        VARCHAR: 'varchar', CHAR: 'char', TEXT: 'text',
        LONGTEXT: 'longtext', MEDIUMTEXT: 'mediumtext',
        DATE: 'date', DATETIME: 'datetime', TIMESTAMP: 'timestamp', TIME: 'time',
        JSON: 'json', JSONB: 'jsonb',
        BLOB: 'blob', BINARY: 'binary',
        UUID: 'uuid', EMAIL: 'varchar',
        SERIAL: 'int', BIGSERIAL: 'bigint'
      };
      return map[base] || 'varchar';
    },

    /* ── GORM (Go) type map ── */
    toGorm(rawType) {
      const { base, params } = this.parse(rawType);
      const lengthPart = params ? `;size:${params.split(',')[0]}` : '';
      const map = {
        INT: `type:int`, INTEGER: `type:int`, TINYINT: `type:tinyint`, SMALLINT: `type:smallint`,
        BIGINT: `type:bigint`, FLOAT: `type:float`, DOUBLE: `type:double`, REAL: `type:float`,
        DECIMAL: `type:decimal(${params || '10,2'})`,
        BOOLEAN: `type:boolean`, BOOL: `type:boolean`,
        VARCHAR: `type:varchar(${params || '255'})`,
        CHAR: `type:char(${params || '1'})`,
        TEXT: `type:text`, LONGTEXT: `type:longtext`, MEDIUMTEXT: `type:mediumtext`,
        DATE: `type:date`, DATETIME: `type:datetime`, TIMESTAMP: `type:timestamp`,
        TIME: `type:time`,
        JSON: `type:json`, JSONB: `type:jsonb`,
        BLOB: `type:blob`, BINARY: `type:binary`,
        UUID: `type:char(36)`, EMAIL: `type:varchar(255)`,
        SERIAL: `type:int`, BIGSERIAL: `type:bigint`
      };
      return map[base] || `type:varchar(255)`;
    },

    /* ── Go field type ── */
    toGoType(rawType, nullable) {
      const { base } = this.parse(rawType);
      const map = {
        INT: 'int', INTEGER: 'int', TINYINT: 'int8', SMALLINT: 'int16',
        BIGINT: 'int64', FLOAT: 'float32', DOUBLE: 'float64', REAL: 'float32',
        DECIMAL: 'float64', NUMERIC: 'float64',
        BOOLEAN: 'bool', BOOL: 'bool',
        VARCHAR: 'string', CHAR: 'string', TEXT: 'string',
        LONGTEXT: 'string', MEDIUMTEXT: 'string',
        DATE: 'time.Time', DATETIME: 'time.Time', TIMESTAMP: 'time.Time', TIME: 'time.Time',
        JSON: 'datatypes.JSON', JSONB: 'datatypes.JSON',
        BLOB: '[]byte', BINARY: '[]byte',
        UUID: 'string', EMAIL: 'string',
        SERIAL: 'uint', BIGSERIAL: 'uint64'
      };
      const goType = map[base] || 'string';
      // Use pointer for nullable fields
      if (nullable && goType !== '[]byte' && goType !== 'datatypes.JSON') {
        return '*' + goType;
      }
      return goType;
    },

    /* ── SQLAlchemy type map ── */
    toSqlAlchemy(rawType) {
      const { base, params } = this.parse(rawType);
      const map = {
        INT: 'Integer', INTEGER: 'Integer', TINYINT: 'SmallInteger', SMALLINT: 'SmallInteger',
        BIGINT: 'BigInteger', FLOAT: 'Float', DOUBLE: 'Float', REAL: 'Float',
        DECIMAL: `Numeric(${params || '10, 2'})`,
        NUMERIC: `Numeric(${params || '10, 2'})`,
        BOOLEAN: 'Boolean', BOOL: 'Boolean',
        VARCHAR: `String(${params || '255'})`,
        CHAR: `String(${params || '1'})`,
        TEXT: 'Text', LONGTEXT: 'Text', MEDIUMTEXT: 'Text',
        DATE: 'Date', DATETIME: 'DateTime', TIMESTAMP: 'DateTime', TIME: 'Time',
        JSON: 'JSON', JSONB: 'JSON',
        BLOB: 'LargeBinary', BINARY: 'LargeBinary',
        UUID: 'String(36)', EMAIL: 'String(255)',
        SERIAL: 'Integer', BIGSERIAL: 'BigInteger'
      };
      return map[base] || `String(${params || '255'})`;
    },

    /* ── PHP / Laravel cast map ── */
    toLaravelCast(rawType) {
      const { base } = this.parse(rawType);
      const map = {
        INT: 'integer', INTEGER: 'integer', TINYINT: 'integer', SMALLINT: 'integer',
        BIGINT: 'integer', FLOAT: 'float', DOUBLE: 'float', REAL: 'float',
        DECIMAL: 'decimal:2', NUMERIC: 'decimal:2',
        BOOLEAN: 'boolean', BOOL: 'boolean',
        VARCHAR: 'string', CHAR: 'string', TEXT: 'string',
        DATE: 'date', DATETIME: 'datetime', TIMESTAMP: 'datetime',
        JSON: 'array', JSONB: 'array',
        UUID: 'string', EMAIL: 'string'
      };
      return map[base] || null;
    },

    /* ── PHP type hint ── */
    toPhpType(rawType, nullable) {
      const { base } = this.parse(rawType);
      const map = {
        INT: 'int', INTEGER: 'int', TINYINT: 'int', SMALLINT: 'int',
        BIGINT: 'int', FLOAT: 'float', DOUBLE: 'float', REAL: 'float',
        DECIMAL: 'float', NUMERIC: 'float',
        BOOLEAN: 'bool', BOOL: 'bool',
        VARCHAR: 'string', CHAR: 'string', TEXT: 'string',
        DATE: 'string', DATETIME: 'string', TIMESTAMP: 'string',
        JSON: 'array', JSONB: 'array',
        UUID: 'string', EMAIL: 'string'
      };
      const type = map[base] || 'string';
      return nullable ? `?${type}` : type;
    }
  };

  /* ── shared snake_case ↔ PascalCase helpers ── */
  function toPascalCase(str) {
    return str.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
  }
  function toCamelCase(str) {
    const p = toPascalCase(str);
    return p.charAt(0).toLowerCase() + p.slice(1);
  }
  function toSingular(name) {
    if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
    if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('zes') || name.endsWith('ches') || name.endsWith('shes')) return name.slice(0, -2);
    if (name.endsWith('s') && !name.endsWith('ss') && !name.endsWith('us')) return name.slice(0, -1);
    return name;
  }

  /* ═══════════════════════════════════════════════
     🔷 PRISMA ORM EXPORTER (Node.js / TypeScript)
  ═══════════════════════════════════════════════ */
  const PrismaExporter = {
    export(tables, connections) {
      let out = `// Generated by DB Designer\n`;
      out += `// Prisma Schema — ${new Date().toLocaleString('th-TH')}\n\n`;
      out += `generator client {\n  provider = "prisma-client-js"\n}\n\n`;
      out += `datasource db {\n  provider = "postgresql" // Change to mysql or sqlite as needed\n  url      = env("DATABASE_URL")\n}\n\n`;

      // Build a lookup: tableId → tableName
      const tableById = {};
      for (const t of tables) { if (t.type !== 'note') tableById[t.id] = t; }

      for (const table of tables) {
        if (table.type === 'note') continue;
        const modelName = toPascalCase(toSingular(table.name));
        out += `model ${modelName} {\n`;

        // FK connections that go TO this table (this table holds the FK column)
        const incomingConns = connections.filter(c => c.toTableId === table.id && c.type !== 'many-to-many');
        // FK connections that come FROM this table (this table is referenced; adds relation field)
        const outgoingConns = connections.filter(c => c.fromTableId === table.id && c.type !== 'many-to-many');
        // Many to Many connections involving this table
        const m2mConns = connections.filter(c => (c.toTableId === table.id || c.fromTableId === table.id) && c.type === 'many-to-many');

        const fkColNames = new Set(incomingConns.map(c => c.toColumn).filter(Boolean));

        for (const col of table.columns) {
          const prismaType = TypeMapper.toPrisma(col.type);
          const nullable = !col.nn && !col.pk;

          if (fkColNames.has(col.name)) {
            // This is the raw FK integer column
            const conn = incomingConns.find(c => c.toColumn === col.name);
            const refTable = conn ? tableById[conn.fromTableId] : null;
            const refModelName = refTable ? toPascalCase(toSingular(refTable.name)) : 'Unknown';
            const refFieldName = toCamelCase(toSingular(refTable ? refTable.name : 'unknown'));
            const attrs = [];
            if (col.pk) attrs.push('@id');
            if (col.ai) attrs.push('@default(autoincrement())');
            if (col.uq) attrs.push('@unique');
            out += `  ${col.name}  ${prismaType}${nullable ? '?' : ''}`;
            if (attrs.length) out += `  ${attrs.join(' ')}`;
            out += `\n`;

            // Add relation field
            const isOneToOne = conn && conn.type === 'one-to-one';
            out += `  ${refFieldName}  ${refModelName}${isOneToOne ? '?' : ''}  @relation(fields: [${col.name}], references: [${conn ? conn.fromColumn || 'id' : 'id'}])\n`;
            continue;
          }

          // Regular column
          const attrs = [];
          if (col.pk) attrs.push('@id');
          if (col.ai) attrs.push('@default(autoincrement())');
          if (col.uq && !col.pk) attrs.push('@unique');
          if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal !== '') {
            const dv = col.defaultVal.toUpperCase();
            if (dv === 'CURRENT_TIMESTAMP' || dv === 'NOW()') {
              attrs.push('@default(now())');
            } else if (dv === 'TRUE' || dv === '1') {
              attrs.push('@default(true)');
            } else if (dv === 'FALSE' || dv === '0' && prismaType === 'Boolean') {
              attrs.push('@default(false)');
            } else if (!isNaN(col.defaultVal)) {
              attrs.push(`@default(${col.defaultVal})`);
            } else {
              attrs.push(`@default("${col.defaultVal.replace(/'/g, '')}")`);
            }
          }

          out += `  ${col.name}  ${prismaType}${nullable ? '?' : ''}`;
          if (attrs.length) out += `  ${attrs.join(' ')}`;
          out += `\n`;
        }

        // Reverse relation fields (one-to-many: this table is the "one" side)
        for (const conn of outgoingConns) {
          const manyTable = tableById[conn.toTableId];
          if (!manyTable) continue;
          const manyModelName = toPascalCase(toSingular(manyTable.name));
          const manyFieldName = manyTable.name.toLowerCase();
          const isOneToOne = conn.type === 'one-to-one';
          out += `  ${manyFieldName}  ${manyModelName}${isOneToOne ? '?' : '[]'}\n`;
        }

        // Implicit Many-to-Many fields
        for (const conn of m2mConns) {
          const isFrom = conn.fromTableId === table.id;
          const otherTable = tableById[isFrom ? conn.toTableId : conn.fromTableId];
          if (!otherTable) continue;
          const otherModelName = toPascalCase(toSingular(otherTable.name));
          const otherFieldName = otherTable.name.toLowerCase();
          out += `  ${otherFieldName}  ${otherModelName}[]\n`;
        }

        out += `\n  @@map("${table.name}")\n`;
        out += `}\n\n`;
      }

      return out.trimEnd() + '\n';
    }
  };

  /* ═══════════════════════════════════════════════
     🟡 TYPEORM EXPORTER (Node.js / TypeScript)
  ═══════════════════════════════════════════════ */
  const TypeOrmExporter = {
    export(tables, connections) {
      const tableById = {};
      for (const t of tables) { if (t.type !== 'note') tableById[t.id] = t; }

      let out = `// Generated by DB Designer\n`;
      out += `// TypeORM Entities — ${new Date().toLocaleString('th-TH')}\n\n`;
      out += `import {\n`;
      out += `  Entity, Column, PrimaryGeneratedColumn, PrimaryColumn,\n`;
      out += `  ManyToOne, OneToMany, OneToOne, ManyToMany, JoinColumn, JoinTable, CreateDateColumn,\n`;
      out += `  UpdateDateColumn, Unique, Index\n`;
      out += `} from 'typeorm';\n\n`;

      for (const table of tables) {
        if (table.type === 'note') continue;
        const className = toPascalCase(toSingular(table.name));
        const incomingConns = connections.filter(c => c.toTableId === table.id);
        const outgoingConns = connections.filter(c => c.fromTableId === table.id);
        const fkColNames = new Set(incomingConns.map(c => c.toColumn).filter(Boolean));

        out += `// ${'─'.repeat(50)}\n`;
        out += `@Entity('${table.name}')\n`;
        out += `export class ${className} {\n`;

        for (const col of table.columns) {
          const ormType = TypeMapper.toTypeOrm(col.type);
          const { base, params } = TypeMapper.parse(col.type);
          const nullable = !col.nn && !col.pk;

          if (col.pk && col.ai) {
            out += `  @PrimaryGeneratedColumn()\n`;
            out += `  ${col.name}: number;\n\n`;
            continue;
          }
          if (col.pk && !col.ai) {
            out += `  @PrimaryColumn({ type: '${ormType}'${params ? `, length: ${params.split(',')[0]}` : ''} })\n`;
            out += `  ${col.name}: ${this._tsType(col.type)};\n\n`;
            continue;
          }

          if (fkColNames.has(col.name)) {
            const conn = incomingConns.find(c => c.toColumn === col.name);
            const refTable = conn ? tableById[conn.fromTableId] : null;
            const refClassName = refTable ? toPascalCase(toSingular(refTable.name)) : 'unknown';
            const refPropName = toCamelCase(toSingular(refTable ? refTable.name : 'unknown'));

            out += `  @Column({ type: '${ormType}', nullable: ${nullable} })\n`;
            out += `  ${col.name}: number;\n\n`;
            
            if (conn.type === 'one-to-one') {
               out += `  @OneToOne(() => ${refClassName}, ${toCamelCase(refClassName)} => ${toCamelCase(refClassName)}.${toCamelCase(toSingular(table.name))})\n`;
            } else {
               out += `  @ManyToOne(() => ${refClassName}, ${toCamelCase(refClassName)} => ${toCamelCase(refClassName)}.${table.name})\n`;
            }
            out += `  @JoinColumn({ name: '${col.name}' })\n`;
            out += `  ${refPropName}: ${refClassName};\n\n`;
            continue;
          }

          // Detect timestamp columns
          if (['created_at', 'createdat', 'createtime'].includes(col.name.toLowerCase()) && (base === 'TIMESTAMP' || base === 'DATETIME')) {
            out += `  @CreateDateColumn()\n`;
            out += `  ${col.name}: Date;\n\n`;
            continue;
          }
          if (['updated_at', 'updatedat', 'updatetime', 'modifiedat'].includes(col.name.toLowerCase()) && (base === 'TIMESTAMP' || base === 'DATETIME')) {
            out += `  @UpdateDateColumn()\n`;
            out += `  ${col.name}: Date;\n\n`;
            continue;
          }

          const colOpts = [];
          colOpts.push(`type: '${ormType}'`);
          if (params && (ormType === 'varchar' || ormType === 'char')) colOpts.push(`length: ${params.split(',')[0]}`);
          if (params && (ormType === 'decimal' || ormType === 'numeric')) {
            const pp = params.split(',');
            colOpts.push(`precision: ${pp[0].trim()}`);
            if (pp[1]) colOpts.push(`scale: ${pp[1].trim()}`);
          }
          if (nullable) colOpts.push(`nullable: true`);
          if (col.uq && !col.pk) colOpts.push(`unique: true`);
          if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal !== '') {
            const dv = col.defaultVal.toUpperCase();
            if (dv === 'CURRENT_TIMESTAMP' || dv === 'NOW()') {
              colOpts.push(`default: () => "CURRENT_TIMESTAMP"`);
            } else {
              colOpts.push(`default: ${/^'|"/.test(col.defaultVal) ? col.defaultVal : `'${col.defaultVal}'`}`);
            }
          }

          out += `  @Column({ ${colOpts.join(', ')} })\n`;
          out += `  ${col.name}: ${this._tsType(col.type)}${nullable ? ' | null' : ''};\n\n`;
        }

        // Reverse relation fields
        for (const conn of outgoingConns) {
          const manyTable = tableById[conn.toTableId];
          if (!manyTable) continue;
          const manyClassName = toPascalCase(toSingular(manyTable.name));
          const manyPropName = manyTable.name.toLowerCase();
          
          if (conn.type === 'many-to-many') {
             out += `  @ManyToMany(() => ${manyClassName})\n`;
             out += `  @JoinTable()\n`;
             out += `  ${manyPropName}: ${manyClassName}[];\n\n`;
          } else if (conn.type === 'one-to-one') {
             out += `  @OneToOne(() => ${manyClassName}, ${toCamelCase(manyClassName)} => ${toCamelCase(manyClassName)}.${toCamelCase(toSingular(table.name))})\n`;
             out += `  ${manyPropName}: ${manyClassName};\n\n`;
          } else {
             out += `  @OneToMany(() => ${manyClassName}, ${toCamelCase(manyClassName)} => ${toCamelCase(manyClassName)}.${toCamelCase(toSingular(table.name))})\n`;
             out += `  ${manyPropName}: ${manyClassName}[];\n\n`;
          }
        }

        out += `}\n\n`;
      }

      return out.trimEnd() + '\n';
    },

    _tsType(rawType) {
      const { base } = TypeMapper.parse(rawType);
      const map = {
        INT: 'number', INTEGER: 'number', TINYINT: 'number', SMALLINT: 'number',
        BIGINT: 'number', FLOAT: 'number', DOUBLE: 'number', REAL: 'number',
        DECIMAL: 'number', NUMERIC: 'number',
        BOOLEAN: 'boolean', BOOL: 'boolean',
        VARCHAR: 'string', CHAR: 'string', TEXT: 'string',
        LONGTEXT: 'string', MEDIUMTEXT: 'string',
        DATE: 'Date', DATETIME: 'Date', TIMESTAMP: 'Date', TIME: 'string',
        JSON: 'Record<string, any>', JSONB: 'Record<string, any>',
        BLOB: 'Buffer', BINARY: 'Buffer',
        UUID: 'string', EMAIL: 'string',
        SERIAL: 'number', BIGSERIAL: 'number'
      };
      return map[base] || 'string';
    }
  };

  /* ═══════════════════════════════════════════════
     🐹 GORM EXPORTER (Golang)
  ═══════════════════════════════════════════════ */
  const GormExporter = {
    export(tables, connections) {
      const tableById = {};
      for (const t of tables) { if (t.type !== 'note') tableById[t.id] = t; }

      // Detect if any JSON fields are used
      let hasJSON = false;
      let hasTime = false;
      for (const t of tables) {
        if (t.type === 'note') continue;
        for (const c of t.columns) {
          const { base } = TypeMapper.parse(c.type);
          if (base === 'JSON' || base === 'JSONB') hasJSON = true;
          if (['DATE', 'DATETIME', 'TIMESTAMP', 'TIME'].includes(base)) hasTime = true;
        }
      }

      let out = `// Generated by DB Designer\n`;
      out += `// GORM Structs (Go) — ${new Date().toLocaleString('th-TH')}\n\n`;
      out += `package models\n\n`;
      out += `import (\n`;
      if (hasTime) out += `\t"time"\n`;
      out += `\t"gorm.io/gorm"\n`;
      if (hasJSON) out += `\t"gorm.io/datatypes"\n`;
      out += `)\n\n`;

      for (const table of tables) {
        if (table.type === 'note') continue;
        const structName = toPascalCase(toSingular(table.name));
        const incomingConns = connections.filter(c => c.toTableId === table.id && c.type !== 'many-to-many');
        const outgoingConns = connections.filter(c => c.fromTableId === table.id && c.type !== 'many-to-many');
        const m2mConns = connections.filter(c => (c.toTableId === table.id || c.fromTableId === table.id) && c.type === 'many-to-many');
        const fkColNames = new Set(incomingConns.map(c => c.toColumn).filter(Boolean));

        out += `// ${'─'.repeat(50)}\n`;
        out += `type ${structName} struct {\n`;

        // Use GORM's embedded Model for tables with standard PK
        const hasPk = table.columns.some(c => c.pk && c.ai && c.name === 'id');
        if (hasPk) {
          out += `\tgorm.Model\n`;
        }

        for (const col of table.columns) {
          // Skip standard GORM Model fields
          if (hasPk && ['id', 'created_at', 'updated_at', 'deleted_at'].includes(col.name.toLowerCase())) continue;

          const fieldName = toPascalCase(col.name);
          const nullable = !col.nn && !col.pk;
          const goType = TypeMapper.toGoType(col.type, nullable);
          const gormTag = TypeMapper.toGorm(col.type);

          const gormParts = [gormTag];
          if (col.pk && !hasPk) gormParts.push('primaryKey');
          if (col.ai && !hasPk) gormParts.push('autoIncrement');
          if (col.nn || col.pk) gormParts.push('not null');
          if (col.uq && !col.pk) gormParts.push('uniqueIndex');
          if (fkColNames.has(col.name)) gormParts.push('index');

          const jsonTag = col.name;
          out += `\t${fieldName} ${goType} \`gorm:"column:${col.name};${gormParts.join(';')}" json:"${jsonTag}"\`\n`;
        }

        // FK relation fields
        for (const conn of incomingConns) {
          const refTable = tableById[conn.fromTableId];
          if (!refTable) continue;
          const refStructName = toPascalCase(toSingular(refTable.name));
          const fieldName = toPascalCase(toSingular(refTable.name));
          out += `\t${fieldName} ${refStructName} \`gorm:"foreignKey:${conn.toColumn};references:${conn.fromColumn || 'ID'}" json:"${toCamelCase(fieldName)}"\`\n`;
        }

        // Reverse relation fields
        for (const conn of outgoingConns) {
          const manyTable = tableById[conn.toTableId];
          if (!manyTable) continue;
          const manyStructName = toPascalCase(toSingular(manyTable.name));
          const fieldName = toPascalCase(manyTable.name);
          const isOneToOne = conn.type === 'one-to-one';
          if (isOneToOne) {
             const fieldNameSingle = toPascalCase(toSingular(manyTable.name));
             out += `\t${fieldNameSingle} ${manyStructName} \`gorm:"foreignKey:${conn.toColumn}" json:"${manyTable.name}"\`\n`;
          } else {
             out += `\t${fieldName} []${manyStructName} \`gorm:"foreignKey:${conn.toColumn}" json:"${manyTable.name}"\`\n`;
          }
        }
        
        // Many-to-Many relations
        for (const conn of m2mConns) {
          const isFrom = conn.fromTableId === table.id;
          const otherTable = tableById[isFrom ? conn.toTableId : conn.fromTableId];
          if (!otherTable) continue;
          const otherStructName = toPascalCase(toSingular(otherTable.name));
          const fieldName = toPascalCase(otherTable.name);
          const joinTableName = [table.name, otherTable.name].sort().join('_');
          out += `\t${fieldName} []${otherStructName} \`gorm:"many2many:${joinTableName};" json:"${otherTable.name}"\`\n`;
        }

        out += `}\n\n`;

        // Add TableName() method
        out += `func (${structName}) TableName() string {\n\treturn "${table.name}"\n}\n\n`;
      }

      return out.trimEnd() + '\n';
    }
  };

  /* ═══════════════════════════════════════════════
     🐍 SQLALCHEMY EXPORTER (Python / FastAPI) 2.0
  ═══════════════════════════════════════════════ */
  const SqlAlchemyExporter = {
    export(tables, connections) {
      const tableById = {};
      for (const t of tables) { if (t.type !== 'note') tableById[t.id] = t; }

      let out = `# Generated by DB Designer\n`;
      out += `# SQLAlchemy 2.0 Models — ${new Date().toLocaleString('th-TH')}\n\n`;
      out += `from typing import List, Optional\n`;
      out += `from sqlalchemy import (\n`;
      out += `    Integer, BigInteger, SmallInteger, Float, Numeric,\n`;
      out += `    String, Text, Boolean, Date, DateTime, Time,\n`;
      out += `    JSON, LargeBinary, ForeignKey, UniqueConstraint\n`;
      out += `)\n`;
      out += `from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship\n`;
      out += `from sqlalchemy.sql import func\n\n\n`;
      out += `class Base(DeclarativeBase):\n    pass\n\n\n`;

      for (const table of tables) {
        if (table.type === 'note') continue;
        const className = toPascalCase(toSingular(table.name));
        const incomingConns = connections.filter(c => c.toTableId === table.id);
        const outgoingConns = connections.filter(c => c.fromTableId === table.id);
        const fkColNames = new Set(incomingConns.map(c => c.toColumn).filter(Boolean));

        out += `# ${'─'.repeat(50)}\n`;
        out += `class ${className}(Base):\n`;
        out += `    __tablename__ = "${table.name}"\n`;

        const uqCols = table.columns.filter(c => c.uq && !c.pk);

        out += `\n`;

        for (const col of table.columns) {
          const saType = TypeMapper.toSqlAlchemy(col.type);
          const nullable = !col.nn && !col.pk;
          const pyType = this._pyType(col.type);

          const colArgs = [saType];
          if (fkColNames.has(col.name)) {
            const conn = incomingConns.find(c => c.toColumn === col.name);
            const refTable = conn ? tableById[conn.fromTableId] : null;
            if (refTable) colArgs.push(`ForeignKey("${refTable.name}.${conn.fromColumn || 'id'}")`);
          }
          if (col.pk) colArgs.push('primary_key=True');
          if (col.ai) colArgs.push('autoincrement=True');
          if (nullable) colArgs.push('nullable=True');
          if (col.uq && !col.pk) colArgs.push('unique=True');
          
          if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal !== '') {
            const dv = col.defaultVal.toUpperCase();
            if (dv === 'CURRENT_TIMESTAMP' || dv === 'NOW()') {
              colArgs.push('server_default=func.now()');
            } else if (!isNaN(col.defaultVal)) {
              colArgs.push(`default=${col.defaultVal}`);
            } else {
              colArgs.push(`default="${col.defaultVal.replace(/'/g, '')}"`);
            }
          }

          const mappedType = nullable ? `Optional[${pyType}]` : pyType;
          const indent = '    ';
          if (colArgs.join(', ').length > 60) {
            out += `${indent}${col.name}: Mapped[${mappedType}] = mapped_column(\n`;
            for (const arg of colArgs) out += `${indent}    ${arg},\n`;
            out += `${indent})\n`;
          } else {
            out += `${indent}${col.name}: Mapped[${mappedType}] = mapped_column(${colArgs.join(', ')})\n`;
          }
        }

        // Auto-add timestamps if not present
        const colNames = table.columns.map(c => c.name.toLowerCase());
        if (!colNames.includes('created_at')) {
          out += `    created_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, server_default=func.now())\n`;
        }
        if (!colNames.includes('updated_at')) {
          out += `    updated_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, onupdate=func.now(), nullable=True)\n`;
        }

        out += `\n`;

        // Relationship fields
        for (const conn of incomingConns) {
          const refTable = tableById[conn.fromTableId];
          if (!refTable) continue;
          const refClassName = toPascalCase(toSingular(refTable.name));
          const propName = toCamelCase(toSingular(refTable.name));
          const relType = conn.type === 'one-to-one' ? `"${refClassName}"` : `"${refClassName}"`;
          out += `    ${propName}: Mapped[${relType}] = relationship(back_populates="${table.name}")\n`;
        }
        for (const conn of outgoingConns) {
          const manyTable = tableById[conn.toTableId];
          if (!manyTable) continue;
          const manyClassName = toPascalCase(toSingular(manyTable.name));
          
          if (conn.type === 'many-to-many') {
             out += `    ${manyTable.name}: Mapped[List["${manyClassName}"]] = relationship(secondary="junction_table_name", back_populates="${table.name}")\n`;
          } else if (conn.type === 'one-to-one') {
             out += `    ${toCamelCase(toSingular(manyTable.name))}: Mapped["${manyClassName}"] = relationship(back_populates="${toCamelCase(toSingular(table.name))}")\n`;
          } else {
             out += `    ${manyTable.name}: Mapped[List["${manyClassName}"]] = relationship(back_populates="${toCamelCase(toSingular(table.name))}")\n`;
          }
        }

        if (uqCols.length > 1) {
          const names = uqCols.map(c => `'${c.name}'`).join(', ');
          out += `\n    __table_args__ = (\n        UniqueConstraint(${names}, name='uq_${table.name}'),\n    )\n`;
        }

        out += `\n\n`;
      }

      return out.trimEnd() + '\n';
    },

    _pyType(rawType) {
      const { base } = TypeMapper.parse(rawType);
      const map = {
        INT: 'int', INTEGER: 'int', TINYINT: 'int', SMALLINT: 'int',
        BIGINT: 'int', FLOAT: 'float', DOUBLE: 'float', REAL: 'float',
        DECIMAL: 'float', NUMERIC: 'float',
        BOOLEAN: 'bool', BOOL: 'bool',
        VARCHAR: 'str', CHAR: 'str', TEXT: 'str',
        LONGTEXT: 'str', MEDIUMTEXT: 'str',
        DATE: 'Date', DATETIME: 'DateTime', TIMESTAMP: 'DateTime', TIME: 'Time',
        JSON: 'dict', JSONB: 'dict',
        BLOB: 'bytes', BINARY: 'bytes',
        UUID: 'str', EMAIL: 'str',
        SERIAL: 'int', BIGSERIAL: 'int'
      };
      return map[base] || 'str';
    }
  };

  /* ═══════════════════════════════════════════════
     🐘 LARAVEL ELOQUENT EXPORTER (PHP)
  ═══════════════════════════════════════════════ */
  const LaravelExporter = {
    export(tables, connections) {
      const tableById = {};
      for (const t of tables) { if (t.type !== 'note') tableById[t.id] = t; }

      let out = `<?php\n\n`;
      out += `// Generated by DB Designer\n`;
      out += `// Laravel Eloquent Models — ${new Date().toLocaleString('th-TH')}\n\n`;
      out += `namespace App\\Models;\n\n`;
      out += `use Illuminate\\Database\\Eloquent\\Model;\n`;
      out += `use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;\n`;
      out += `use Illuminate\\Database\\Eloquent\\Relations\\HasMany;\n`;
      out += `use Illuminate\\Database\\Eloquent\\Relations\\HasOne;\n`;
      out += `use Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;\n\n`;

      for (const table of tables) {
        if (table.type === 'note') continue;
        const className = toPascalCase(toSingular(table.name));
        const incomingConns = connections.filter(c => c.toTableId === table.id && c.type !== 'many-to-many');
        const outgoingConns = connections.filter(c => c.fromTableId === table.id && c.type !== 'many-to-many');
        const m2mConns = connections.filter(c => (c.toTableId === table.id || c.fromTableId === table.id) && c.type === 'many-to-many');
        const fkColNames = new Set(incomingConns.map(c => c.toColumn).filter(Boolean));

        out += `// ${'─'.repeat(50)}\n`;
        out += `class ${className} extends Model\n{\n`;
        out += `    protected $table = '${table.name}';\n\n`;

        // $fillable
        const fillable = table.columns
          .filter(c => !c.pk && !['created_at', 'updated_at'].includes(c.name.toLowerCase()))
          .map(c => `'${c.name}'`);
        if (fillable.length > 0) {
          out += `    protected $fillable = [\n`;
          for (const f of fillable) out += `        ${f},\n`;
          out += `    ];\n\n`;
        }

        // $casts
        const casts = [];
        for (const col of table.columns) {
          const cast = TypeMapper.toLaravelCast(col.type);
          if (cast && !col.pk && col.name !== 'created_at' && col.name !== 'updated_at') {
            casts.push(`'${col.name}' => '${cast}'`);
          }
        }
        if (casts.length > 0) {
          out += `    protected $casts = [\n`;
          for (const c of casts) out += `        ${c},\n`;
          out += `    ];\n\n`;
        }

        // BelongsTo relations
        for (const conn of incomingConns) {
          const refTable = tableById[conn.fromTableId];
          if (!refTable) continue;
          const refClassName = toPascalCase(toSingular(refTable.name));
          const methodName = toCamelCase(toSingular(refTable.name));
          out += `    public function ${methodName}(): BelongsTo\n`;
          out += `    {\n`;
          out += `        return $this->belongsTo(${refClassName}::class, '${conn.toColumn}', '${conn.fromColumn || 'id'}');\n`;
          out += `    }\n\n`;
        }

        // HasMany / HasOne relations
        for (const conn of outgoingConns) {
          const manyTable = tableById[conn.toTableId];
          if (!manyTable) continue;
          const manyClassName = toPascalCase(toSingular(manyTable.name));
          
          if (conn.type === 'one-to-one') {
             const methodName = toCamelCase(toSingular(manyTable.name));
             out += `    public function ${methodName}(): HasOne\n`;
             out += `    {\n`;
             out += `        return $this->hasOne(${manyClassName}::class, '${conn.toColumn}', '${conn.fromColumn || 'id'}');\n`;
             out += `    }\n\n`;
          } else {
             const methodName = manyTable.name.toLowerCase();
             out += `    public function ${methodName}(): HasMany\n`;
             out += `    {\n`;
             out += `        return $this->hasMany(${manyClassName}::class, '${conn.toColumn}', '${conn.fromColumn || 'id'}');\n`;
             out += `    }\n\n`;
          }
        }
        
        // BelongsToMany relations
        for (const conn of m2mConns) {
          const isFrom = conn.fromTableId === table.id;
          const otherTable = tableById[isFrom ? conn.toTableId : conn.fromTableId];
          if (!otherTable) continue;
          const otherClassName = toPascalCase(toSingular(otherTable.name));
          const methodName = otherTable.name.toLowerCase();
          const joinTableName = [table.name, otherTable.name].sort().join('_');
          
          out += `    public function ${methodName}(): BelongsToMany\n`;
          out += `    {\n`;
          out += `        return $this->belongsToMany(${otherClassName}::class, '${joinTableName}');\n`;
          out += `    }\n\n`;
        }

        out += `}\n\n`;
      }

      return out.trimEnd() + '\n';
    }
  };

  /* ═══════════════════════════════════════════════
     EXPORT TO GLOBAL
  ═══════════════════════════════════════════════ */
  global.PrismaExporter = PrismaExporter;
  global.TypeOrmExporter = TypeOrmExporter;
  global.GormExporter = GormExporter;
  global.SqlAlchemyExporter = SqlAlchemyExporter;
  global.LaravelExporter = LaravelExporter;

})(window);
