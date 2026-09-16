const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const ctx={setTimeout,state:{reader:{renderToken:7,pageTexts:[],pdf:{numPages:3,async getPage(n){return {async getTextContent(){if(n===2)throw Error('Test font failure');return {items:[{str:'Page '+n}]}}}}}}},$:()=>({textContent:''})};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function indexPdfText('),source.indexOf('\nfunction matrixApply(')),ctx);
(async()=>{await ctx.indexPdfText(7);assert.equal(ctx.state.reader.indexReady,true);assert.equal(ctx.state.reader.pageTexts[1],'');assert.equal(ctx.state.reader.indexErrors[0].page,2);assert.match(ctx.state.reader.fullText,/Page 3/);console.log('PASS: failed page does not prevent indexing later pages; page/error retained.');})().catch(e=>{console.error(e);process.exit(1)});
