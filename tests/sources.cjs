const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('app.js','utf8');let calls=[],stored={};
const journal={id:'https://openalex.org/S1',type:'journal',display_name:'Test Journal',issn:['1234-567X'],summary_stats:{h_index:130,'2yr_mean_citedness':6},cited_by_count:100000};
const ctx={console,Date,Map,Set,Promise,stripOpenAlex:s=>s.split('/').pop(),loadJSON:()=>stored,saveJSON:(_key,v)=>{stored=v;},oa:async(p,args)=>{calls.push({p,args});return {results:[journal]};}};
vm.createContext(ctx);vm.runInContext(code.slice(code.indexOf('function estimateQuartile('),code.indexOf('\nasync function oa(')),ctx);vm.runInContext(code.slice(code.indexOf('function journalNameKey('),code.indexOf('\nfunction showView(')),ctx);
(async()=>{
 const work={source:'Test Journal',sourceId:'',issns:['1234-567X'],q:'Q?'};await ctx.enrichSources([work],new Map());assert.equal(work.q,'Q1');assert.equal(calls[0].args.filter,'issn:1234-567X');
 calls=[];const cached={sourceId:'S1',q:'Q?'};ctx.oa=async()=>{throw Error('Network unavailable');};await ctx.enrichSources([cached],new Map());assert.equal(cached.q,'Q1');assert.equal(calls.length,0);
 const cachedCrossref={source:'Test Journal',sourceId:'',issns:['1234-567X'],q:'Q?'};await ctx.enrichSources([cachedCrossref],new Map());assert.equal(cachedCrossref.q,'Q1');
 const missing={q:'Q?'};ctx.applySourceEstimate(missing,{...journal,summary_stats:{}});assert.equal(missing.q,'Q?');ctx.applySourceEstimate(missing,{...journal,type:'repository'});assert.equal(missing.q,'Q?');
 const partial={};ctx.applySourceEstimate(partial,{...journal,summary_stats:{h_index:130}});assert.equal(partial.q,'Q1');assert.match(partial.qReason,/N\/A/);
 stored={};ctx.oa=async()=>({results:[{...journal,display_name:'Similar but wrong journal'}]});const wrong={source:'Test Journal',sourceId:'',q:'Q?'};await ctx.enrichSources([wrong],new Map());assert.equal(wrong.q,'Q?');
 console.log('PASS journal estimation: ISSN lookup, cached recovery, partial metrics, no fabricated unknown/repository ratings or fuzzy title matches');
})().catch(e=>{console.error(e);process.exit(1)});
