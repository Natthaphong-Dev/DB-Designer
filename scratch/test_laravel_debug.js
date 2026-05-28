const fs = require('fs');
global.window = global;
global.Utils = { uuid: () => Math.random().toString(36).substring(2, 9), tableColors: ['#000'] };
global.AppState = { 
  newColumn: opts => Object.assign({ id: Utils.uuid(), name: '', pk: false, uq: false, ai: false }, opts),
  newConnection: opts => Object.assign({ id: Utils.uuid(), type: 'one-to-many' }, opts),
  tables: [] 
};
const parsers = fs.readFileSync('../js/parsers.js', 'utf8');
const exporters = fs.readFileSync('../js/exporters.js', 'utf8');
eval(parsers); eval(exporters);
const parsed = PrismaParser.parse(fs.readFileSync('../codeDB-test.txt', 'utf8'));
const laravelCode = LaravelExporter.export(parsed.tables, parsed.connections);

const classRegex = /class\s+(\w+)\s+extends\s+Model[^{]*\{([^}]*)\}/g;
let match;
while ((match = classRegex.exec(laravelCode)) !== null) {
  if (match[1] === 'Product') {
    const body = match[2];
    console.log('Product body:', body);
    const relRegex = /(belongsTo|hasMany)\s*\(\s*([^:]+)::class\s*(?:,\s*['"]([^'"]+)['"])?\s*(?:,\s*['"]([^'"]+)['"])?\s*\)/g;
    let relMatch;
    while ((relMatch = relRegex.exec(body)) !== null) {
      console.log('MATCH:', relMatch[1], relMatch[2], relMatch[3], relMatch[4]);
    }
  }
}
