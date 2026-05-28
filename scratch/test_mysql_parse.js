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

const code = fs.readFileSync('../codeDB-test.txt', 'utf8');
const result = SqlParser.parse(code);

console.log('Tables parsed:', result.tables.map(t => t.name).join(', '));
console.log('\nConnections:');
result.connections.forEach(c => {
  const ft = result.tables.find(t => t.id === c.fromTableId);
  const tt = result.tables.find(t => t.id === c.toTableId);
  console.log(`${ft?.name} -> ${tt?.name} [${c.type}]`);
});
