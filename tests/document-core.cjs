const assert=require('node:assert/strict'),D=require('../document-core.js');
const evidence=D.segments(['Sensor response is 980 nm.\nConcentration is 10⁻¹⁴.','Different page.'],'concentration',1);
const first=evidence.find(x=>x.page===1);
const claims=D.validateAnswer({claims:[{text:'At 980 nm.',kind:'observation',sources:[{id:first.id,quote:'Sensor response is 980 nm.'},{id:'p999s1',quote:'fabricated'}]}]},evidence);
assert.equal(claims[0].sources.length,1);assert.equal(claims[0].rejected,1);
assert.equal(D.validateAnswer({claims:[{text:'Wrong power',sources:[{id:first.id,quote:'Concentration is 10−14.'}]}]},evidence)[0].sources.length,0);
assert.throws(()=>D.validateAnswer('Here is some JSON',evidence));
assert.throws(()=>D.validateStructure({formulas:[],tables:[{title:'x',headers:['A','B'],rows:[['one']],uncertainty:''}],notes:''}));
const table={title:'x',headers:['Name','Value'],rows:[['=1+1','10⁻¹⁴'],['a,"b','-10']],uncertainty:''};assert.match(D.csv(table),/"'=1\+1"/);assert.match(D.csv(table),/10⁻¹⁴/);assert.match(D.csv(table),/a,""b/);
const ocr=D.ocrLines({confidence:88,blocks:[{paragraphs:[{lines:[{words:[{text:'980',confidence:90,bbox:{x0:10,y0:20,x1:40,y1:30}},{text:'nm',confidence:80,bbox:{x0:45,y0:20,x1:65,y1:30}}]}]}]}]},100,100);assert.equal(ocr.text,'980 nm');assert.deepEqual(ocr.lines[0].words[0].rect,[.1,.2,.3,.1]);
const chunks=D.segments(['a'.repeat(10000),'current page evidence'],'a',2);assert.ok(chunks.some(x=>x.page===2));assert.ok(chunks.every(x=>x.text.length<=700));
console.log('PASS exact evidence validation, exponent distinction, table dimensions, CSV injection protection, OCR geometry and bounded context');

assert.throws(()=>D.validateAnswer(null,evidence));
assert.throws(()=>D.validateStructure(null));
assert.equal(D.validateAnswer({claims:[{text:'Unsupported [Page 1]',sources:[null]}]},evidence)[0].text,'Unsupported');
assert.equal(D.validateAnswer({claims:[{text:'Unsupported',sources:[null]}]},evidence)[0].rejected,1);
