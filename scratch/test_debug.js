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

// --- Debug SQLite ---
const sqliteCode = SqlExporter.export(source.tables, source.connections, 'sqlite');
console.log('=== SQLITE sample ===');
console.log(sqliteCode.substring(0, 500));

// --- Debug TypeORM FK column name ---
const typeormCode = TypeOrmExporter.export(source.tables, source.connections);
const lines = typeormCode.split('\n').filter(l => l.includes('nameId'));
console.log('\n=== TYPEORM nameId lines ===');
lines.forEach(l => console.log(l));

// --- Debug Django table names ---
const djangoCode = DjangoExporter.export(source.tables, source.connections);
const dlines = djangoCode.split('\n').filter(l => l.startsWith('class '));
console.log('\n=== DJANGO classes ===');
dlines.forEach(l => console.log(l));

// --- Debug SQLAlchemy M2M ---
const saCode = SqlAlchemyExporter.export(source.tables, source.connections);
const salines = saCode.split('\n').filter(l => l.includes('ForeignKey') || l.includes('secondary'));
console.log('\n=== SQLALCHEMY M2M/FK ===');
salines.forEach(l => console.log(l));

// --- Debug GORM output ---
const gormCode = GormExporter.export(source.tables, source.connections);
const glines = gormCode.split('\n').filter(l => l.includes('TableName'));
console.log('\n=== GORM table names ===');
glines.forEach(l => console.log(l));
