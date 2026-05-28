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

// Debug SQLite: check what CREATE TABLE regex captures
const sqliteCode = SqlExporter.export(source.tables, source.connections, 'sqlite');
console.log('=== SQLITE FK lines ===');
sqliteCode.split('\n').filter(l => l.includes('FOREIGN KEY') || l.includes('CONSTRAINT')).forEach(l => console.log(l));

// Debug SQLAlchemy: User table output
const saCode = SqlAlchemyExporter.export(source.tables, source.connections);
const saUser = saCode.split('# ─').find(b => b.includes('class User('));
console.log('\n=== SQLALCHEMY User class ===');
console.log('# ─' + saUser?.substring(0, 600));

// Debug TypeORM: check JoinColumn
const typeormCode = TypeOrmExporter.export(source.tables, source.connections);
const typeormAddr = typeormCode.split('// ─').find(b => b.includes('class Address'));
console.log('\n=== TYPEORM Address class ===');
console.log(typeormAddr?.substring(0, 600));

// Debug GORM: check what GORM parser expects for table names
const gormCode = GormExporter.export(source.tables, source.connections);
const gormAddr = gormCode.split('// ─').find(b => b.includes('type Address'));
console.log('\n=== GORM Address struct ===');
console.log(gormAddr?.substring(0, 600));
const gormParsed = GormParser.parse(gormCode);
console.log('\nGORM parsed tables:', gormParsed.tables.map(t => t.name).join(', '));

// Debug Django: check what the parser does to table name "User"
const djangoCode = DjangoExporter.export(source.tables, source.connections);
const djangoParsed = DjangoParser.parse(djangoCode);
console.log('\nDjango parsed tables:', djangoParsed.tables.map(t => t.name).join(', '));
