const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('app.js','utf8');
const source=code.slice(code.indexOf('async function loadPdfBuffer('),code.indexOf('\nfunction capturePdfScrollAnchor('));
const nodes=new Map(),events=[],tasks=[];
const node=()=>({classList:{add(){},remove(){}},textContent:'',innerHTML:'',value:''});
const ctx={console,URL,setTimeout,clearTimeout,document:{baseURI:'https://example.com/',dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type){this.type=type}},window:{pdfjsLib:true},state:{reader:{renderToken:0}},STORE:{},$:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},loadJSON:()=>[],readerKey:()=>'',hideSelectionUi(){},updateReaderMeta(){},renderNotes(){},renderPdfPages:async()=>{},indexPdfText:async()=>{},updateCitationInfo(){},toast(){},pdfjsLib:{getDocument(){let resolve,reject;const task={promise:new Promise((a,b)=>{resolve=a;reject=b}),destroyed:false,destroy:async()=>{task.destroyed=true},resolve,reject};tasks.push(task);return task}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
function pdf(){return {numPages:12,destroyed:false,async destroy(){this.destroyed=true}}}
(async()=>{
 const a=pdf(),b=pdf();const load=(name)=>ctx.loadPdfBuffer(new ArrayBuffer(8),{title:name},name);
 let run=load('first');tasks.at(-1).resolve(a);await run;assert.equal(ctx.state.reader.pdf,a);
 run=load('broken');tasks.at(-1).reject(new Error('Invalid PDF'));await run;assert.equal(ctx.state.reader.pdf,a);assert.equal(a.destroyed,false);
 const slow=load('slow'),slowTask=tasks.at(-1);const fast=load('fast');tasks.at(-1).resolve(b);await fast;slowTask.resolve(pdf());await slow;
 assert.equal(ctx.state.reader.pdf,b);assert.equal(ctx.state.reader.meta.title,'fast');assert.equal(a.destroyed,true);assert.equal(slowTask.destroyed,true);
 ctx.setTimeout=(fn)=>setTimeout(fn,5);const stalled=load('stalled'),stalledTask=tasks.at(-1);await stalled;assert.equal(stalledTask.destroyed,true);assert.equal(ctx.state.reader.pdf,b);
 console.log('PASS: stalled parse timeout preserves document;  first open, failed replacement preserves document, latest load wins, stale task cleanup.');
})().catch(e=>{console.error(e);process.exit(1)});
