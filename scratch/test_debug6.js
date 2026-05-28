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

// Debug GORM: check if column tag is being read
const gormCode = GormExporter.export(source.tables, source.connections);
const gormBlocks = gormCode.split('// ─');
const gormAddr = gormBlocks.find(b => b.includes('type Address'));
console.log('=== GORM Address block ===');
console.log(gormAddr?.substring(0, 500));

// Check what GORM parser gets for Address
const gormParsed = GormParser.parse(gormCode);
const addrT = gormParsed.tables.find(t => t.name === 'Address');
console.log('\nGORM Address table name:', addrT?.name);
console.log('GORM Address columns:', addrT?.columns.map(c => c.name));

// Debug Django M2M direction  
const djangoCode = DjangoExporter.export(source.tables, source.connections);
// Check Django M2M output for Branch
const djangoLines = djangoCode.split('\n');
const branchStart = djangoLines.findIndex(l => l.includes('class Branch'));
if (branchStart >= 0) {
  console.log('\n=== Django Branch class ===');
  console.log(djangoLines.slice(branchStart, branchStart + 20).join('\n'));
}

// Debug TypeORM M2M
const typeormCode = TypeOrmExporter.export(source.tables, source.connections);
const typeormBlocks = typeormCode.split('// ─');
const branchBlock = typeormBlocks.find(b => b.includes('class Branch'));
if (branchBlock) {
  console.log('\n=== TypeORM Branch ===');
  console.log(branchBlock.substring(0, 600));
}

// Debug SQLAlchemy M2M
const saCode = SqlAlchemyExporter.export(source.tables, source.connections);
const saBlocks = saCode.split('# ─');
const branchSa = saBlocks.find(b => b.includes('class Branch'));
console.log('\n=== SQLAlchemy Branch ===');
console.log(branchSa?.substring(0, 500));
