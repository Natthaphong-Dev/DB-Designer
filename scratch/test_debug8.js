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
const djangoCode = DjangoExporter.export(source.tables, source.connections);

// Patch _resolveConnections to log output for Django
const origDjangoParser = { ...DjangoParser };
const origParse = DjangoParser.parse.bind(DjangoParser);
const djangoParsed = DjangoParser.parse(djangoCode);

// Check all connections
console.log('All Django connections:');
for (const c of djangoParsed.connections) {
  const ft = djangoParsed.tables.find(t => t.id === c.fromTableId);
  const tt = djangoParsed.tables.find(t => t.id === c.toTableId);
  console.log(`  ${ft?.name}.${c.fromColumn} -> ${tt?.name}.${c.toColumn} [${c.type}]`);
}

// Check DjangoParser.parse rawConns by adding debug
console.log('\nDjango table names:', djangoParsed.tables.map(t => t.name).join(', '));

// Check Branch 1:N connections - is there one between Branch and User?
const branchUser = djangoParsed.connections.filter(c => {
  const ft = djangoParsed.tables.find(t => t.id === c.fromTableId);
  const tt = djangoParsed.tables.find(t => t.id === c.toTableId);
  return (ft?.name === 'Branch' || tt?.name === 'Branch') && (ft?.name === 'User' || tt?.name === 'User');
});
console.log('\nBranch-User connections:', branchUser.map(c => {
  const ft = djangoParsed.tables.find(t => t.id === c.fromTableId);
  const tt = djangoParsed.tables.find(t => t.id === c.toTableId);
  return `${ft?.name} -> ${tt?.name} [${c.type}]`;
}));
