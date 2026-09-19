/* Persistent evidence and knowledge-map model. Exact quotes establish provenance only. */
(function(root){
'use strict';
const normalize=s=>String(s??'').normalize('NFC').replace(/\s+/g,' ').trim();
const kinds=new Set(['observation','author_claim','inference','insufficient']);
function snapshot(key,claims){
 return {version:1,key:String(key),claims:(claims||[]).slice(0,8).map(c=>({text:String(c.text||'').slice(0,3000),kind:kinds.has(c.kind)?c.kind:'inference',rejected:Math.max(0,Number(c.rejected)||0),sources:(c.sources||[]).slice(0,8).map(s=>({page:Number(s.page),quote:String(s.quote||'').slice(0,3000)}))}))};
}
function restore(record,key,pages){
 if(!record||record.version!==1||record.key!==key||!Array.isArray(record.claims)||record.claims.length>8)return null;
 const claims=[];
 for(const c of record.claims){
  if(!c||typeof c.text!=='string'||!c.text.trim()||c.text.length>3000||!Array.isArray(c.sources))return null;
  const sources=[],seen=new Set();let rejected=Math.max(0,Number(c.rejected)||0);
  for(const s of c.sources.slice(0,8)){
   const n=s?.page,q=typeof s?.quote==='string'?normalize(s.quote):'',id=n+':'+q;
   if(Number.isInteger(n)&&n>=1&&n<=pages.length&&q.length>=6&&q.length<=3000&&normalize(pages[n-1]).includes(q)){
    if(!seen.has(id)){sources.push({page:n,quote:s.quote});seen.add(id);}
   }else rejected++;
  }
  const text=c.text.replace(/\[Page\s+\d+\]/gi,'').trim();if(!text)return null;
  claims.push({text,kind:kinds.has(c.kind)?c.kind:'inference',sources,rejected});
 }
 return claims;
}
function answerText(claims){return claims.map(c=>c.text+(c.sources.length?' '+[...new Set(c.sources.map(s=>`[Page ${s.page}]`))].join(' '):'')).join('\n\n');}
function knowledgeMap({key,pages,turns=[],notes=[],highlights=[],limit=120}){
 const groups=new Map(),unlinked=[];let count=0,omitted=0;
 const add=(page,item)=>{if(count>=limit){omitted++;return;}count++;if(!Number.isInteger(page)||page<1||page>pages.length){unlinked.push(item);return;}if(!groups.has(page))groups.set(page,[]);groups.get(page).push(item);};
 for(const turn of turns.slice(-20)){
  const claims=restore(turn.evidence,key,pages);
  if(!claims){if(turn.answer)add(null,{type:'answer',text:String(turn.answer).slice(0,3000),verified:false});continue;}
  for(const c of claims){if(!c.sources.length)add(null,{type:c.kind,text:c.text,verified:false});else for(const s of c.sources)add(s.page,{type:c.kind,text:c.text,quote:s.quote,verified:true,rejected:c.rejected});}
 }
 for(const n of notes.filter(n=>n.paperKey===key))add(n.page,{type:'note',text:String(n.note||'').slice(0,3000),quote:String(n.quote||'').slice(0,3000),verified:false});
 for(const h of highlights.filter(h=>h.paperKey===key))add(h.page,{type:'highlight',text:String(h.text||'').slice(0,3000),verified:false});
 return {groups:[...groups].sort((a,b)=>a[0]-b[0]).map(([page,items])=>({page,items})),unlinked,count,omitted};
}
const api={normalize,snapshot,restore,answerText,knowledgeMap};if(typeof module!=='undefined')module.exports=api;else root.ReaderCore=api;
})(typeof window==='undefined'?globalThis:window);
