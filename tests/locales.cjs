const fs=require('node:fs'),assert=require('node:assert/strict');
const rows=fs.readFileSync('locales/ui.tsv','utf8').trim().split('\n').map(row=>row.split('|'));
const seen=new Set();for(const [index,row]of rows.entries()){
 assert.equal(row.length,5,`Five columns on row ${index+1}`);
 const key=row[0].trim().replace(/\s+/g,' ');assert.ok(!seen.has(key),`Duplicate ${key}`);seen.add(key);
 const vars=[...key.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort();
 for(const value of row){assert.ok(value.trim(),`Empty translation ${key}`);assert.deepEqual([...value.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),vars,`Placeholder mismatch: ${key}`);}
}
console.log(`PASS: ${rows.length} interface entries, five languages, no duplicates or missing interpolation variables.`);
