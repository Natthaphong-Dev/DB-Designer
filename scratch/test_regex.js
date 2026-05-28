const body = "return $this->belongsTo(Brand::class, 'brandId', 'id');";
const relRegex = /(belongsTo|hasMany)\s*\(\s*([^:]+)::class\s*(?:,\s*['"]([^'"]+)['"])?\s*(?:,\s*['"]([^'"]+)['"])?\s*\)/g;
let relMatch;
while ((relMatch = relRegex.exec(body)) !== null) {
  console.log(relMatch[1], relMatch[2], relMatch[3], relMatch[4]);
}
