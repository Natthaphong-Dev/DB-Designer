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

// Debug 1: M2M direction - why reversed?
const m2m = source.connections.find(c => c.type === 'many-to-many');
const ft = source.tables.find(t => t.id === m2m.fromTableId);
const tt = source.tables.find(t => t.id === m2m.toTableId);
console.log('Source M2M: fromTable=', ft.name, 'toTable=', tt.name);
// fromTableId is Branch (the "one" side that has User[])
// toTableId is User (the other side)
// So Branch.id -> User.id is the CORRECT source representation

// When MySQL parser sees Branch_User junction table:
// tFks[0] points to Branch, tFks[1] points to User
// So connections.push({fromTableId: User.id, toTableId: Branch.id}) -- this is SWAPPED!
const mysqlCode = SqlExporter.export(source.tables, source.connections, 'mysql');
const mysqlParsed = SqlParser.parse(mysqlCode);
const mysqlM2m = mysqlParsed.connections.find(c => c.type === 'many-to-many');
if (mysqlM2m) {
  const mft = mysqlParsed.tables.find(t => t.id === mysqlM2m.fromTableId);
  const mtt = mysqlParsed.tables.find(t => t.id === mysqlM2m.toTableId);
  console.log('MySQL parsed M2M: fromTable=', mft?.name, 'toTable=', mtt?.name);
}

// Debug 2: TypeORM nameId - check what the regex captures
const typeormCode = TypeOrmExporter.export(source.tables, source.connections);
// Find Address entity block
const typeormBlocks = typeormCode.split('@Entity');
const addrBlock = typeormBlocks.find(b => b.includes('class Address'));
if (addrBlock) {
  console.log('\n=== TypeORM Address block (first 600) ===');
  console.log(addrBlock.substring(0, 600));
  
  // Test the new regex
  const relRegex = /@(ManyToOne|OneToOne)\s*\(\s*\(\)\s*=>\s*(\w+)[^)]*\)([\s\S]*?)(?:public\s+|private\s+|protected\s+)?(\w+)\s*:/g;
  let r;
  while ((r = relRegex.exec(addrBlock)) !== null) {
    const betweenDecorators = r[3];
    const jcMatch = betweenDecorators.match(/@JoinColumn\s*\(\s*\{\s*name:\s*['"]([^'"]+)['"]/);
    console.log('\nRelation match:');
    console.log('  relType:', r[1]);
    console.log('  targetClass:', r[2]);
    console.log('  propName:', r[4]);
    console.log('  between decorators:', betweenDecorators.trim());
    console.log('  JoinColumn match:', jcMatch ? jcMatch[1] : 'NONE');
  }
}

// Debug 3: GORM column names
const gormCode = GormExporter.export(source.tables, source.connections);
const gormBlocks = gormCode.split('// ─');
const gormAddr = gormBlocks.find(b => b.includes('type Address'));
console.log('\n=== GORM Address struct ===');
console.log(gormAddr?.substring(0, 400));
