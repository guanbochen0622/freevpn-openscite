const fs=require('node:fs'),assert=require('node:assert/strict');
const rows=fs.readFileSync('locales/ui.tsv','utf8').trim().split('\n').map(row=>row.split('|'));
const seen=new Set();for(const [index,row]of rows.entries()){
 assert.equal(row.length,5,`Five columns on row ${index+1}`);
 const key=row[0].trim().replace(/\s+/g,' ');assert.ok(!seen.has(key),`Duplicate ${key}`);seen.add(key);
 const vars=[...key.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort();
 for(const value of row){assert.ok(value.trim(),`Empty translation ${key}`);assert.deepEqual([...value.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),vars,`Placeholder mismatch: ${key}`);}
}
console.log(`PASS: ${rows.length} interface entries, five languages, no duplicates or missing interpolation variables.`);

// Run the real catalog-loading loop with Windows CRLF and a UTF-8 BOM.
(async()=>{
 const source=fs.readFileSync('i18n.js','utf8'),start=source.indexOf('for (const line'),end=source.indexOf('const aliases');
 const load=new Function('response','catalog','return (async()=>{'+source.slice(start,end)+'})();');
 const catalog=new Map();await load({text:async()=> '\uFEFF'+fs.readFileSync('locales/ui.tsv','utf8').replace(/\r?\n/g,'\r\n')},catalog);
 assert.equal(catalog.get('學術搜尋').ko,'논문 검색');
 for(const entry of catalog.values())for(const text of Object.values(entry))assert.doesNotMatch(text,/[\r\n]/);
 console.log('PASS Windows CRLF/BOM catalog input preserves exact interface strings');
})().catch(e=>{console.error(e);process.exitCode=1;});
