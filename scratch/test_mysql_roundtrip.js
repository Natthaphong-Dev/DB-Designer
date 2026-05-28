const fs = require('fs');
global.window = global;
global.Utils = { uuid: () => Math.random().toString(36).substring(2, 9), tableColors: ['#000'] };
global.AppState = { 
  newColumn: opts => Object.assign({ id: Utils.uuid(), name: '', pk: false, nn: false, uq: false, ai: false, fk: false, defaultVal: null }, opts),
  newConnection: opts => Object.assign({ id: Utils.uuid(), type: 'one-to-many' }, opts),
  tables: [] 
};

eval(fs.readFileSync('../js/parsers.js', 'utf8'));
eval(fs.readFileSync('../js/sql.js', 'utf8'));
eval(fs.readFileSync('../js/exporters.js', 'utf8'));

const source = SqlParser.parse(fs.readFileSync('../codeDB-test.txt', 'utf8'));
const sourceConns = source.connections;

function testFramework(name, exporterFn, parserObj) {
  console.log(`\n=== ${name} ===`);
  try {
    const code = exporterFn(source.tables, sourceConns);
    const parsed = parserObj.parse(code);
    const parsedConns = parsed.connections;
    
    console.log(`Source: ${sourceConns.length} connections, Parsed back: ${parsedConns.length}`);
    
    let ok = true;
    
    // Check missing
    for (const sc of sourceConns) {
      const sft = source.tables.find(t => t.id === sc.fromTableId);
      const stt = source.tables.find(t => t.id === sc.toTableId);
      
      const found = parsedConns.find(pc => {
        const pft = parsed.tables.find(t => t.id === pc.fromTableId);
        const ptt = parsed.tables.find(t => t.id === pc.toTableId);
        return pft?.name === sft?.name && ptt?.name === stt?.name && pc.type === sc.type;
      });
      
      if (!found) {
        console.log(`  MISSING: ${sft?.name} -> ${stt?.name} [${sc.type}]`);
        ok = false;
      }
    }
    
    // Check extra
    for (const pc of parsedConns) {
      const pft = parsed.tables.find(t => t.id === pc.fromTableId);
      const ptt = parsed.tables.find(t => t.id === pc.toTableId);
      
      const found = sourceConns.find(sc => {
        const sft = source.tables.find(t => t.id === sc.fromTableId);
        const stt = source.tables.find(t => t.id === sc.toTableId);
        return pft?.name === sft?.name && ptt?.name === stt?.name && pc.type === sc.type;
      });
      
      if (!found) {
        console.log(`  EXTRA:   ${pft?.name} -> ${ptt?.name} [${pc.type}]`);
        ok = false;
      }
    }
    
    if (ok) console.log('  OK - All connections match!');
  } catch(e) {
    console.log('  ERROR:', e.message);
  }
}

testFramework('MySQL', (t, c) => SqlExporter.export(t, c, 'mysql'), SqlParser);
testFramework('PostgreSQL', (t, c) => SqlExporter.export(t, c, 'postgresql'), SqlParser);
testFramework('SQLite', (t, c) => SqlExporter.export(t, c, 'sqlite'), SqlParser);
testFramework('Django', (t, c) => DjangoExporter.export(t, c), DjangoParser);
testFramework('Prisma', (t, c) => PrismaExporter.export(t, c), PrismaParser);
testFramework('SQLAlchemy', (t, c) => SqlAlchemyExporter.export(t, c), SqlAlchemyParser);
testFramework('TypeORM', (t, c) => TypeOrmExporter.export(t, c), TypeOrmParser);
testFramework('GORM', (t, c) => GormExporter.export(t, c), GormParser);
testFramework('Laravel', (t, c) => LaravelExporter.export(t, c), LaravelParser);
