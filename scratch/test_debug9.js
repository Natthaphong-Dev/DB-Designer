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
const gormCode = GormExporter.export(source.tables, source.connections);

// Test column: tag regex on real line
const testLine = '\tUserId int `gorm:"column:userId;type:int;not null;index" json:"userId"`';
const tag = testLine.match(/`gorm:"([^"]+)"`/);
console.log('Tag match:', tag ? tag[1] : 'NONE');
if (tag) {
  const colMatch = tag[1].match(/column:([^;]+)/);
  console.log('Column match:', colMatch ? colMatch[1] : 'NONE');
}

// Check what GORM parser actually does with this line
const gormParsed = GormParser.parse(gormCode);
const addrT = gormParsed.tables.find(t => t.name === 'Address');
console.log('\nAddress columns:', addrT?.columns.map(c => c.name));
console.log('Address conns:', gormParsed.connections
  .filter(c => c.fromTableId === addrT?.id || c.toTableId === addrT?.id)
  .map(c => {
    const ft = gormParsed.tables.find(t => t.id === c.fromTableId);
    const tt = gormParsed.tables.find(t => t.id === c.toTableId);
    return `${ft?.name}.${c.fromColumn} -> ${tt?.name}.${c.toColumn} [${c.type}]`;
  })
);

// Trace the parser manually on Address block  
const addrBlock = gormCode.split('// ─').find(b => b.includes('type Address'));
const lines = addrBlock.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
console.log('\nGORM Address lines:');
for (const line of lines) {
  const tag = line.match(/`gorm:"([^"]+)"`/);
  if (!tag) { console.log('  [no tag]', line); continue; }
  const colMatch = tag[1].match(/column:([^;]+)/);
  console.log('  column tag:', colMatch ? colMatch[1].trim() : 'NONE', '| line:', line.substring(0, 60));
}

// SQLAlchemy M2M debug
const saCode = SqlAlchemyExporter.export(source.tables, source.connections);
const saParsed = SqlAlchemyParser.parse(saCode);
console.log('\nSQLAlchemy connections:', saParsed.connections.length);
const saM2m = saParsed.connections.find(c => c.type === 'many-to-many');
console.log('SQLAlchemy M2M:', saM2m ? 'found' : 'NOT FOUND');
// Check if Branch has any relationship annotation
const saBlock = saCode.split('# ─').find(b => b.includes('class Branch'));
const saRels = saBlock?.split('\n').filter(l => l.includes('relationship'));
console.log('Branch relationships in SA:', saRels);
