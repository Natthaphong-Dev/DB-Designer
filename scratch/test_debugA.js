const fs = require('fs');
global.window = global;
global.Utils = { uuid: () => Math.random().toString(36).substring(2, 9), tableColors: ['#000'] };
global.AppState = { 
  newColumn: opts => Object.assign({ id: Utils.uuid(), name: '' }, opts),
  newConnection: opts => Object.assign({ id: Utils.uuid(), type: 'one-to-many' }, opts),
  tables: [] 
};
eval(fs.readFileSync('../js/parsers.js', 'utf8'));
eval(fs.readFileSync('../js/sql.js', 'utf8'));
eval(fs.readFileSync('../js/exporters.js', 'utf8'));

const source = PrismaParser.parse(fs.readFileSync('../codeDB-test.txt', 'utf8'));
const saCode = SqlAlchemyExporter.export(source.tables, source.connections);

// Show User class M2M relationship
const saBlocks = saCode.split('# ─');
const userBlock = saBlocks.find(b => b.includes('class User('));
const userRels = userBlock?.split('\n').filter(l => l.includes('relationship'));
console.log('User relationships:', userRels);

// Show what SQLAlchemy parser gets from User class
// The parser uses: ForeignKey('table.id') to build connections
// M2M in SQLAlchemy is NOT via ForeignKey but via 'relationship(secondary=...)'
// The current SqlAlchemyParser only looks for ForeignKey - it doesn't parse M2M relationships!
console.log('\nSQLAlchemy parser supports M2M:', 
  fs.readFileSync('../js/parsers.js', 'utf8').includes('secondary') ? 'YES' : 'NO');

// Check GORM now
const gormCode = GormExporter.export(source.tables, source.connections);
const gormParsed = GormParser.parse(gormCode);
const addrT = gormParsed.tables.find(t => t.name === 'Address');
console.log('\nGORM Address columns:', addrT?.columns.map(c => c.name));
