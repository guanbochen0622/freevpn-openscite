/* Pure validation and evidence utilities. No model output is trusted as HTML. */
(function(root){
'use strict';
const norm=s=>String(s||'').normalize('NFC').replace(/\s+/g,' ').trim();
function ocrLines(data,width,height){
 const lines=[];
 for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
  const words=(line.words||[]).filter(w=>w.text?.trim()&&w.bbox).map(w=>({text:w.text,confidence:Number(w.confidence)||0,rect:[w.bbox.x0/width,w.bbox.y0/height,(w.bbox.x1-w.bbox.x0)/width,(w.bbox.y1-w.bbox.y0)/height]}));
  if(words.length)lines.push({text:words.map(w=>w.text).join(' '),words});
 }
 return {text:lines.length?lines.map(l=>l.text).join('\n'):String(data.text||'').trim(),lines,confidence:Number(data.confidence)||0};
}
function segments(pages,query,current=1){
 const terms=norm(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1),all=[];
 pages.forEach((text,i)=>{const chunks=String(text||'').split(/\n/).filter(x=>x.trim());let chunk='',n=0;const flush=()=>{if(!chunk.trim())return;const t=chunk.trim();all.push({id:`p${i+1}s${++n}`,page:i+1,text:t,score:terms.reduce((s,w)=>s+(t.toLowerCase().includes(w)?1:0),0)+(i+1===current?1:0)});chunk='';};for(const line of chunks){if(chunk.length+line.length>700)flush();for(let pos=0;pos<line.length;pos+=700){chunk+=line.slice(pos,pos+700)+'\n';if(chunk.length>=700)flush();}}flush();});
 const ranked=all.sort((a,b)=>b.score-a.score||a.page-b.page),chosen=ranked.slice(0,16);
 const currentEntry=ranked.find(x=>x.page===current);if(currentEntry&&!chosen.includes(currentEntry))chosen[chosen.length-1]=currentEntry;
 return chosen;
}
function parseObject(raw){const s=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const value=JSON.parse(s);if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Invalid structured result');return value;}
function validateAnswer(raw,evidence){
 const value=typeof raw==='string'?parseObject(raw):raw,map=new Map(evidence.map(e=>[e.id,e]));
 if(!value||!Array.isArray(value.claims)||!value.claims.length||value.claims.length>8)throw Error('Invalid evidence answer');
 return value.claims.map(c=>{if(!c||typeof c.text!=='string'||!c.text.trim()||c.text.length>3000||!Array.isArray(c.sources))throw Error('Invalid claim');const sources=[];let rejected=0;
 for(const s of c.sources.slice(0,8)){const e=s&&map.get(s.id),q=typeof s?.quote==='string'?norm(s.quote):'';if(e&&q.length>=6&&norm(e.text).includes(q))sources.push({...e,quote:s.quote});else rejected++;}
 return {text:c.text.replace(/\[Page\s+\d+\]/gi,'').trim(),kind:['observation','author_claim','inference','insufficient'].includes(c.kind)?c.kind:'inference',sources,rejected};});
}
function validateStructure(raw){
 const v=typeof raw==='string'?parseObject(raw):raw;
 if(!v||!Array.isArray(v.formulas)||!Array.isArray(v.tables)||typeof v.notes!=='string'||v.formulas.length>12||v.tables.length>6)throw Error('Invalid document structure');
 for(const f of v.formulas){if(!f||!['latex','meaning','uncertainty'].every(k=>typeof f[k]==='string'&&f[k].length<=5000))throw Error('Invalid formula');}
 for(const t of v.tables){if(!t||typeof t.title!=='string'||typeof t.uncertainty!=='string'||!Array.isArray(t.headers)||!t.headers.length||t.headers.length>30||!t.headers.every(x=>typeof x==='string')||!Array.isArray(t.rows)||t.rows.length>100||!t.rows.every(r=>Array.isArray(r)&&r.length===t.headers.length&&r.every(x=>typeof x==='string'&&x.length<=3000)))throw Error('Invalid table dimensions');}
 return v;
}
function csv(table){return '\uFEFF'+[table.headers,...table.rows].map(row=>row.map(value=>{let s=String(value);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
const api={norm,ocrLines,segments,parseObject,validateAnswer,validateStructure,csv};if(typeof module!=='undefined')module.exports=api;else root.DocumentCore=api;
})(typeof window==='undefined'?globalThis:window);
