// Test GORM tag regex
const line = '\tUserId int `gorm:"column:userId;type:int;not null;index" json:"userId"`';
console.log('line:', line);

// This is the regex used in parsers.js: /`gorm:"([^"]+)"`/
const tag1 = line.match(/`gorm:"([^"]+)"`/);
console.log('tag1 (backtick regex):', tag1 ? tag1[1] : 'NONE');

// Alternative without backtick requirement
const tag2 = line.match(/gorm:"([^"]+)"/);
console.log('tag2 (no backtick):', tag2 ? tag2[1] : 'NONE');

if (tag2) {
  const colMatch = tag2[1].match(/column:([^;]+)/);
  console.log('column:', colMatch ? colMatch[1].trim() : 'NONE');
}
