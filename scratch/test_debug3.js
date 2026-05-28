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

// Debug SQLite FK inline parsing
const sqliteCode = SqlExporter.export(source.tables, source.connections, 'sqlite');
// The sqlite parser uses _parseBody to capture inline CONSTRAINT FK
// Let's test the regex
const testBody = `
  \`id\` INT AUTO_INCREMENT NOT NULL,
  \`userId\` INT NOT NULL,
  PRIMARY KEY (\`id\`),
  CONSTRAINT "fk_userId" FOREIGN KEY ("userId") REFERENCES "User" ("id")
`;
// Check if current regex handles mixed backtick/doublequote
const fkM = testBody.match(/(?:CONSTRAINT\s+[`"']?\w+[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i);
console.log('SQLite mixed-quote FK match:', fkM ? [fkM[1], fkM[2], fkM[3]] : 'FAILED');

// Check the full parsedBody result for address table
const sqliteResult = SqlParser.parse(sqliteCode);
console.log('\nSQLite parsed conns:', sqliteResult.connections.length);
console.log('SQLite parsed Address columns:', sqliteResult.tables.find(t => t.name === 'Address')?.columns.map(c => c.name));
