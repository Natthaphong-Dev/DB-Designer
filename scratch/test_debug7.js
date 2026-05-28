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

// Manually trace DjangoParser parsing of User class
const clean = djangoCode.replace(/#.*$/gm, '').trim();
const classBlocks = clean.split(/^class\s+/m).filter(b => b.trim());
for (const block of classBlocks) {
  const classMatch = block.match(/^(\w+)(?:\([^)]*\))?:/);
  if (!classMatch) continue;
  const className = classMatch[1];
  if (className !== 'User') continue;
  
  console.log('User class block start:');
  console.log(block.substring(0, 600));
  
  // find ManyToManyField
  const fieldRegex = /^\s*(\w+)\s*=\s*models\.(\w+)\s*\(([\s\S]*?)\)/gm;
  let match;
  while ((match = fieldRegex.exec(block)) !== null) {
    if (match[2] === 'ManyToManyField') {
      const targetMatch = match[3].match(/^\s*['"']?(\w+)['"']?/);
      console.log('Found M2M field:', match[1], 'to:', targetMatch ? targetMatch[1] : 'unknown');
    }
  }
}

// Check DjangoParser._toTableName result for Branch
console.log('\n_toTableName(Branch):', DjangoParser._toTableName('Branch'));
console.log('_toTableName(User):', DjangoParser._toTableName('User'));
