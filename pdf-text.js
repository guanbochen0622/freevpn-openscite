/* Geometry-aware text reconstruction; original glyphs remain untouched for rendering. */
(function(root){
'use strict';
const supers='⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ',subs='₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₙᵢ',plain='0123456789+-=()ni';
function scriptText(text,kind){
 if(!kind)return text;
 const chars=Array.from(text.replace(/−/g,'-')),map=kind==='super'?supers:subs;
 return chars.every(c=>plain.includes(c))?chars.map(c=>map[plain.indexOf(c)]).join(''):(kind==='super'?'^{':'_{')+text+'}';
}
function clean(text){return String(text).normalize('NFC').replace(/[ﬀﬁﬂﬃﬄ]/g,c=>({'ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl'}[c])).replace(/\u00ad\s*\n\s*/g,'').replace(/\u00ad/g,'');}
function analyze(tc,width=600){
 const original=tc.items.filter(i=>typeof i.str==='string');
 if(original.some(i=>!i.transform||Math.abs(i.transform[1])>.01||Math.abs(i.transform[2])>.01)||Object.values(tc.styles||{}).some(s=>s.vertical))return {items:tc.items,text:clean(original.map(i=>i.str+(i.hasEOL?'\n':' ')).join('')),layout:'original'};
 let items=original.filter(i=>i.str.length).map((item,index)=>({item,index,x:item.transform[4],y:item.transform[5],w:Math.abs(item.width||0),h:Math.hypot(item.transform[2],item.transform[3])||Math.abs(item.height)||12,kind:''}));
 // Attach a smaller raised/lowered glyph only to an adjacent larger baseline.
 for(const a of items){if(!a.item.str.trim())continue;let best=null;for(const b of items){const gap=a.x-(b.x+b.w),dy=a.y-b.y;if(!b.item.str.trim()||b.w<=0||b===a||a.h>b.h*.83||gap< -b.h*.2||gap>b.h*.7||Math.abs(dy)<b.h*.10||Math.abs(dy)>b.h*.65)continue;const distance=Math.abs(gap)+Math.abs(dy);if(!best||distance<best.distance)best={b,distance};}if(best){a.kind=a.y>best.b.y?'super':'sub';a.baseline=best.b.y;}}
 const rows=[];for(const a of [...items].sort((a,b)=>(b.baseline??b.y)-(a.baseline??a.y)||a.x-b.x)){const y=a.baseline??a.y;let row=rows.find(r=>Math.abs(r.y-y)<=Math.min(r.h,a.h)*.22);if(!row)rows.push(row={y,h:a.h,items:[]});row.items.push(a);row.h=Math.max(row.h,a.h);}
 // A supported middle gutter separates body columns. Wide headings become band boundaries.
 let split=null;
 for(const fraction of [.5,.45,.55]){const cut=width*fraction,body=items.filter(a=>a.w<width*.48&&a.item.str.trim().length>1),left=body.filter(a=>a.x+a.w<=cut-6),right=body.filter(a=>a.x>=cut+6),cross=body.filter(a=>a.x<cut+6&&a.x+a.w>cut-6);if(left.length>=3&&right.length>=3&&!cross.length){split=cut;break;}}
 const ordered=[];
 if(split){let left=[],right=[];const flush=()=>{ordered.push(...left,...right);left=[];right=[];};for(const row of rows){if(row.items.some(a=>a.x<split&&a.x+a.w>split)){flush();ordered.push(row);}else {const l=row.items.filter(a=>a.x<split),r=row.items.filter(a=>a.x>=split);if(l.length)left.push({...row,items:l});if(r.length)right.push({...row,items:r});}}flush();}else ordered.push(...rows);
 const result=[],lines=[];
 for(const [line,row] of ordered.entries()){row.items.sort((a,b)=>a.x-b.x||b.y-a.y);let text='',prev=null;for(const a of row.items){const separator=prev&&!a.kind&&a.x-(prev.x+prev.w)>Math.min(a.h,prev.h)*.12?' ':'';const semantic=clean(scriptText(a.item.str,a.kind));text+=separator+semantic;result.push({...a.item,hasEOL:false,readerScript:a.kind,readerLine:line,readerPrefix:separator});prev=a;}if(result.length)result[result.length-1].hasEOL=true;lines.push(text.trim());}
 return {items:result,text:lines.join('\n'),layout:split?'columns':'lines'};
}
function selection(range){
 const layers=Array.from(document.querySelectorAll('#pdfPages .textLayer'));let out='',lastLine=null,lastPage=null;
 for(const layer of layers)for(const span of layer.querySelectorAll('span[data-reader-line]')){
  if(!range.intersectsNode(span)||!span.firstChild)continue;const part=document.createRange();part.selectNodeContents(span);
  if(span.contains(range.startContainer))part.setStart(range.startContainer,range.startOffset);
  if(span.contains(range.endContainer))part.setEnd(range.endContainer,range.endOffset);
  const value=part.toString();if(!value)continue;const line=span.dataset.readerLine,page=layer.dataset.page;
  if(out)out+=line!==lastLine||page!==lastPage?'\n':span.dataset.readerPrefix||'';
  out+=scriptText(value,span.dataset.readerScript);lastLine=line;lastPage=page;
 }
 return clean(out||range.toString());
}
const api={analyze,scriptText,clean,selection};if(typeof module!=='undefined')module.exports=api;else root.PdfText=api;
})(typeof window==='undefined'?globalThis:window);
