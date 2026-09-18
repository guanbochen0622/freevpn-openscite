const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const PdfText=require('../pdf-text.js');
const item=(str,x,y,size=12,width=str.length*6)=>({str,transform:[size,0,0,size,x,y],width,height:size});
const tc={styles:{},items:[item('10',50,700,12,14),item('−14',64,705,8,16),item('H',50,650,12,8),item('2',58,647,8,5),item('O',63,650,12,8),item('α β μ µ ± × ≤ ≥',50,600)]};
assert.match(PdfText.analyze(tc).text,/10⁻¹⁴/);assert.match(PdfText.analyze(tc).text,/H₂O/);assert.match(PdfText.analyze(tc).text,/α β μ µ ± × ≤ ≥/);
assert.equal(PdfText.clean('10−14 ≠ 10⁻¹⁴'),'10−14 ≠ 10⁻¹⁴');assert.equal(PdfText.scriptText('eff','sub'),'_{eff}');
console.log('PASS scientific text geometry, superscripts, subscripts and symbols');

const lowSub={styles:{},items:[item('n',100,298.773,9.9626,5),item('silica_core',105,297.279,7.2727,31),item(')',104,290,9.9626,0)]};
assert.match(PdfText.analyze(lowSub).text,/n_\{silica_core\}/);
assert.equal(PdfText.analyze({styles:{},items:[item('n',100,300,12,6),item(' ',106,304,8,3)]}).items[1].readerScript,'');
