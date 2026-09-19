'use strict';
/* Local OCR and explicit, page-grounded model analysis. */
(function(){
const tr=s=>window.I18n?.t(s)||s;
const status=s=>{$('documentStatus').textContent=s;};
let epoch=0,job=null,ocrPages=new Map(),structures=new Map(),evidenceLinks=[],lastAnswer=null;
const scripts=new Map();
let cacheReady=Promise.resolve(),writes=Promise.resolve();
const storageKey=()=>readerKey()+':'+(state.reader.pdf?.fingerprints?.[0]||'local');
function loadScript(path){if(scripts.has(path))return scripts.get(path);const promise=new Promise((resolve,reject)=>{const el=document.createElement('script');const timer=setTimeout(()=>{el.remove();reject(Error('辨識元件載入逾時'));},30000);el.src=new URL(path,document.baseURI).href;el.onload=()=>{clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);el.remove();reject(Error('辨識元件無法載入'));};document.head.append(el);}).catch(e=>{scripts.delete(path);throw e;});scripts.set(path,promise);return promise;}
insertTools('.reader-commandbar','<button id="documentToolsToggle" class="btn small" aria-expanded="false">文字與公式辨識</button>');
$('readerProgress').insertAdjacentHTML('afterend',`<section id="documentTools" class="document-tools hidden"><div class="document-actions"><label>OCR 語言 <select id="ocrLanguage" class="control"><option value="eng">English</option><option value="chi_tra">繁體中文 + English</option><option value="chi_sim">简体中文 + English</option><option value="jpn">日本語 + English</option><option value="kor">한국어 + English</option></select></label><button id="ocrPage" class="btn small">OCR 目前頁</button><button id="ocrCancel" class="btn small" disabled>取消辨識</button><button id="structurePage" class="btn small">解析公式／表格</button></div><p class="muted">OCR 在本機執行；公式與表格解析會將目前頁影像傳給你設定的 AI。</p><p id="documentStatus" role="status" aria-live="polite"></p><div id="ocrReview" class="hidden"><label for="ocrTranscript">辨識草稿（可修正）</label><textarea id="ocrTranscript" rows="6" data-i18n-skip></textarea><p class="muted">OCR 可能誤讀次方與符號，採用前請核對原頁。</p><button id="applyOcr" class="btn small">採用修正文字</button><button id="restoreNativeText" class="btn small">還原原始文字層</button></div><div id="structureResults" data-i18n-skip></div></section>`);
$('documentToolsToggle').onclick=()=>{const hidden=$('documentTools').classList.toggle('hidden');$('documentToolsToggle').setAttribute('aria-expanded',String(!hidden));if(!hidden)showPageTools();};
function showTools(){$('documentTools').classList.remove('hidden');$('documentToolsToggle').setAttribute('aria-expanded','true');}
function current(){return Math.max(1,Number(state.reader.currentPage)||1);}
function rebuildIndex(){state.reader.fullText=state.reader.pageTexts.map((t,i)=>`[Page ${i+1}]\n${t}`).join('\n\n');document.dispatchEvent(new CustomEvent('research:index-updated'));}
async function snapshot(pageNo,pdf=state.reader.pdf){
 const page=await pdf.getPage(pageNo),base=page.getViewport({scale:1}),scale=Math.min(3,2600/Math.max(base.width,base.height),Math.sqrt(6000000/(base.width*base.height))),viewport=page.getViewport({scale});
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const task=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport});try{await task.promise;return canvas;}catch(e){canvas.width=canvas.height=0;throw e;}
}
function cancel(){if(!job)return;job.cancelled=true;job.worker?.terminate();job.reject?.(new Error('已取消辨識'));status(tr('已取消辨識'));}
function reset(){epoch++;cancel();ocrPages=new Map();structures=new Map();evidenceLinks=[];lastAnswer=null;$('ocrReview').classList.add('hidden');$('structureResults').replaceChildren();delete $('ocrReview').dataset.page;state.reader.structureBusy=false;$('structurePage').disabled=false;status('');}
function guard(j){if(j.cancelled||j.epoch!==epoch||j.token!==state.reader.renderToken)throw Error('已取消辨識');}
function cache(pageNo){
 const key='reader-v2:'+storageKey()+':'+pageNo,token=state.reader.renderToken;
 const value=structuredClone({ocr:ocrPages.get(pageNo)||null,structure:structures.get(pageNo)||null});
 writes=writes.catch(()=>{}).then(()=>idbPut(key,value)).catch(()=>{if(token===state.reader.renderToken)status(tr('辨識已完成，但無法儲存快取'));});return writes;
}
function adopt(pageNo,entry,text){entry.adopted=true;entry.corrected=text;entry.draft=text;ocrPages.set(pageNo,entry);state.reader.pageTexts[pageNo-1]=text;rebuildIndex();cache(pageNo);attachOcr(pageNo);}
function attachOcr(pageNo){
 const entry=ocrPages.get(pageNo),wrap=document.querySelector(`.pdf-page[data-page="${pageNo}"]`);if(!wrap)return;
 wrap.querySelector('.ocr-text-layer')?.remove();if(!entry?.adopted||entry.native.trim().length>=30)return;
 const original=wrap.querySelector('.textLayer');if(original)original.style.display='none';
 const layer=document.createElement('div');layer.className='textLayer manual-text-layer ocr-text-layer';layer.dataset.page=pageNo;const w=parseFloat(wrap.style.width),h=parseFloat(wrap.style.height);
 const ctx=document.createElement('canvas').getContext('2d');
 entry.lines.forEach((line,lineNo)=>{for(const [index,word] of line.words.entries()){const [x,y,rw,rh]=word.rect,span=document.createElement('span'),size=rh*h;span.textContent=word.text;span.dataset.readerLine=String(lineNo);span.dataset.readerScript='';span.dataset.readerPrefix=index?' ':'';span.dataset.ocrConfidence=String(Math.round(word.confidence));span.title=tr('OCR 辨識草稿');span.style.cssText=`left:${x*w}px;top:${y*h}px;font-size:${size}px;font-family:Arial,sans-serif;line-height:1;transform-origin:0 0;`;ctx.font=`${size}px Arial`;span.style.transform=`scaleX(${rw*w/Math.max(1,ctx.measureText(word.text).width)})`;layer.append(span);}});
 wrap.append(layer);
}
async function runOcr(){
 if(!state.reader.pdf){toast('請先載入 PDF');return;}if(job)return;
 const requestedToken=state.reader.renderToken;await cacheReady;if(requestedToken!==state.reader.renderToken||!state.reader.pdf||job)return;showTools();const pageNo=current(),token=state.reader.renderToken,lang=$('ocrLanguage').value;
 const j={epoch,token,cancelled:false,worker:null};job=j;$('ocrPage').disabled=true;$('ocrCancel').disabled=false;status(tr('正在辨識目前頁…'));
 let timer;
 try{
  const cancelled=new Promise((_,reject)=>{j.reject=reject;timer=setTimeout(()=>{j.cancelled=true;j.worker?.terminate();reject(Error('辨識逾時，請重試'));},120000);});
  const result=await Promise.race([cancelled,(async()=>{
   await loadScript('vendor/ocr/tesseract.min.js');guard(j);
   const asset=p=>new URL('vendor/ocr/'+p,document.baseURI).href;
   const worker=await Tesseract.createWorker(lang==='eng'?'eng':['eng',lang],1,{workerPath:asset('worker.min.js'),corePath:asset('tesseract-core-lstm.wasm.js'),langPath:lang==='eng'?asset('').replace(/\/$/,''):'https://tessdata.projectnaptha.com/4.0.0_best_int',logger:m=>{if(job===j&&!j.cancelled)status(tr('正在辨識目前頁…')+' '+Math.round((m.progress||0)*100)+'%');},errorHandler:e=>j.reject(Error(String(e?.message||e)))});
   j.worker=worker;try{guard(j);const canvas=await snapshot(pageNo);guard(j);const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});guard(j);const result=DocumentCore.ocrLines(data,canvas.width,canvas.height);canvas.width=canvas.height=0;return result;}finally{await worker.terminate();}
  })()]);
  guard(j);if(!result.text.trim())throw Error('此頁未辨識出文字');
  const entry={...result,native:ocrPages.get(pageNo)?.native??state.reader.pageTexts[pageNo-1]??'',language:lang,adopted:false,corrected:result.text,draft:result.text};ocrPages.set(pageNo,entry);
  if(entry.native.trim().length<30)adopt(pageNo,entry,result.text);else await cache(pageNo);
  showOcr(current());status(tr('OCR 完成，請核對草稿')+' · '+tr(`第 ${pageNo} 頁`));
 }catch(e){if(j.epoch===epoch&&j.token===state.reader.renderToken)status(tr(String(e.message)));}finally{clearTimeout(timer);j.worker?.terminate();if(job===j){job=null;$('ocrPage').disabled=false;$('ocrCancel').disabled=true;}}
}
function saveDraft(){const n=Number($('ocrReview').dataset.page),entry=ocrPages.get(n);if(entry&&entry.draft!==$('ocrTranscript').value){entry.draft=$('ocrTranscript').value;cache(n);}}
function showOcr(pageNo){const entry=ocrPages.get(pageNo);$('ocrReview').classList.toggle('hidden',!entry);$('ocrReview').dataset.page=String(pageNo);if(entry)$('ocrTranscript').value=entry.draft??entry.corrected;}
$('ocrTranscript').addEventListener('input',saveDraft);
$('ocrPage').onclick=runOcr;$('ocrCancel').onclick=cancel;
$('applyOcr').onclick=()=>{const pageNo=Number($('ocrReview').dataset.page),entry=ocrPages.get(pageNo);if(entry){adopt(pageNo,entry,$('ocrTranscript').value);status(tr('已採用修正文字；選取位置仍對應原始 OCR 草稿'));}};
$('restoreNativeText').onclick=()=>{const n=Number($('ocrReview').dataset.page),entry=ocrPages.get(n);if(entry){entry.adopted=false;state.reader.pageTexts[n-1]=entry.native;rebuildIndex();cache(n);const wrap=document.querySelector(`.pdf-page[data-page="${n}"]`);wrap?.querySelector('.ocr-text-layer')?.remove();const layer=wrap?.querySelector('.textLayer');if(layer)layer.style.display='';status(tr('已還原原始文字層'));}};
function stringSchema(){return {type:'string'};}
function objectSchema(properties){return {type:'object',additionalProperties:false,properties,required:Object.keys(properties)};}
function arraySchema(items){return {type:'array',items};}
const structureSchema=objectSchema({formulas:arraySchema(objectSchema({latex:stringSchema(),meaning:stringSchema(),uncertainty:stringSchema()})),tables:arraySchema(objectSchema({title:stringSchema(),headers:arraySchema(stringSchema()),rows:arraySchema(arraySchema(stringSchema())),uncertainty:stringSchema()})),notes:stringSchema()});
async function renderStructures(value,pageNo){
 const token=state.reader.renderToken;
 await loadScript('vendor/katex/katex.min.js');
 if(token!==state.reader.renderToken||current()!==pageNo||structures.get(pageNo)!==value)return;
 const target=$('structureResults');target.innerHTML=`<h4>${esc(tr('原頁解析草稿'))} · ${esc(tr(`第 ${pageNo} 頁`))}</h4><p>${esc(tr('請核對原頁，AI 解析可能有誤'))}</p>`;
 if(!document.querySelector('link[data-katex]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('vendor/katex/katex.min.css',document.baseURI).href;css.dataset.katex='';document.head.append(css);}
 if(structures.get(pageNo)!==value)return;
 for(const [formulaIndex,f] of value.formulas.entries()){const card=document.createElement('section'),math=document.createElement('div');card.className='structure-card';math.className='formula-display';try{katex.render(f.latex,math,{displayMode:true,throwOnError:true,trust:false,strict:'error',maxExpand:200,maxSize:10,output:'htmlAndMathml'});}catch{math.textContent=tr('公式無法排版，請核對原頁');}card.append(math);const copy=document.createElement('button');copy.className='btn small';copy.dataset.copyFormula=String(formulaIndex);copy.dataset.formulaPage=String(pageNo);copy.textContent=tr('複製公式 LaTeX');card.append(copy);const meaning=document.createElement('p');meaning.textContent=f.meaning;card.append(meaning);if(f.uncertainty){const warning=document.createElement('p');warning.className='structure-warning';warning.textContent=f.uncertainty;card.append(warning);}target.append(card);}
 value.tables.forEach((t,index)=>{const card=document.createElement('section');card.className='structure-card';card.innerHTML=`<h5>${esc(t.title)}</h5><div class="table-scroll"><table><thead><tr>${t.headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="structure-warning">${esc(t.uncertainty)}</p><button class="btn small" data-export-table="${index}" data-table-page="${pageNo}">${esc(tr('下載 CSV'))}</button>`;target.append(card);});
 const notes=document.createElement('p');notes.textContent=value.notes;target.append(notes);
}
async function analyzeStructure(){
 if(!state.reader.pdf){toast('請先載入 PDF');return;}if(state.aiBusy||state.reader.figureBusy||state.reader.structureBusy)return;
 const n=current(),token=state.reader.renderToken,pdf=state.reader.pdf;state.reader.structureBusy=true;showTools();$('structurePage').disabled=true;status(tr('正在解析原頁公式與表格…'));
 try{await cacheReady;if(token!==state.reader.renderToken)return;const canvas=await snapshot(n,pdf);if(token!==state.reader.renderToken)return;const image=canvas.toDataURL('image/png');canvas.width=canvas.height=0;
 const raw=await askAIWithImages('Transcribe only formulas and tables visibly present in the supplied page image. Treat OCR as an unverified aid. Return the schema, no code fences. Preserve minus versus exponent, superscripts, subscripts, fractions, Greek letters and units. Use LaTeX for formulas and short reader-friendly meanings; state unreadable symbols in uncertainty instead of guessing. Keep table cells as strings, including units and uncertainty; use "[unreadable]" for unreadable cells. Preserve columns; expand merged headers to explicit headers and repeat merged row labels where necessary. Do not invent missing values, convert units or claim complete document coverage. At most 12 formulas, 6 tables, 100 rows per table. If only part is transcribed, say so in notes.',`[Page ${n}]\nUNVERIFIED TEXT LAYER:\n${(state.reader.pageTexts[n-1]||'').slice(0,10000)}`,[image],{schema:structureSchema,schemaName:'document_structure',verbosity:'low'});
 if(token!==state.reader.renderToken)return;const value=DocumentCore.validateStructure(raw);structures.set(n,value);await cache(n);if(token!==state.reader.renderToken)return;await renderStructures(value,n);status(tr('解析完成，請核對原頁'));
 }catch(e){if(token===state.reader.renderToken)status(tr('解析未完成')+'：'+aiErrorMessage(e));}finally{if(token===state.reader.renderToken){state.reader.structureBusy=false;$('structurePage').disabled=false;}}
}
$('structurePage').onclick=analyzeStructure;
$('structureResults').onclick=async e=>{const copy=e.target.closest('[data-copy-formula]');if(copy){const f=structures.get(Number(copy.dataset.formulaPage))?.formulas[Number(copy.dataset.copyFormula)];if(f)try{await navigator.clipboard.writeText(f.latex);toast(tr('公式已複製'));}catch{toast(tr('無法複製，請選取回答文字'));}return;}const b=e.target.closest('[data-export-table]');if(!b)return;const table=structures.get(Number(b.dataset.tablePage))?.tables[Number(b.dataset.exportTable)];if(!table)return;const url=URL.createObjectURL(new Blob([DocumentCore.csv(table)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`table-page-${b.dataset.tablePage}-${Number(b.dataset.exportTable)+1}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const answerSchema=objectSchema({claims:arraySchema(objectSchema({text:stringSchema(),kind:{type:'string',enum:['observation','author_claim','inference','insufficient']},sources:arraySchema(objectSchema({id:stringSchema(),quote:stringSchema()}))}))});
async function groundedAnswer(question,selected='',previous=[]){
 if(state.reader.understandingBusy)throw Error('AI 正在處理另一個請求，請稍候。');state.reader.understandingBusy=true;lastAnswer=null;try{
 const token=state.reader.renderToken;await cacheReady;if(token!==state.reader.renderToken)throw Error('文件已變更');const pageNo=selected?(state.reader.selectionPage||current()):current(),evidence=DocumentCore.segments(state.reader.pageTexts,question+' '+selected,pageNo,selected);
 const canvas=await snapshot(pageNo);if(token!==state.reader.renderToken)throw Error('文件已變更');const image=canvas.toDataURL('image/png');canvas.width=canvas.height=0;
 const raw=await askAIWithImages('Answer using only supplied paper evidence and the labeled page image. Return 1-5 concise claims, normally one sentence each, total at most 220 words unless detail requested. Distinguish observation, author_claim, inference, insufficient. For each claim, include sources with an exact supplied evidence id and verbatim quote (at least 6 characters) that supports it. Never invent an id or quote, never treat a previous answer as evidence. If support is image-only or missing, leave sources empty and explicitly say it needs visual verification or evidence is insufficient. OCR may misread exponents; compare against the image, explicitly report conflicts, never silently substitute an exponent. Explain the passage in its surrounding argument. Do not output code, internal fields or unsupported conclusions.',`QUESTION: ${question}\nSELECTED PASSAGE:\n${selected}\nPREVIOUS CONVERSATION (unverified): ${JSON.stringify(previous).slice(0,15000)}\nEVIDENCE: ${JSON.stringify(evidence.map(({id,page,text})=>({id,page,text,origin:ocrPages.get(page)?.adopted?'OCR draft / user corrected':'PDF text layer'})))}\nIMAGE: [Page ${pageNo}]`,[image],{schema:answerSchema,schemaName:'evidence_answer',verbosity:'low'});
 if(token!==state.reader.renderToken)throw Error('文件已變更');const claims=DocumentCore.validateAnswer(raw,evidence);lastAnswer={token,claims};return ReaderCore.answerText(claims);
 }finally{state.reader.understandingBusy=false;}
}
function evidenceSnapshot(){return lastAnswer?.token===state.reader.renderToken?ReaderCore.snapshot(readerKey(),lastAnswer.claims):null;}
function appendEvidence(record=null){
 if(record){const claims=ReaderCore.restore(record,readerKey(),state.reader.pageTexts);if(!claims)return;lastAnswer={token:state.reader.renderToken,claims};}
 if(!lastAnswer||lastAnswer.token!==state.reader.renderToken)return;const value=lastAnswer;lastAnswer=null;evidenceLinks=[];
 const panel=document.createElement('details');panel.className='answer-evidence';panel.dataset.i18nSkip='';panel.innerHTML=`<summary>${esc(tr('逐句核對原文'))}</summary><p>${esc(tr('連結表示原文存在，不代表推論已獲證實'))}</p>`;
 value.claims.forEach((c,i)=>{const row=document.createElement('div');row.className='evidence-claim';const text=document.createElement('p');text.textContent=`${i+1}. ${tr(({observation:'觀察',author_claim:'作者主張',inference:'推論',insufficient:'證據不足'})[c.kind])} · ${c.text}`;row.append(text);for(const s of c.sources){const index=evidenceLinks.push(s)-1,b=document.createElement('button');b.className='btn small';b.dataset.evidenceLink=String(index);b.textContent=tr(`第 ${s.page} 頁`)+' · '+tr('查看原文片段');row.append(b);}if(!c.sources.length||c.rejected){const p=document.createElement('p');p.className='structure-warning';p.textContent=tr('缺少可核對的文字證據，請查閱原頁');row.append(p);}panel.append(row);});$('assistantOutput').append(panel);document.dispatchEvent(new CustomEvent('research:evidence'));
}
$('assistantOutput').addEventListener('click',async e=>{const b=e.target.closest('[data-evidence-link]'),source=b&&evidenceLinks[Number(b.dataset.evidenceLink)];if(!source)return;const token=state.reader.renderToken;await previewReaderPage(source.page);if(token!==state.reader.renderToken)return;const quote=document.createElement('blockquote');quote.className='evidence-quote';quote.dataset.i18nSkip='';quote.textContent=source.quote;$('pagePreviewBody').prepend(quote);});
function showPageTools(){if($('documentTools').classList.contains('hidden'))return;const n=current();showOcr(n);$('structureResults').replaceChildren();const value=structures.get(n);if(value)renderStructures(value,n).catch(e=>status(String(e.message)));}
document.addEventListener('research:current-page',showPageTools);
document.addEventListener('research:page',e=>{attachOcr(Number(e.detail));if(Number(e.detail)===current())showPageTools();});
document.addEventListener('research:document',()=>{
 reset();const token=state.reader.renderToken,key=storageKey(),oldKey=readerKey(),pages=state.reader.pages;
 cacheReady=(async()=>{await writes;const keys=Array.from({length:pages},(_,i)=>'reader-v2:'+key+':'+(i+1));const stored=await idbGetMany(keys);const legacy=await idbGetMany(Array.from({length:pages},(_,i)=>'ocr-v1:'+oldKey+':'+(i+1)));
 for(let n=1;n<=pages;n++){if(token!==state.reader.renderToken)return;let value=stored[n-1],entry=value?.ocr;
 if(!value)entry=legacy[n-1];
 if(token!==state.reader.renderToken)return;
 if(entry?.lines&&typeof entry.native==='string'&&typeof entry.corrected==='string'&&!ocrPages.has(n)){ocrPages.set(n,entry);if(entry.adopted){state.reader.pageTexts[n-1]=entry.corrected;attachOcr(n);}}
 if(value?.structure)try{structures.set(n,DocumentCore.validateStructure(value.structure));}catch{}
 }
 rebuildIndex();showPageTools();if(state.reader.fullText.replace(/\[Page \d+\]/g,'').trim().length<30){showTools();status(tr('這份文件缺少文字層，請執行 OCR 目前頁'));}
 document.dispatchEvent(new CustomEvent('research:cache-ready'));
 })().catch(e=>{if(token===state.reader.renderToken)status(tr('辨識已完成，但無法儲存快取'));console.warn('Reader cache recovery',e);});
});
window.DocumentUnderstanding={reset,runOcr,cancel,snapshot,groundedAnswer,appendEvidence,evidenceSnapshot,analyzeStructure,ready:()=>cacheReady,flush:()=>writes,ocrPages:()=>ocrPages};
})();
