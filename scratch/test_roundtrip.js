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
const srcConns = source.connections;

function compareConns(label, parsed) {
  const pConns = parsed.connections;
  console.log(`\n=== ${label} ===`);
  console.log(`Source: ${srcConns.length} connections, Parsed back: ${pConns.length}`);

  // Check each source connection exists in parsed
  let missing = 0;
  for (const sc of srcConns) {
    const sfrom = source.tables.find(t => t.id === sc.fromTableId);
    const sto = source.tables.find(t => t.id === sc.toTableId);
    if (!sfrom || !sto) continue;
    const key = `${sfrom.name}.${sc.fromColumn} -> ${sto.name}.${sc.toColumn} [${sc.type}]`;

    // Find matching in parsed
    const found = pConns.find(pc => {
      const pfrom = parsed.tables.find(t => t.id === pc.fromTableId);
      const pto = parsed.tables.find(t => t.id === pc.toTableId);
      if (!pfrom || !pto) return false;
      return pfrom.name.toLowerCase() === sfrom.name.toLowerCase() &&
             pto.name.toLowerCase() === sto.name.toLowerCase() &&
             pc.fromColumn === sc.fromColumn &&
             pc.toColumn === sc.toColumn &&
             pc.type === sc.type;
    });
    if (!found) {
      console.log(`  MISSING: ${key}`);
      missing++;
    }
  }

  // Check for extra connections
  for (const pc of pConns) {
    const pfrom = parsed.tables.find(t => t.id === pc.fromTableId);
    const pto = parsed.tables.find(t => t.id === pc.toTableId);
    if (!pfrom || !pto) continue;
    const key = `${pfrom.name}.${pc.fromColumn} -> ${pto.name}.${pc.toColumn} [${pc.type}]`;

    const found = srcConns.find(sc => {
      const sfrom = source.tables.find(t => t.id === sc.fromTableId);
      const sto = source.tables.find(t => t.id === sc.toTableId);
      if (!sfrom || !sto) return false;
      return sfrom.name.toLowerCase() === pfrom.name.toLowerCase() &&
             sto.name.toLowerCase() === pto.name.toLowerCase() &&
             sc.fromColumn === pc.fromColumn &&
             sc.toColumn === pc.toColumn &&
             sc.type === pc.type;
    });
    if (!found) {
      console.log(`  EXTRA:   ${key}`);
    }
  }
  if (missing === 0) console.log('  OK - All connections match!');
}

// Test each exporter→parser pair
const mysqlCode = SqlExporter.export(source.tables, source.connections, 'mysql');
compareConns('MySQL', SqlParser.parse(mysqlCode));

const pgCode = SqlExporter.export(source.tables, source.connections, 'postgresql');
compareConns('PostgreSQL', SqlParser.parse(pgCode));

const sqliteCode = SqlExporter.export(source.tables, source.connections, 'sqlite');
compareConns('SQLite', SqlParser.parse(sqliteCode));

const djangoCode = DjangoExporter.export(source.tables, source.connections);
compareConns('Django', DjangoParser.parse(djangoCode));

const prismaCode = PrismaExporter.export(source.tables, source.connections);
compareConns('Prisma', PrismaParser.parse(prismaCode));

const sqlalchemyCode = SqlAlchemyExporter.export(source.tables, source.connections);
compareConns('SQLAlchemy', SqlAlchemyParser.parse(sqlalchemyCode));

const typeormCode = TypeOrmExporter.export(source.tables, source.connections);
compareConns('TypeORM', TypeOrmParser.parse(typeormCode));

const gormCode = GormExporter.export(source.tables, source.connections);
compareConns('GORM', GormParser.parse(gormCode));

const laravelCode = LaravelExporter.export(source.tables, source.connections);
compareConns('Laravel', LaravelParser.parse(laravelCode));
