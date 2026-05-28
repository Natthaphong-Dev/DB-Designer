const fs = require('fs');
global.window = global;
global.Utils = { uuid: () => Math.random().toString(36).substring(2, 9), tableColors: ['#000'] };
global.AppState = { 
  newColumn: opts => Object.assign({ id: Utils.uuid(), name: '', pk: false, nn: false, uq: false, ai: false, fk: false, defaultVal: null }, opts),
  newConnection: opts => Object.assign({ id: Utils.uuid(), type: 'one-to-many' }, opts),
  tables: [] 
};
const parsers = fs.readFileSync('../js/parsers.js', 'utf8');
const sql = fs.readFileSync('../js/sql.js', 'utf8');
const exporters = fs.readFileSync('../js/exporters.js', 'utf8');
eval(parsers); eval(sql); eval(exporters);

const source = PrismaParser.parse(fs.readFileSync('../codeDB-test.txt', 'utf8'));

// Debug SQLite - the regex matches but quotes are left on column name!
const sqliteCode = SqlExporter.export(source.tables, source.connections, 'sqlite');
// Simulate what _parseBody does step by step
const ctRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?(\w+)[`"\]]?\s*\(([^;]+?)\)\s*;/gi;
let m;
while ((m = ctRegex.exec(sqliteCode)) !== null) {
  if (m[1] === 'Address') {
    console.log('=== Address body ===');
    console.log(m[2]);
    console.log('\n');
    
    // Simulate _splitComma
    const body = m[2];
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of body) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    
    for (const raw of parts) {
      const part = raw.trim();
      if (!part) continue;
      // FK regex
      const fkM = part.match(/(?:CONSTRAINT\s+[`"']?\w+[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i);
      if (fkM) {
        console.log('FK match found:');
        console.log('  fromCol (raw):', fkM[1]);
        console.log('  toTable:', fkM[2]);
        console.log('  toCol (raw):', fkM[3]);
      }
    }
  }
}
