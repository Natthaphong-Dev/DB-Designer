const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><html><body><select id='sql-dialect'><option value='mysql'></option></select><textarea id='sql-editor'>CREATE TABLE test (id INT);</textarea></body></html>`);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

eval(fs.readFileSync('js/utils.js', 'utf8'));
eval(fs.readFileSync('js/state.js', 'utf8'));
eval(fs.readFileSync('js/sql.js', 'utf8'));
eval(fs.readFileSync('js/parsers.js', 'utf8'));
eval(fs.readFileSync('js/exporters.js', 'utf8'));

try {
  const result = window.SqlParser.parse('CREATE TABLE users (id INT PRIMARY KEY);');
  console.log('SUCCESS:', JSON.stringify(result, null, 2));
} catch(e) {
  console.error('ERROR:', e.stack);
}
