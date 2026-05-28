const fs = require('fs');

// Mock browser globals
global.window = global;
global.Utils = {
  uuid: () => Math.random().toString(36).substring(2, 9),
  tableColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
  sqlTypes: ['INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'DECIMAL', 'JSON']
};
global.AppState = {
  newColumn: (opts) => Object.assign({ id: Utils.uuid(), name: '', type: 'VARCHAR(255)', pk: false, nn: false, uq: false, ai: false, fk: false, defaultVal: null }, opts),
  newConnection: (opts) => Object.assign({ id: Utils.uuid(), fromTableId: '', fromColumn: '', toTableId: '', toColumn: '', type: 'one-to-many', label: '' }, opts),
  tables: [] // Add this for sql.js reference
};

// Load scripts
const parsersCode = fs.readFileSync('../js/parsers.js', 'utf8');
const sqlCode = fs.readFileSync('../js/sql.js', 'utf8');
const exportersCode = fs.readFileSync('../js/exporters.js', 'utf8');

eval(parsersCode);
eval(sqlCode);
eval(exportersCode);

const prismaCode = fs.readFileSync('../codeDB-test.txt', 'utf8');
const parsed = PrismaParser.parse(prismaCode);
AppState.tables = parsed.tables;

console.log("=== PRISMA PARSED ===");
console.log(`Tables: ${parsed.tables.length}, Connections: ${parsed.connections.length}`);
parsed.connections.forEach(c => {
  const fromT = parsed.tables.find(t => t.id === c.fromTableId);
  const toT = parsed.tables.find(t => t.id === c.toTableId);
  console.log(`${fromT.name}.${c.fromColumn} -> ${toT.name}.${c.toColumn} [${c.type}]`);
});

// Test TypeORM Export
const typeOrmCode = TypeOrmExporter.export(parsed.tables, parsed.connections);
const typeOrmParsed = TypeOrmParser.parse(typeOrmCode);
console.log("\n=== TYPEORM PARSED BACK ===");
console.log(`Connections: ${typeOrmParsed.connections.length}`);
typeOrmParsed.connections.forEach(c => {
  const fromT = typeOrmParsed.tables.find(t => t.id === c.fromTableId);
  const toT = typeOrmParsed.tables.find(t => t.id === c.toTableId);
  console.log(`${fromT.name}.${c.fromColumn} -> ${toT.name}.${c.toColumn} [${c.type}]`);
});

// Test MySQL Export
const mysqlCode = SqlExporter.export(parsed.tables, parsed.connections, 'mysql');
const mysqlParsed = SqlParser.parse(mysqlCode);
console.log("\n=== MYSQL PARSED BACK ===");
console.log(`Connections: ${mysqlParsed.connections.length}`);
mysqlParsed.connections.forEach(c => {
  const fromT = mysqlParsed.tables.find(t => t.id === c.fromTableId);
  const toT = mysqlParsed.tables.find(t => t.id === c.toTableId);
  console.log(`${fromT.name}.${c.fromColumn} -> ${toT.name}.${c.toColumn} [${c.type}]`);
});

// Test SQLAlchemy Export
const saCode = SqlAlchemyExporter.export(parsed.tables, parsed.connections);
const saParsed = SqlAlchemyParser.parse(saCode);
console.log("\n=== SQLALCHEMY PARSED BACK ===");
console.log(`Connections: ${saParsed.connections.length}`);
saParsed.connections.forEach(c => {
  const fromT = saParsed.tables.find(t => t.id === c.fromTableId);
  const toT = saParsed.tables.find(t => t.id === c.toTableId);
  console.log(`${fromT.name}.${c.fromColumn} -> ${toT.name}.${c.toColumn} [${c.type}]`);
});

// Test Laravel Export
const laravelCode = LaravelExporter.export(parsed.tables, parsed.connections);
const laravelParsed = LaravelParser.parse(laravelCode);
console.log("\n=== LARAVEL PARSED BACK ===");
console.log(`Connections: ${laravelParsed.connections.length}`);
laravelParsed.connections.forEach(c => {
  const fromT = laravelParsed.tables.find(t => t.id === c.fromTableId);
  const toT = laravelParsed.tables.find(t => t.id === c.toTableId);
  console.log(`${fromT.name}.${c.fromColumn} -> ${toT.name}.${c.toColumn} [${c.type}]`);
});
