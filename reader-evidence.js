'use strict';
(function(){
let claims=[],active=[],epoch=0;const cache=new Map(),paints=new WeakMap();
const norm=s=>PdfText.clean(s).replace(/\s+/g,'');
function sources(page){return claims.flatMap(c=>c.sources).filter(s=>s.page===page);}
async function locate(source){
 const pdf=state.reader.pdf,token=state.reader.renderToken,key=source.page+':'+source.quote;if(cache.has(key))return cache.get(key);
 const page=await pdf.getPage(source.page),vp=page.getViewport({scale:1}),tc=await page.getTextContent({disableNormalization:true});if(token!==state.reader.renderToken)return [];
 const items=PdfText.analyze(tc,vp.width).items.filter(i=>typeof i.str==='string'),runs=[];let text='';
 for(const i of items){const value=norm(PdfText.scriptText(i.str,i.readerScript));const start=text.length;text+=value;runs.push({start,end:text.length,item:i});}
 let runsUsed=runs,at=text.indexOf(norm(source.quote));const wanted=norm(source.quote);
 // Adopted OCR uses its own word boxes; never reuse corrected text as invented geometry.
 if(at<0){text='';runsUsed=[];const ocr=window.DocumentUnderstanding?.ocrPages().get(source.page);for(const line of ocr?.lines||[])for(const word of line.words||[]){const start=text.length;text+=norm(word.text);runsUsed.push({start,end:text.length,rect:word.rect});}at=text.indexOf(wanted);}
 if(at<0||wanted.length<6)return [];
 // Repeated quotes are ambiguous: require a unique occurrence instead of marking an arbitrary one.
 if(text.indexOf(wanted,at+1)>=0)return [];
 const end=at+wanted.length,rects=[];
 for(const run of runsUsed){if(run.end<=at||run.start>=end)continue;if(run.rect){rects.push(run.rect);continue;}const i=run.item,t=pdfjsLib.Util.transform(vp.transform,i.transform),h=Math.hypot(t[2],t[3])||i.height||12,w=Math.abs(i.width||h);const a=(Math.max(at,run.start)-run.start)/(run.end-run.start),b=(Math.min(end,run.end)-run.start)/(run.end-run.start);if(Math.abs(t[1])>.1||Math.abs(t[2])>.1)continue;rects.push([(t[4]+w*a)/vp.width,(t[5]-h*.85)/vp.height,w*(b-a)/vp.width,h/vp.height]);}
 if(token===state.reader.renderToken){cache.set(key,rects);if(cache.size>150)cache.delete(cache.keys().next().value);}return rects;
}
async function paint(container,page,list){const token=state.reader.renderToken,version=epoch,nonce={};paints.set(container,nonce);const sets=await Promise.all(list.map(locate));if(token!==state.reader.renderToken||version!==epoch||paints.get(container)!==nonce||!container.isConnected)return false;container.querySelector('.citation-overlay')?.remove();const overlay=document.createElement('div');overlay.className='citation-overlay';overlay.setAttribute('aria-label','回答引用的原文位置');for(const rect of sets.flat()){const mark=document.createElement('span');mark.className='citation-highlight';const [x,y,w,h]=rect;mark.style.cssText=`left:${x*100}%;top:${y*100}%;width:${w*100}%;height:${h*100}%`;overlay.append(mark);}container.append(overlay);return overlay.children.length>0;}
async function show(page,list=sources(page)){active=list;const current=++epoch;goPdfPage(page);await state.reader.paintPage?.(page);if(current!==epoch)return;const wrap=document.querySelector(`.pdf-page[data-page="${page}"]`);if(wrap&&await paint(wrap,page,list))wrap.querySelector('.citation-highlight')?.scrollIntoView({block:'center',behavior:'instant'});else toast('此頁沒有可唯一定位的原文片段；請核對引文。');}
function bind(value){claims=value;const buttons=[...$('assistantOutput').querySelectorAll('.page-citation')];for(const b of buttons){const page=Number(b.dataset.pageLink);const paragraph=b.closest('p')?.textContent||'';const claim=claims.find(c=>paragraph.includes(c.text.slice(0,35)));const list=(claim?.sources||sources(page)).filter(s=>s.page===page);b._sources=list;const preview=b.nextElementSibling;if(preview?.matches('[data-preview-page]'))preview._sources=list;}window.ScientificText?.render($('assistantOutput')).catch(()=>{});}
document.addEventListener('click',e=>{const b=e.target.closest('#assistantOutput [data-page-link],#assistantOutput [data-preview-page]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const page=Number(b.dataset.pageLink||b.dataset.previewPage),list=b._sources||sources(page);if(b.dataset.previewPage)previewReaderPage(page,list);else show(page,list);},true);
document.addEventListener('research:page',e=>{const page=Number(e.detail),wrap=document.querySelector(`.pdf-page[data-page="${page}"]`);if(wrap&&active.some(s=>s.page===page))paint(wrap,page,active.filter(s=>s.page===page));});
document.addEventListener('research:answer',()=>{claims=[];active=[];epoch++;document.querySelectorAll('.citation-overlay').forEach(n=>n.remove());});
document.addEventListener('research:document',()=>{claims=[];active=[];cache.clear();epoch++;});
window.ReaderEvidence={bind,sources,locate,paint,show};
})();
