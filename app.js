'use strict';

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const STORE = {
  oaKey: 'openscite_oa_key',
  aiKey: 'openscite_ai_key',
  aiModel: 'openscite_ai_model',
  aiEndpoint: 'openscite_ai_endpoint',
  library: 'openscite_library_v24',
  notes: 'openscite_notes_v24',
  highlights: 'openscite_highlights_v24'
};

const state = {
  currentView: 'search',
  search: { query: '', page: 1, works: [], total: 0, sourceMap: new Map(), provider: 'OpenAlex' },
  reader: { pdf: null, buffer: null, fileName: '', url: '', meta: null, scale: 1.25, pages: 0, fullText: '', pageTexts: [], selectedText: '', highlights: [], notes: [], currentPage: 1, autoHighlight: false, renderToken: 0 },
  evidence: { target: null, works: [], sourceMap: new Map() },
  library: loadJSON(STORE.library, [])
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escRx(s='') { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripOpenAlex(id='') { return String(id).replace('https://openalex.org/',''); }
function doiClean(doi='') { return String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').trim(); }
function yearOf(w) { return Number(w.publication_year || (w.published_print && w.published_print['date-parts']?.[0]?.[0]) || (w.created && new Date(w.created).getFullYear()) || 0); }
function fmtNum(n=0) { return Number(n||0).toLocaleString('en-US'); }
function toast(msg, ms=2600) { const el=$('toast'); el.textContent=msg; el.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.add('hidden'),ms); }
function setBusy(btn, busy, label='處理中') { if(!btn) return; if(busy){ btn.dataset.old=btn.innerHTML; btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>${esc(label)}`; } else { btn.disabled=false; btn.innerHTML=btn.dataset.old || btn.innerHTML; } }
function debounce(fn, wait=220){ let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait)}; }

function queryTokens(query='') {
  const raw = String(query).trim();
  if (!raw) return [];
  const groups = raw.split(/\s{2,}|[;；\n]+/).map(s=>s.trim()).filter(Boolean);
  const words = raw.replace(/[–—−]/g,'-').split(/[\s,，。:：;；/\\()[\]{}]+/).map(s=>s.trim()).filter(s=>s.length>1);
  return [...new Set([...groups, ...words])].sort((a,b)=>b.length-a.length).slice(0,80);
}
function highlightHtml(text='', query='') {
  const tokens=queryTokens(query);
  if(!tokens.length) return esc(text);
  const rx=new RegExp(tokens.map(escRx).join('|'),'gi');
  let out='', last=0;
  String(text).replace(rx,(m,offset)=>{ out+=esc(String(text).slice(last,offset)); out+=`<mark class="keyword-hit">${esc(m)}</mark>`; last=offset+m.length; return m; });
  out+=esc(String(text).slice(last));
  return out;
}
function overlapScore(work, query) {
  const tokens=queryTokens(query).map(x=>x.toLowerCase());
  const title=(work.title||'').toLowerCase();
  const abs=(work.abstract||'').toLowerCase();
  let score=0; tokens.forEach(t=>{ if(title.includes(t)) score+=5; if(abs.includes(t)) score+=2; });
  return score;
}
function reconstructAbstract(inv) {
  if(!inv || typeof inv!=='object') return '';
  const arr=[];
  for(const [word, positions] of Object.entries(inv)) for(const p of positions) arr[p]=word;
  return arr.filter(Boolean).join(' ');
}
function authorsFromOpenAlex(w){ return (w.authorships||[]).slice(0,8).map(a=>a.author?.display_name).filter(Boolean).join(', '); }
function sourceFromOpenAlex(w){ return w.primary_location?.source?.display_name || w.best_oa_location?.source?.display_name || ''; }
function bestPdfOpenAlex(w){
  return w.best_oa_location?.pdf_url || (w.locations||[]).find(x=>x.pdf_url)?.pdf_url || '';
}
function landingOpenAlex(w){ return w.primary_location?.landing_page_url || w.doi || w.id || ''; }
function workFromOpenAlex(w){
  return {
    id: stripOpenAlex(w.id||''),
    openalex_url: w.id||'',
    title: w.title || w.display_name || 'Untitled',
    abstract: reconstructAbstract(w.abstract_inverted_index),
    year: w.publication_year || '',
    authors: authorsFromOpenAlex(w),
    source: sourceFromOpenAlex(w),
    sourceId: stripOpenAlex(w.primary_location?.source?.id || ''),
    citations: w.cited_by_count || 0,
    doi: doiClean(w.doi||''),
    isOA: !!w.open_access?.is_oa,
    pdfUrl: bestPdfOpenAlex(w),
    landingUrl: landingOpenAlex(w),
    raw: w,
    sourceMetrics: null,
    q: 'Q?',
    sourceScore: 0
  };
}
function workFromCrossref(w){
  const title=Array.isArray(w.title)?w.title[0]:(w.title||'Untitled');
  const cont=Array.isArray(w['container-title'])?w['container-title'][0]:(w['container-title']||'');
  const authors=(w.author||[]).slice(0,8).map(a=>[a.given,a.family].filter(Boolean).join(' ')).join(', ');
  return { id:'',title,abstract:String(w.abstract||'').replace(/<[^>]+>/g,' '),year:yearOf(w),authors,source:cont,sourceId:'',citations:w['is-referenced-by-count']||0,doi:w.DOI||'',isOA:false,pdfUrl:'',landingUrl:w.URL||'',raw:w,q:'Q?',sourceScore:0 };
}

function oaKey(){ return localStorage.getItem(STORE.oaKey)||''; }
async function oa(path, params={}){
  const url=new URL(`https://api.openalex.org${path}`);
  Object.entries(params).forEach(([k,v])=>{ if(v!==''&&v!==undefined&&v!==null) url.searchParams.set(k,v); });
  if(oaKey()) url.searchParams.set('api_key',oaKey());
  const res=await fetch(url.toString(),{headers:{Accept:'application/json'}});
  if(!res.ok) throw new Error(`OpenAlex ${res.status}`);
  return res.json();
}
async function crossrefSearch(query, rows=20, offset=0){
  const url=new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic',query); url.searchParams.set('rows',rows); url.searchParams.set('offset',offset);
  const res=await fetch(url.toString()); if(!res.ok) throw new Error(`Crossref ${res.status}`); const d=await res.json();
  return {results:(d.message?.items||[]).map(workFromCrossref), total:d.message?.['total-results']||0};
}
async function enrichSources(works, sourceMap){
  const ids=[...new Set(works.map(w=>w.sourceId).filter(Boolean))].slice(0,100);
  if(!ids.length) return;
  try{
    const data=await oa('/sources',{filter:`openalex_id:${ids.join('|')}`,'per-page':Math.min(100,ids.length)});
    for(const s of data.results||[]){ sourceMap.set(stripOpenAlex(s.id),s); }
    for(const w of works){
      const s=sourceMap.get(w.sourceId); if(!s) continue;
      const h=Number(s.summary_stats?.h_index||0), m=Number(s.summary_stats?.['2yr_mean_citedness']||0), c=Number(s.cited_by_count||0);
      const score=h*2 + m*18 + Math.log10(c+1)*20;
      w.sourceMetrics={hIndex:h, mean2y:m, worksCount:s.works_count||0,citedBy:s.cited_by_count||0,type:s.type||''}; w.sourceScore=score;
      if(h>=180 || m>=7 || score>=440) w.q='Q1'; else if(h>=90 || m>=4 || score>=260) w.q='Q2'; else if(h>=35 || m>=2 || score>=135) w.q='Q3'; else w.q='Q4';
    }
  }catch(e){ console.warn('source enrichment failed',e); }
}

function showView(name){
  state.currentView=name;
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  window.scrollTo({top: name==='reader'?document.querySelector('.app-shell').offsetTop-8:0,behavior:'smooth'});
  if(name==='library') renderLibrary();
}
$$('.nav-tab,.nav-view').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('searchToReader').addEventListener('click',()=>showView('reader'));

async function runSearch(resetPage=true){
  const query=$('searchQuery').value.trim(); if(!query){ toast('請先輸入搜尋關鍵字'); return; }
  if(resetPage) state.search.page=1;
  state.search.query=query;
  const per=Number($('perPage').value||20), page=state.search.page;
  const params={search:query,'per-page':per,page};
  const y1=$('yearFrom').value.trim(), y2=$('yearTo').value.trim(), oaOnly=$('searchOA').value==='oa';
  const filters=[]; if(y1) filters.push(`from_publication_date:${y1}-01-01`); if(y2) filters.push(`to_publication_date:${y2}-12-31`); if(oaOnly) filters.push('is_oa:true'); if(filters.length) params.filter=filters.join(',');
  setBusy($('searchBtn'),true,'搜尋中'); $('searchStatus').innerHTML='<span>正在搜尋與重排候選論文…</span><span>OpenAlex</span>';
  try{
    let works,total;
    try{
      const d=await oa('/works',params); works=(d.results||[]).map(workFromOpenAlex); total=d.meta?.count||0; state.search.provider='OpenAlex';
      await enrichSources(works,state.search.sourceMap);
    }catch(err){
      const d=await crossrefSearch(query,per,(page-1)*per); works=d.results; total=d.total; state.search.provider='Crossref fallback';
    }
    state.search.works=works; state.search.total=total; renderSearch();
  }catch(e){ $('searchResults').innerHTML=`<div class="empty-card">搜尋失敗：${esc(e.message)}</div>`; toast('搜尋失敗，請稍後再試'); }
  finally{ setBusy($('searchBtn'),false); }
}
function sortedSearchWorks(){
  const list=[...state.search.works], mode=$('searchSort').value, q=state.search.query;
  if(mode==='citations') list.sort((a,b)=>b.citations-a.citations);
  else if(mode==='newest') list.sort((a,b)=>(b.year||0)-(a.year||0));
  else if(mode==='oldest') list.sort((a,b)=>(a.year||9999)-(b.year||9999));
  else if(mode==='journal') list.sort((a,b)=>(b.sourceScore||0)-(a.sourceScore||0)||(b.citations||0)-(a.citations||0));
  else list.sort((a,b)=>overlapScore(b,q)-overlapScore(a,q)||(b.citations||0)-(a.citations||0));
  return list;
}
function paperCard(w, query, context='search', index=0){
  const qCls=(w.q||'Q?').toLowerCase().replace('?','');
  const venue=w.source||'Unknown venue'; const pdf=!!w.pdfUrl;
  const actions=[];
  if(pdf) actions.push(`<button class="btn small primary" data-action="read" data-context="${context}" data-index="${index}">閱讀 PDF</button>`);
  else if(w.landingUrl) actions.push(`<a class="btn small" href="${esc(w.landingUrl)}" target="_blank" rel="noreferrer">論文頁面 ↗</a>`);
  actions.push(`<button class="btn small" data-action="library" data-context="${context}" data-index="${index}">加入 Library</button>`);
  if(context==='search') actions.push(`<button class="btn small" data-action="evidence" data-context="search" data-index="${index}">分析引用證據</button>`);
  if(context==='evidence') actions.push(`<button class="btn small" data-action="citingpdf" data-context="evidence" data-index="${index}">加入 citing PDF</button><input type="file" accept="application/pdf,.pdf" class="hidden citing-file" data-index="${index}">`);
  const stance=w.stance?`<span class="badge ${w.stance}">${esc(w.stance)}</span>`:'';
  const qBadge=w.q&&w.q!=='Q?'?`<span class="badge ${qCls}" title="OpenAlex-based estimate; not official JCR/SJR">推估 ${esc(w.q)}</span>`:`<span class="badge">Q?</span>`;
  const evidence=w.contexts?.length?`<div class="context-box"><h4>FULL-TEXT CITATION CONTEXT · ${w.contexts.length} passages</h4>${w.contexts.slice(0,4).map(c=>`<div class="context">${highlightHtml(c,query)}</div>`).join('')}</div>`:'';
  return `<article class="paper-card"><div class="paper-top"><div><div class="paper-title">${highlightHtml(w.title,query)}</div><div class="paper-meta">${esc(w.authors||'Unknown authors')} · ${esc(w.year||'n.d.')} · ${esc(venue)}</div></div><div class="paper-badges">${stance}${qBadge}<span class="badge">${fmtNum(w.citations)} cites</span>${w.isOA?'<span class="badge">OA</span>':''}</div></div>${w.abstract?`<div class="paper-abstract">${highlightHtml(w.abstract,query)}</div>`:''}<div class="paper-actions">${actions.join('')}</div>${evidence}</article>`;
}
function renderSearch(){
  const works=sortedSearchWorks(); const per=Number($('perPage').value||20), page=state.search.page, pages=Math.max(1,Math.ceil(state.search.total/per));
  $('searchStatus').innerHTML=`<span>${fmtNum(state.search.total)} results · ${esc(state.search.provider)} · query tokens: ${queryTokens(state.search.query).length}</span><span>第 ${page} / ${pages} 頁</span>`;
  $('searchResults').innerHTML=works.length?works.map((w,i)=>paperCard(w,state.search.query,'search',state.search.works.indexOf(w))).join(''):'<div class="empty-card">沒有找到符合條件的論文。</div>';
  $('pageLabel').textContent=`第 ${page} 頁`; $('prevPage').disabled=page<=1; $('nextPage').disabled=page>=pages;
}
$('searchBtn').addEventListener('click',()=>runSearch(true)); $('searchQuery').addEventListener('keydown',e=>{if(e.key==='Enter')runSearch(true)});
$('searchSort').addEventListener('change',renderSearch); $('prevPage').addEventListener('click',()=>{if(state.search.page>1){state.search.page--;runSearch(false)}}); $('nextPage').addEventListener('click',()=>{state.search.page++;runSearch(false)});
$('saveOaKey').addEventListener('click',()=>{localStorage.setItem(STORE.oaKey,$('oaKey').value.trim());toast('OpenAlex API key 已儲存於本機')}); $('clearOaKey').addEventListener('click',()=>{localStorage.removeItem(STORE.oaKey);$('oaKey').value='';toast('OpenAlex API key 已清除')}); $('oaKey').value=oaKey();

$('searchResults').addEventListener('click', handlePaperAction); $('evidenceResults').addEventListener('click', handlePaperAction);
function contextWork(context,index){ return context==='evidence'?state.evidence.works[index]:state.search.works[index]; }
async function handlePaperAction(e){
  const btn=e.target.closest('[data-action]'); if(!btn) return; const action=btn.dataset.action, context=btn.dataset.context, index=Number(btn.dataset.index), w=contextWork(context,index); if(!w) return;
  if(action==='read'){ await openRemotePaper(w); }
  else if(action==='library'){ await addToLibrary(w); }
  else if(action==='evidence'){ let target=w; if(!target.id){ try{ target=await resolveTarget(target.doi||target.title); }catch(err){ toast(err.message); return; } } state.evidence.target=target; fillTarget(target); showView('evidence'); await runCitationAnalysis(target); }
  else if(action==='citingpdf'){ const input=$('evidenceResults').querySelector(`.citing-file[data-index="${index}"]`); if(input) input.click(); }
}
$('evidenceResults').addEventListener('change',async e=>{ if(!e.target.matches('.citing-file')) return; const index=Number(e.target.dataset.index), file=e.target.files?.[0]; if(file) await analyzeCitingPdf(index,file); e.target.value=''; });

// ---------------- Reader ----------------
$('readerPick').addEventListener('click',()=>$('readerFile').click()); $('readerUploadTop').addEventListener('click',()=>$('readerFile').click());
$('readerFile').addEventListener('change',async e=>{ const f=e.target.files?.[0]; if(f) await openLocalPaper(f); e.target.value=''; });
const drop=$('readerDrop'); ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')})); ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')})); drop.addEventListener('drop',async e=>{const f=[...e.dataTransfer.files].find(x=>x.type==='application/pdf'||x.name.toLowerCase().endsWith('.pdf')); if(f) await openLocalPaper(f)});
$('loadPdfUrl').addEventListener('click',()=>{const url=$('pdfUrl').value.trim(); if(url) openPdfUrl(url,{title:url.split('/').pop()||'Remote PDF',pdfUrl:url,landingUrl:url}); else toast('請貼上 PDF URL')});

async function openLocalPaper(file){
  showView('reader'); toast('正在讀取本機 PDF…'); const buf=await file.arrayBuffer();
  const meta={id:`local-${Date.now()}`,title:file.name.replace(/\.pdf$/i,''),authors:'',source:'Local PDF',year:'',citations:0,doi:'',pdfUrl:'',landingUrl:'',isLocal:true,fileName:file.name};
  await loadPdfBuffer(buf,meta,file.name,'');
}
async function openRemotePaper(w){ showView('reader'); await openPdfUrl(w.pdfUrl,w); }
async function openPdfUrl(url,meta){
  if(!url){ toast('這筆結果沒有可直接取得的 PDF'); return; }
  $('pdfUrl').value=url; toast('正在載入 Open Access PDF…');
  try{ const res=await fetch(url); if(!res.ok) throw new Error(`HTTP ${res.status}`); const buf=await res.arrayBuffer(); await loadPdfBuffer(buf,{...meta,pdfUrl:url},meta.title||'Remote PDF',url); }
  catch(e){
    state.reader.meta={...meta,pdfUrl:url}; updateReaderMeta(); updateCitationInfo();
    $('assistantOutput').innerHTML=`<h4>PDF 無法直接載入</h4><p>來源網站擋住跨網域讀取（CORS）。你仍可開啟原始 PDF，再下載後拖進這個 Reader。</p><p><a class="btn small" href="${esc(url)}" target="_blank" rel="noreferrer">開啟原始 PDF ↗</a></p>`;
    toast('PDF 來源限制跨網域載入，請下載後上傳');
  }
}
async function loadPdfBuffer(buffer,meta,fileName='',url=''){
  if(!window.pdfjsLib){ toast('PDF.js 載入失敗'); return; }
  const token=++state.reader.renderToken; state.reader.buffer=buffer.slice(0); state.reader.meta=meta||{}; state.reader.fileName=fileName; state.reader.url=url; state.reader.fullText=''; state.reader.pageTexts=[]; state.reader.selectedText=''; state.reader.currentPage=1;
  state.reader.highlights=loadJSON(STORE.highlights,[]).filter(x=>x.paperKey===readerKey()); state.reader.notes=loadJSON(STORE.notes,[]).filter(x=>x.paperKey===readerKey()); hideSelectionUi(true); $('selectionBox').classList.add('hidden');
  $('readerEmpty').classList.add('hidden'); $('pdfViewport').classList.remove('hidden'); $('pdfPages').innerHTML='<div class="empty-card">正在解析 PDF…</div>';
  try{
    const pdf=await pdfjsLib.getDocument({data:buffer.slice(0)}).promise; if(token!==state.reader.renderToken) return; state.reader.pdf=pdf; state.reader.pages=pdf.numPages; $('pdfPageCount').textContent=`/ ${pdf.numPages}`; $('pageJump').value='1';
    updateReaderMeta(); renderNotes(); await renderPdfPages(token); updateCitationInfo(); toast(`PDF 已載入：${pdf.numPages} 頁`);
  }catch(e){ $('pdfPages').innerHTML=`<div class="empty-card">PDF 解析失敗：${esc(e.message)}</div>`; toast('PDF 解析失敗'); }
}
function capturePdfScrollAnchor(){
  const vp=$('pdfViewport'), page=currentPageElement();
  if(!vp || !page) return {page:state.reader.currentPage||1,ratio:0};
  const ratio=Math.max(0,Math.min(1,(vp.scrollTop-page.offsetTop)/Math.max(1,page.offsetHeight)));
  return {page:Number(page.dataset.page||state.reader.currentPage||1),ratio};
}
function restorePdfScrollAnchor(anchor){
  const vp=$('pdfViewport'); if(!vp || !anchor) return;
  const page=$('pdfPages').querySelector(`.pdf-page[data-page="${anchor.page}"]`);
  if(page) vp.scrollTop=Math.max(0,page.offsetTop + page.offsetHeight*anchor.ratio);
}
function clearNativePdfSelection(){
  const sel=window.getSelection(); if(!sel || sel.rangeCount===0) return;
  const a=nodeElement(sel.anchorNode), f=nodeElement(sel.focusNode);
  if((a&&$('pdfViewport').contains(a)) || (f&&$('pdfViewport').contains(f))) sel.removeAllRanges();
}
async function renderPdfPages(token=state.reader.renderToken){
  const pdf=state.reader.pdf; if(!pdf) return;
  const anchor=capturePdfScrollAnchor();
  hideSelectionUi(true); clearNativePdfSelection();
  const container=$('pdfPages'); container.innerHTML=''; state.reader.fullText=''; state.reader.pageTexts=[];
  for(let n=1;n<=pdf.numPages;n++){
    if(token!==state.reader.renderToken) return;
    const page=await pdf.getPage(n), viewport=page.getViewport({scale:state.reader.scale}), wrap=document.createElement('div');
    wrap.className='pdf-page'; wrap.dataset.page=n; wrap.setAttribute('role','document'); wrap.setAttribute('aria-label',`PDF page ${n}`);
    wrap.style.width=`${viewport.width}px`; wrap.style.height=`${viewport.height}px`; wrap.style.setProperty('--scale-factor',String(state.reader.scale));

    const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d',{alpha:false}), outputScale=window.devicePixelRatio||1;
    canvas.width=Math.floor(viewport.width*outputScale); canvas.height=Math.floor(viewport.height*outputScale);
    canvas.style.width=`${viewport.width}px`; canvas.style.height=`${viewport.height}px`; wrap.appendChild(canvas);

    const textLayer=document.createElement('div');
    textLayer.className='textLayer'; textLayer.dataset.page=n; textLayer.style.width=`${viewport.width}px`; textLayer.style.height=`${viewport.height}px`;
    textLayer.style.setProperty('--scale-factor',String(state.reader.scale));
    wrap.appendChild(textLayer); container.appendChild(wrap);

    await page.render({canvasContext:ctx,viewport,transform:outputScale!==1?[outputScale,0,0,outputScale,0,0]:null}).promise;
    const tc=await page.getTextContent({includeMarkedContent:true});
    const pageText=tc.items.filter(i=>typeof i.str==='string').map(i=>i.str).join(' ');
    state.reader.pageTexts[n-1]=pageText; state.reader.fullText += `\n\n[Page ${n}]\n${pageText}`;

    let rendered=false;
    try{
      const textDivs=[];
      const task=pdfjsLib.renderTextLayer({textContentSource:tc,container:textLayer,viewport,textDivs,enhanceTextSelection:true});
      if(task?.promise) await task.promise; else await task;
      rendered=true;
    }catch(e){ console.warn('PDF.js text layer fallback',e); }
    if(!rendered) manualTextLayer(tc,textLayer,viewport);

    if(!textLayer.querySelector('.endOfContent')){
      const end=document.createElement('div'); end.className='endOfContent'; end.setAttribute('aria-hidden','true'); textLayer.appendChild(end);
    }
    $$('span',textLayer).forEach((span,i)=>{ span.dataset.textIndex=String(i); });
    applyTextMarks(textLayer);
    if(n%3===0) await new Promise(r=>requestAnimationFrame(r));
  }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  restorePdfScrollAnchor(anchor);
}
function manualTextLayer(tc,container,viewport){
  const created=[];
  for(const item of tc.items){
    if(typeof item.str!=='string') continue;
    const tx=pdfjsLib.Util.transform(viewport.transform,item.transform), style=tc.styles?.[item.fontName]||{};
    let angle=Math.atan2(tx[1],tx[0]); if(style.vertical) angle+=Math.PI/2;
    const fontHeight=Math.hypot(tx[2],tx[3]);
    const fontAscent=style.ascent?style.ascent*fontHeight:style.descent?(1+style.descent)*fontHeight:fontHeight;
    const left=tx[4]+fontAscent*Math.sin(angle), top=tx[5]-fontAscent*Math.cos(angle);
    const span=document.createElement('span'); span.textContent=item.str; span.style.left=`${left}px`; span.style.top=`${top}px`;
    span.style.fontSize=`${fontHeight}px`; if(style.fontFamily) span.style.fontFamily=style.fontFamily;
    span.dataset.angle=String(angle); span.dataset.targetWidth=String(Math.abs((item.width||0)*viewport.scale));
    span.style.transform=angle?`rotate(${angle}rad)`:''; container.appendChild(span); created.push(span);
  }
  for(const span of created){
    const target=Number(span.dataset.targetWidth||0), measured=span.getBoundingClientRect().width;
    if(target>0 && measured>0){
      const sx=Math.max(.25,Math.min(4,target/measured)), angle=Number(span.dataset.angle||0);
      span.style.transform=`${angle?`rotate(${angle}rad) `:''}scaleX(${sx})`;
    }
  }
}
function applyTextMarks(layer){
  const auto=state.reader.autoHighlight; const manual=state.reader.highlights.map(x=>x.text.toLowerCase()).filter(Boolean);
  $$('span',layer).forEach(span=>{
    const t=(span.textContent||'').trim(), l=t.toLowerCase(); if(!t) return;
    if(auto && /(we (show|demonstrate|find|report)|results? (show|indicate|suggest)|significant|conclusion|in summary|novel|outperform|limitation)/i.test(t)) span.classList.add('auto-mark');
    if(manual.some(h=>h.length>8 && (h.includes(l)||l.includes(h.slice(0,Math.min(60,h.length)))))) span.classList.add('manual-mark');
  });
}
function readerKey(){ const m=state.reader.meta||{}; return m.doi||m.id||m.title||state.reader.fileName||'unknown'; }
function updateReaderMeta(){ const m=state.reader.meta||{}; $('readerMeta').innerHTML=`<b>${esc(m.title||state.reader.fileName||'PDF')}</b><span>${esc([m.authors,m.source,m.year].filter(Boolean).join(' · ')||'本機文件')}</span>`; }
function updateCitationInfo(){
  const m=state.reader.meta||{}, refs=extractReferences(state.reader.fullText).slice(0,25);
  $('citationInfo').innerHTML=`<h4>${esc(m.title||'目前文件')}</h4><p><strong>Authors：</strong>${esc(m.authors||'未辨識')}</p><p><strong>Venue：</strong>${esc(m.source||'未辨識')} ${m.year?`(${esc(m.year)})`:''}</p><p><strong>DOI：</strong>${esc(m.doi||'未辨識')}</p><p><strong>OpenAlex citations：</strong>${fmtNum(m.citations||0)}</p>${refs.length?`<h4>References（節錄）</h4>${refs.map((r,i)=>`<p>${i+1}. ${esc(r)}</p>`).join('')}`:'<p>尚未從文字層辨識到 References。</p>'}`;
}
function extractReferences(text=''){
  if(!text) return []; const lower=text.toLowerCase(); let idx=Math.max(lower.lastIndexOf('\nreferences'),lower.lastIndexOf('\nbibliography')); if(idx<0) return [];
  const tail=text.slice(idx).replace(/^.*?(references|bibliography)/i,'').trim(); const lines=tail.split(/\n|(?=\[\d+\])|(?=\d+\.\s+[A-Z])/).map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x.length>35); return [...new Set(lines)].slice(0,80);
}
function currentPageElement(){ return $('pdfPages').querySelector(`.pdf-page[data-page="${state.reader.currentPage}"]`); }
function goPdfPage(n){ n=Math.max(1,Math.min(state.reader.pages||1,Number(n)||1)); state.reader.currentPage=n; $('pageJump').value=n; currentPageElement()?.scrollIntoView({behavior:'smooth',block:'start'}); }
$('prevPdfPage').addEventListener('click',()=>goPdfPage(state.reader.currentPage-1)); $('nextPdfPage').addEventListener('click',()=>goPdfPage(state.reader.currentPage+1)); $('pageJump').addEventListener('change',()=>goPdfPage($('pageJump').value));
$('zoomIn').addEventListener('click',async()=>{state.reader.scale=Math.min(2.4,state.reader.scale+.15);$('zoomLabel').textContent=`${Math.round(state.reader.scale*100)}%`; if(state.reader.pdf)await renderPdfPages()}); $('zoomOut').addEventListener('click',async()=>{state.reader.scale=Math.max(.65,state.reader.scale-.15);$('zoomLabel').textContent=`${Math.round(state.reader.scale*100)}%`;if(state.reader.pdf)await renderPdfPages()});
$('fitWidth').addEventListener('click',async()=>{if(!state.reader.pdf)return; const p=await state.reader.pdf.getPage(1), base=p.getViewport({scale:1}), width=$('pdfViewport').clientWidth-36; state.reader.scale=Math.max(.65,Math.min(2.2,width/base.width)); $('zoomLabel').textContent=`${Math.round(state.reader.scale*100)}%`; await renderPdfPages();});
$('autoHighlight').addEventListener('change',async e=>{state.reader.autoHighlight=e.target.checked;if(state.reader.pdf) await renderPdfPages();});

let selectionTimer=null, selectionPointerActive=false, selectionRaf=0, lastSelectionPointer=null;
function nodeElement(node){
  if(!node) return null;
  return node.nodeType===1?node:node.parentElement;
}
function nodeTextLayer(node){ return nodeElement(node)?.closest?.('.textLayer')||null; }
function selectionIsInsidePdf(sel){
  if(!sel || sel.rangeCount===0 || sel.isCollapsed) return false;
  const a=nodeTextLayer(sel.anchorNode), f=nodeTextLayer(sel.focusNode), vp=$('pdfViewport');
  return !!(a && f && vp.contains(a) && vp.contains(f));
}
function selectionDirection(sel,range){
  if(!sel || !range) return 'forward';
  return sel.anchorNode===range.startContainer && sel.anchorOffset===range.startOffset ? 'forward' : 'backward';
}
function cleanRects(rectList){
  let rects=[...rectList].filter(r=>Number.isFinite(r.left)&&Number.isFinite(r.top)&&r.width>.35&&r.height>.35)
    .map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,x:r.x,y:r.y}));
  if(rects.length>1){
    const hs=rects.map(r=>r.height).sort((a,b)=>a-b), median=hs[Math.floor(hs.length/2)]||16;
    const maxH=Math.max(72,median*4.5), maxW=Math.max(900,$('pdfViewport')?.clientWidth*1.35||900);
    const filtered=rects.filter(r=>r.height<=maxH && r.width<=maxW);
    if(filtered.length) rects=filtered;
  }
  return rects;
}
function visibleRect(rect){
  const vp=$('pdfViewport')?.getBoundingClientRect(); if(!vp) return true;
  return rect.right>Math.max(0,vp.left) && rect.left<Math.min(window.innerWidth,vp.right) && rect.bottom>Math.max(0,vp.top) && rect.top<Math.min(window.innerHeight,vp.bottom);
}
function pointRectDistance2(p,r){
  const dx=p.x<r.left?r.left-p.x:p.x>r.right?p.x-r.right:0;
  const dy=p.y<r.top?r.top-p.y:p.y>r.bottom?p.y-r.bottom:0;
  return dx*dx+dy*dy;
}
function selectionGeometry(range,direction='forward',pointerHint=null){
  if(!range) return null;
  let rects=cleanRects(range.getClientRects());
  if(!rects.length){ const r=range.getBoundingClientRect(); if(r.width||r.height) rects=cleanRects([r]); }
  if(!rects.length) return null;
  const visible=rects.filter(visibleRect), pool=visible.length?visible:rects;
  let edge=direction==='backward'?pool[0]:pool[pool.length-1];
  if(pointerHint && Date.now()-pointerHint.t<900){
    edge=pool.reduce((best,r)=>pointRectDistance2(pointerHint,r)<pointRectDistance2(pointerHint,best)?r:best,edge);
  }
  const left=Math.min(...rects.map(r=>r.left)), right=Math.max(...rects.map(r=>r.right));
  const top=Math.min(...rects.map(r=>r.top)), bottom=Math.max(...rects.map(r=>r.bottom));
  return {rects,edge,union:{left,right,top,bottom,width:right-left,height:bottom-top},direction};
}
function selectionPageFromEndpoint(sel,direction){
  const node=direction==='backward'?sel.focusNode:sel.focusNode;
  return Number(nodeElement(node)?.closest?.('.pdf-page')?.dataset.page||state.reader.currentPage||1);
}
function sanitizeSelectionText(text=''){
  return String(text).replace(/\u00ad/g,'').replace(/-\s*\n\s*/g,'').replace(/[\t\r\n ]+/g,' ').trim();
}
function hideSelectionUi(clear=false){
  $('selectionToolbar').classList.add('hidden'); $('selectionToolbar').classList.remove('is-below','selection-moving');
  $('selectionComment').classList.add('hidden');
  if(clear){
    state.reader.selectedText=''; state.reader.selectionPage=null; state.reader.selectionRect=null;
    state.reader.selectionRange=null; state.reader.selectionDirection='forward';
  }
}
function positionFloating(el,rect,preferAbove=true){
  if(!rect || !el) return false;
  if(el===$('selectionToolbar')) el.classList.remove('selection-moving');
  const vp=$('pdfViewport')?.getBoundingClientRect();
  if(vp && (rect.bottom<vp.top || rect.top>vp.bottom || rect.right<vp.left || rect.left>vp.right)){ el.classList.add('hidden'); return false; }
  el.classList.remove('hidden'); el.style.visibility='hidden';
  const box=el.getBoundingClientRect(), margin=10, navBottom=Math.max(10,document.querySelector('.topbar')?.getBoundingClientRect().bottom||0);
  let left=rect.left + rect.width/2 - box.width/2;
  left=Math.max(margin,Math.min(window.innerWidth-box.width-margin,left));
  let above=preferAbove, top=rect.top-box.height-10;
  if(!above || top<navBottom+6){ top=rect.bottom+10; above=false; }
  if(top+box.height>window.innerHeight-margin){ top=Math.max(navBottom+6,rect.top-box.height-10); above=true; }
  el.style.left=`${Math.round(left)}px`; el.style.top=`${Math.round(top)}px`; el.style.visibility='visible';
  el.classList.toggle('is-below',!above);
  return true;
}
function refreshStoredSelectionPosition(){
  const range=state.reader.selectionRange; if(!range || selectionPointerActive) return;
  try{
    const g=selectionGeometry(range,state.reader.selectionDirection||'forward');
    if(!g){ hideSelectionUi(false); return; }
    state.reader.selectionRect=g.edge;
    if(!$('selectionComment').classList.contains('hidden')) positionFloating($('selectionComment'),g.edge,false);
    else positionFloating($('selectionToolbar'),g.edge,true);
  }catch{ hideSelectionUi(false); }
}
function syncPdfSelection(){
  selectionRaf=0;
  if(selectionPointerActive) return;
  const sel=window.getSelection();
  if(!selectionIsInsidePdf(sel)){ hideSelectionUi(false); return; }
  const raw=sanitizeSelectionText(sel.toString()); if(!raw){ hideSelectionUi(false); return; }
  const range=sel.getRangeAt(0), direction=selectionDirection(sel,range), geometry=selectionGeometry(range,direction,lastSelectionPointer);
  if(!geometry){ hideSelectionUi(false); return; }
  state.reader.selectedText=raw.slice(0,12000); state.reader.selectionPage=selectionPageFromEndpoint(sel,direction);
  state.reader.selectionRange=range.cloneRange(); state.reader.selectionDirection=direction; state.reader.selectionRect=geometry.edge;
  $('selectedText').textContent=state.reader.selectedText; $('selectionBox').classList.remove('hidden');
  positionFloating($('selectionToolbar'),geometry.edge,true);
}
function scheduleSelectionSync(delay=0){
  clearTimeout(selectionTimer); cancelAnimationFrame(selectionRaf);
  selectionTimer=setTimeout(()=>{
    selectionRaf=requestAnimationFrame(()=>requestAnimationFrame(syncPdfSelection));
  },delay);
}
function beginPdfSelection(e){
  if(!e.target.closest('.textLayer')) return;
  selectionPointerActive=true; $('pdfViewport').classList.add('is-selecting');
  $$('.textLayer.selecting',$('pdfPages')).forEach(x=>x.classList.remove('selecting'));
  e.target.closest('.textLayer')?.classList.add('selecting');
  $('selectionToolbar').classList.add('selection-moving','hidden'); $('selectionComment').classList.add('hidden');
}
function endPdfSelection(e){
  if(e && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) lastSelectionPointer={x:e.clientX,y:e.clientY,t:Date.now()};
  if(!selectionPointerActive) return;
  selectionPointerActive=false; $('pdfViewport').classList.remove('is-selecting');
  $$('.textLayer.selecting',$('pdfPages')).forEach(x=>x.classList.remove('selecting'));
  scheduleSelectionSync(18);
}
$('pdfViewport').addEventListener('pointerdown',beginPdfSelection);
$('pdfViewport').addEventListener('pointerup',endPdfSelection);
$('pdfViewport').addEventListener('pointercancel',endPdfSelection);
document.addEventListener('pointerup',e=>{ if(selectionPointerActive) endPdfSelection(e); });
$('pdfViewport').addEventListener('keyup',()=>scheduleSelectionSync(20));
$('pdfViewport').addEventListener('touchend',()=>{ selectionPointerActive=false; $('pdfViewport').classList.remove('is-selecting'); $$('.textLayer.selecting',$('pdfPages')).forEach(x=>x.classList.remove('selecting')); scheduleSelectionSync(70); },{passive:true});
window.addEventListener('blur',()=>{ selectionPointerActive=false; $('pdfViewport').classList.remove('is-selecting'); $$('.textLayer.selecting',$('pdfPages')).forEach(x=>x.classList.remove('selecting')); });
document.addEventListener('selectionchange',()=>{
  if(selectionPointerActive) return;
  const sel=window.getSelection();
  if(sel && !sel.isCollapsed && selectionIsInsidePdf(sel)) scheduleSelectionSync(90);
});
$('selectionToolbar').addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); });
$('selectionComment').addEventListener('pointerdown',e=>e.stopPropagation());
let selectionPositionRaf=0;
function queueSelectionPositionRefresh(){
  if(selectionPositionRaf || !state.reader.selectionRange || selectionPointerActive) return;
  selectionPositionRaf=requestAnimationFrame(()=>{ selectionPositionRaf=0; refreshStoredSelectionPosition(); });
}
$('pdfViewport').addEventListener('scroll',queueSelectionPositionRefresh,{passive:true});
window.addEventListener('scroll',queueSelectionPositionRefresh,{passive:true,capture:true});
window.addEventListener('resize',queueSelectionPositionRefresh,{passive:true});
document.addEventListener('pointerdown',e=>{
  if(e.target.closest('#selectionToolbar')||e.target.closest('#selectionComment')) return;
  if(e.target.closest('.textLayer')) return;
  hideSelectionUi(false);
});
function restoreStoredNativeSelection(){
  const range=state.reader.selectionRange; if(!range) return;
  try{ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range.cloneRange()); }catch{}
}
$('selectionToolbar').addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]'); if(!b)return; e.preventDefault(); e.stopPropagation(); restoreStoredNativeSelection();
  const a=b.dataset.action;
  if(a==='explain') await explainSelection();
  if(a==='highlight') addHighlight();
  if(a==='translate') await translateSelection();
  if(a==='comment'){ $('selectionCommentInput').value=''; positionFloating($('selectionComment'),state.reader.selectionRect,false); setTimeout(()=>$('selectionCommentInput').focus(),0); return; }
  if(a==='chat') startSelectionChat();
  $('selectionToolbar').classList.add('hidden');
});
$('translateBtn').addEventListener('click',translateSelection); $('explainBtn').addEventListener('click',explainSelection); $('supportBtn').addEventListener('click',researchFitSelection);
$('cancelSelectionComment').addEventListener('click',()=>{ $('selectionComment').classList.add('hidden'); restoreStoredNativeSelection(); refreshStoredSelectionPosition(); });
$('saveSelectionComment').addEventListener('click',()=>saveSelectionComment());
$('selectionCommentInput').addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter') saveSelectionComment(); if(e.key==='Escape') $('cancelSelectionComment').click(); });
function saveSelectionComment(){
  const t=state.reader.selectedText, note=$('selectionCommentInput').value.trim(); if(!t)return;
  const all=loadJSON(STORE.notes,[]); all.push({id:Date.now(),paperKey:readerKey(),quote:t,note,created:new Date().toISOString(),page:state.reader.selectionPage||null});
  saveJSON(STORE.notes,all); state.reader.notes=all.filter(x=>x.paperKey===readerKey()); renderNotes(); $('selectionComment').classList.add('hidden'); toast('Comment（註記）已儲存');
}
function startSelectionChat(){
  const t=state.reader.selectedText;if(!t)return;
  $$('.reader-tab').forEach(b=>b.classList.toggle('active',b.dataset.readerTab==='assistant'));
  $$('.reader-tabpane').forEach(p=>p.classList.toggle('active',p.id==='readerTab-assistant'));
  $('askInput').value=`請根據整篇論文上下文解釋這段內容，並回答我接下來的問題：\n\n「${t.slice(0,1600)}」\n\n`;
  $('askInput').focus(); $('askInput').setSelectionRange($('askInput').value.length,$('askInput').value.length);
  $('askInput').scrollIntoView({behavior:'smooth',block:'center'});
}

function aiSettings(){
  const remember=!!localStorage.getItem(STORE.aiKey); return {key:localStorage.getItem(STORE.aiKey)||sessionStorage.getItem(STORE.aiKey)||'',model:localStorage.getItem(STORE.aiModel)||'gpt-5-mini',endpoint:localStorage.getItem(STORE.aiEndpoint)||'https://api.openai.com/v1/responses',remember};
}
async function askAI(system,user){
  const s=aiSettings(); if(!s.key) throw new Error('NO_AI_KEY');
  const res=await fetch(s.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.key}`},body:JSON.stringify({model:s.model,input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:user}]}]})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error?.message||`AI API ${res.status}`);
  if(d.output_text) return d.output_text; for(const o of d.output||[]) for(const c of o.content||[]) if(c.type==='output_text'&&c.text) return c.text; return JSON.stringify(d,null,2);
}
async function freeTranslate(text){
  const clipped=text.slice(0,480); const url=new URL('https://api.mymemory.translated.net/get'); url.searchParams.set('q',clipped); url.searchParams.set('langpair','en|zh-TW'); const res=await fetch(url); if(!res.ok) throw new Error('Free translation unavailable'); const d=await res.json(); return d.responseData?.translatedText||'';
}
function setAssistant(title,body){ $('assistantOutput').innerHTML=`<h4>${esc(title)}</h4><div>${esc(body).replace(/\n/g,'<br>')}</div>`; $$('.reader-tab').forEach(b=>b.classList.toggle('active',b.dataset.readerTab==='assistant')); $$('.reader-tabpane').forEach(p=>p.classList.toggle('active',p.id==='readerTab-assistant')); }
async function translateSelection(){ const t=state.reader.selectedText;if(!t){toast('請先選取 PDF 文字');return;} setAssistant('Translation（翻譯）','處理中…'); try{let out; try{out=await askAI('Translate the selected academic text into Traditional Chinese. Preserve technical terms in English followed by Traditional Chinese in parentheses when helpful. Do not add unrelated commentary.',t);}catch(e){if(e.message!=='NO_AI_KEY')console.warn(e);out=await freeTranslate(t);}setAssistant('Translation（翻譯）',out||'無翻譯結果');}catch(e){setAssistant('Translation（翻譯）',`目前無法自動翻譯。可複製所選文字後使用外部翻譯服務。\n\n${e.message}`)} }
function localExplain(text){ const nums=[...text.matchAll(/\b\d+(?:\.\d+)?(?:\s?(?:nm|μm|um|mM|µM|nM|pM|dB|Hz|kHz|MHz|GHz|%))?\b/g)].map(m=>m[0]).slice(0,10); const caps=[...new Set((text.match(/\b[A-Z][A-Z0-9-]{2,}\b/g)||[]))].slice(0,12); return `這段文字的主旨：${text.slice(0,320)}${text.length>320?'…':''}\n\n關鍵縮寫 / 技術詞：${caps.length?caps.join(', '):'未明顯辨識'}\n數值 / 條件：${nums.length?nums.join(', '):'未明顯辨識'}\n\n要得到更精準、結合整篇上下文的解釋，可在「AI 設定」加入自己的 API key。`; }
async function explainSelection(){ const t=state.reader.selectedText;if(!t){toast('請先選取 PDF 文字');return;} setAssistant('Explanation（解釋）','處理中…'); try{const context=state.reader.fullText.slice(0,18000);const out=await askAI('You are an academic paper reading assistant. Explain the selected passage in Traditional Chinese, grounded only in the supplied paper context. For English technical terms, add Traditional Chinese meaning in parentheses. Separate: plain-language meaning, variables/terms, what the authors are claiming, and caveats.',`PAPER CONTEXT:\n${context}\n\nSELECTED PASSAGE:\n${t}`);setAssistant('Explanation（解釋）',out);}catch(e){setAssistant('Explanation（本機解釋）',localExplain(t));} }
async function researchFitSelection(){ const t=state.reader.selectedText;if(!t){toast('請先選取文字');return;} setAssistant('Research Fit（與我的研究關係）','處理中…'); try{const out=await askAI('Analyze the selected academic passage for research usefulness. Answer in Traditional Chinese with four headings: 支持什麼, 不支持/不能證明什麼, 可引用的證據, 下一個驗證實驗. Do not overclaim. For English technical terms, add Traditional Chinese meaning in parentheses).',t);setAssistant('Research Fit（與我的研究關係）',out);}catch(e){setAssistant('Research Fit（本機）',`支持：這段內容可直接支持其中明確陳述的機制 / 現象。\n\n不能證明：不要把作者沒有測量的因果關係延伸成結論。\n\n建議：把這段的量測條件、樣品、濃度 / 波長 / 時間尺度與你的實驗逐項對照後再引用。\n\n原文：${t}`);} }
function addHighlight(){ const t=state.reader.selectedText;if(!t)return; const all=loadJSON(STORE.highlights,[]); if(!all.some(x=>x.paperKey===readerKey()&&x.text===t)) all.push({paperKey:readerKey(),text:t,created:new Date().toISOString()}); saveJSON(STORE.highlights,all); state.reader.highlights=all.filter(x=>x.paperKey===readerKey()); $$('.textLayer',$('pdfPages')).forEach(applyTextMarks); toast('已加入 Highlight（高亮）'); }
function addNote(){ const t=state.reader.selectedText;if(!t)return; const note=window.prompt('這段要記什麼？',''); if(note===null)return; const all=loadJSON(STORE.notes,[]); all.push({id:Date.now(),paperKey:readerKey(),quote:t,note:note.trim(),created:new Date().toISOString()}); saveJSON(STORE.notes,all); state.reader.notes=all.filter(x=>x.paperKey===readerKey()); renderNotes(); toast('筆記已儲存'); }
function renderNotes(){ const list=state.reader.notes||[]; $('notesList').innerHTML=list.length?list.slice().reverse().map(n=>`<div class="note-card"><q>${esc(n.quote)}</q><p>${esc(n.note||'（無文字註記）')}</p><small>${n.page?`Page ${n.page} · `:''}${new Date(n.created).toLocaleString()}</small></div>`).join(''):'<div class="placeholder">尚無筆記。</div>'; }
$('exportNotes').addEventListener('click',()=>{const m=state.reader.meta||{};const txt=`# ${m.title||'OpenScite Notes'}\n\n`+(state.reader.notes||[]).map((n,i)=>`## ${i+1}\n> ${n.quote}\n\n${n.note}\n`).join('\n');downloadText(`${safeFile(m.title||'notes')}.md`,txt,'text/markdown')}); $('clearNotes').addEventListener('click',()=>{if(!confirm('清空這篇論文的所有筆記？'))return;const key=readerKey();const all=loadJSON(STORE.notes,[]).filter(x=>x.paperKey!==key);saveJSON(STORE.notes,all);state.reader.notes=[];renderNotes()});

$$('.reader-tab').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.readerTab;$$('.reader-tab').forEach(x=>x.classList.toggle('active',x===b));$$('.reader-tabpane').forEach(p=>p.classList.toggle('active',p.id===`readerTab-${t}`));}));
function sectionBetween(text,startNames,endNames,max=9000){ const lower=text.toLowerCase(); let start=-1; for(const n of startNames){const i=lower.indexOf(n.toLowerCase());if(i>=0&&(start<0||i<start))start=i;} if(start<0)return''; let end=text.length; for(const n of endNames){const i=lower.indexOf(n.toLowerCase(),start+10);if(i>start&&i<end)end=i;} return text.slice(start,Math.min(end,start+max)).replace(/\s+/g,' ').trim(); }
function localSummary(){ const t=state.reader.fullText;if(!t)return null; const abs=sectionBetween(t,['abstract'],['introduction','keywords'],5000); const concl=sectionBetween(t,['conclusion','conclusions'],['acknowledg','references'],6500); const intro=sectionBetween(t,['introduction'],['methods','materials','experimental','results'],5000); return {abs,intro,concl}; }
$('localSummaryBtn').addEventListener('click',()=>{const s=localSummary();if(!s){toast('請先載入 PDF');return;}$('summaryOutput').innerHTML=`<h4>Abstract / 核心摘要</h4><p>${esc(s.abs||'未辨識到 Abstract。')}</p><h4>Research context / 研究背景</h4><p>${esc(s.intro||'未辨識到 Introduction。')}</p><h4>Conclusion / 結論</h4><p>${esc(s.concl||'未辨識到 Conclusion。')}</p>`;});
$('aiSummaryBtn').addEventListener('click',async()=>{if(!state.reader.fullText){toast('請先載入 PDF');return;} $('summaryOutput').textContent='AI 深度摘要處理中…';try{const excerpt=state.reader.fullText.slice(0,28000)+state.reader.fullText.slice(-8000);const out=await askAI('Summarize this research paper in Traditional Chinese. Use headings: 研究問題, 方法, 關鍵實驗條件, 主要結果（保留數字）, 作者結論, 限制, 可以支持什麼, 不能支持什麼. Do not invent facts. English technical terms should include Traditional Chinese meanings in parentheses).',excerpt);$('summaryOutput').textContent=out;}catch(e){$('localSummaryBtn').click();toast(e.message==='NO_AI_KEY'?'未設定 AI key，已改用本機摘要':'AI 摘要失敗，已改用本機摘要');}});
$('deepSearchBtn').addEventListener('click',()=>{const m=state.reader.meta||{};const basis=m.title||sectionBetween(state.reader.fullText,['abstract'],['introduction'],1000);if(!basis){toast('目前沒有可延伸搜尋的標題 / 摘要');return;}const words=basis.replace(/[^A-Za-z0-9\-–μµ]+/g,' ').split(/\s+/).filter(w=>w.length>3&&!/^(with|from|that|this|using|based|study|paper|results)$/i.test(w)).slice(0,12).join(' ');$('searchQuery').value=words;showView('search');runSearch(true);});
$('askBtn').addEventListener('click',async()=>{const q=$('askInput').value.trim();if(!q){toast('請先輸入問題');return;}setAssistant('Paper Q&A','處理中…');try{const ctx=state.reader.fullText.slice(0,30000)+state.reader.fullText.slice(-9000);const out=await askAI('Answer questions about an academic paper using only the supplied context. Respond in Traditional Chinese. Cite page markers like [Page 3] when they appear in the context. If evidence is insufficient, say so. English technical terms should include Traditional Chinese meanings in parentheses).',`PAPER:\n${ctx}\n\nQUESTION:\n${q}`);setAssistant('Paper Q&A',out);}catch(e){setAssistant('Paper Q&A（本機）',`未設定可用 AI API，因此無法做整篇語意問答。你可以先用 Summary（摘要）、選字 Explain（解釋）與 Citation Evidence（引用證據）功能。\n\n問題：${q}`);}});

// ---------------- Library ----------------
function openDb(){ return new Promise((resolve,reject)=>{const req=indexedDB.open('openscite-pdfs',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('pdfs'))req.result.createObjectStore('pdfs')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}); }
async function idbPut(key,buf){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').put(buf,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});}catch(e){console.warn(e);} }
async function idbGet(key){try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readonly');const r=tx.objectStore('pdfs').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});}catch{return null;} }
async function addToLibrary(w=state.reader.meta){ if(!w){toast('目前沒有論文可加入');return;} const key=w.doi||w.id||w.title; if(!key)return; const item={key,title:w.title||state.reader.fileName||'Untitled',authors:w.authors||'',source:w.source||'',year:w.year||'',doi:w.doi||'',citations:w.citations||0,pdfUrl:w.pdfUrl||state.reader.url||'',landingUrl:w.landingUrl||'',added:new Date().toISOString(),isLocal:!!w.isLocal}; state.library=loadJSON(STORE.library,[]).filter(x=>x.key!==key); state.library.unshift(item); saveJSON(STORE.library,state.library); if(w===state.reader.meta&&state.reader.buffer&&w.isLocal) await idbPut(key,state.reader.buffer); toast('已加入 Library'); }
$('readerSaveLibrary').addEventListener('click',()=>addToLibrary());
function renderLibrary(){ state.library=loadJSON(STORE.library,[]); $('libraryList').innerHTML=state.library.length?state.library.map((x,i)=>`<article class="library-card"><h3>${esc(x.title)}</h3><p>${esc([x.authors,x.source,x.year].filter(Boolean).join(' · '))}</p><div class="paper-actions"><button class="btn small primary" data-lib-action="open" data-index="${i}">閱讀</button><button class="btn small" data-lib-action="search" data-index="${i}">延伸搜尋</button><button class="btn small" data-lib-action="remove" data-index="${i}">移除</button></div></article>`).join(''):'<div class="empty-card">Library 還是空的。</div>'; }
$('libraryList').addEventListener('click',async e=>{const b=e.target.closest('[data-lib-action]');if(!b)return;const i=Number(b.dataset.index),x=state.library[i];if(!x)return;if(b.dataset.libAction==='remove'){state.library.splice(i,1);saveJSON(STORE.library,state.library);renderLibrary();return;}if(b.dataset.libAction==='search'){$('searchQuery').value=x.title;showView('search');runSearch(true);return;}if(b.dataset.libAction==='open'){if(x.isLocal){const buf=await idbGet(x.key);if(buf){showView('reader');await loadPdfBuffer(buf,{...x,isLocal:true},x.title,'');return;}toast('找不到本機 PDF，請重新上傳');return;}if(x.pdfUrl)await openPdfUrl(x.pdfUrl,x);else if(x.landingUrl)window.open(x.landingUrl,'_blank');else toast('Library 內沒有 PDF URL');}});
$('clearLibrary').addEventListener('click',()=>{if(!confirm('清空 Library？'))return;state.library=[];saveJSON(STORE.library,[]);renderLibrary();});

// ---------------- Citation Evidence ----------------
function fillTarget(w){ $('targetQuery').value=w.doi||w.id||w.title||''; $('targetInfo').innerHTML=`<b>${esc(w.title)}</b>${esc([w.authors,w.source,w.year].filter(Boolean).join(' · '))}<br>${w.doi?`DOI: ${esc(w.doi)} · `:''}OpenAlex: ${esc(w.id||'未辨識')}`; }
async function resolveTarget(q){
  const s=q.trim(); if(!s)throw new Error('請輸入 DOI / OpenAlex ID / 論文標題'); let d;
  if(/^W\d+$/i.test(s)) d=await oa(`/works/${s.toUpperCase()}`);
  else if(/10\.\d{4,9}\//i.test(s)) d=await oa(`/works/https://doi.org/${doiClean(s)}`);
  else { const r=await oa('/works',{search:s,'per-page':5}); if(!r.results?.length)throw new Error('找不到目標論文'); d=r.results[0]; }
  return workFromOpenAlex(d);
}
$('analyzeCitations').addEventListener('click',async()=>{setBusy($('analyzeCitations'),true,'分析中');try{const t=await resolveTarget($('targetQuery').value);state.evidence.target=t;fillTarget(t);await runCitationAnalysis(t);}catch(e){toast(e.message);$('evidenceResults').innerHTML=`<div class="empty-card">${esc(e.message)}</div>`;}finally{setBusy($('analyzeCitations'),false)}});
function classifyStance(text=''){
  const s=text.toLowerCase(); const support=['support','consistent with','confirm','confirmed','validate','validated','reproduce','replicate','agreement with','corroborat','in line with','demonstrate the robustness']; const contrast=['contradict','inconsistent with','fail to replicate','failed to replicate','challenge','unlike','in contrast to','however, we found','does not support','not consistent'];
  const sp=support.filter(x=>s.includes(x)).length, cp=contrast.filter(x=>s.includes(x)).length;
  if(sp>cp&&sp>0)return{stance:'supporting',confidence:Math.min(.95,.55+sp*.12)}; if(cp>sp&&cp>0)return{stance:'contrasting',confidence:Math.min(.95,.55+cp*.12)}; if(s.trim())return{stance:'mentioning',confidence:.42}; return{stance:'unknown',confidence:.2};
}
async function runCitationAnalysis(target=state.evidence.target){
  if(!target?.id){toast('目標論文沒有 OpenAlex ID');return;} $('evidenceResults').innerHTML='<div class="empty-card"><span class="spinner"></span> 正在取得後續引用…</div>';
  try{const d=await oa('/works',{filter:`cites:${target.id}`,'per-page':50,sort:'cited_by_count:desc'});const works=(d.results||[]).map(workFromOpenAlex);await enrichSources(works,state.evidence.sourceMap);works.forEach(w=>Object.assign(w,classifyStance(`${w.title} ${w.abstract}`),{contexts:[]}));state.evidence.works=works;renderEvidence();}catch(e){$('evidenceResults').innerHTML=`<div class="empty-card">引用查詢失敗：${esc(e.message)}</div>`;toast('引用分析失敗');}
}
function sortedEvidence(){ let list=state.evidence.works.map((w,i)=>({w,i}));const filter=$('stanceFilter').value,q=$('evidenceFilter').value.trim(),mode=$('evidenceSort').value;if(filter!=='all')list=list.filter(x=>x.w.stance===filter);if(q)list=list.filter(x=>overlapScore(x.w,q)>0);if(mode==='journal')list.sort((a,b)=>(b.w.sourceScore||0)-(a.w.sourceScore||0));else if(mode==='citations')list.sort((a,b)=>b.w.citations-a.w.citations);else if(mode==='year')list.sort((a,b)=>(b.w.year||0)-(a.w.year||0));else if(mode==='evidence')list.sort((a,b)=>(b.w.contexts?.length||0)-(a.w.contexts?.length||0));else list.sort((a,b)=>stanceWeight(b.w.stance)-stanceWeight(a.w.stance)||(b.w.citations||0)-(a.w.citations||0));return list; }
function stanceWeight(s){return s==='supporting'?4:s==='contrasting'?3:s==='mentioning'?2:1}
function renderEvidence(){const q=$('evidenceFilter').value.trim();const list=sortedEvidence();const all=state.evidence.works;$('kpiTotal').textContent=all.length;$('kpiSupporting').textContent=all.filter(x=>x.stance==='supporting').length;$('kpiContrasting').textContent=all.filter(x=>x.stance==='contrasting').length;$('kpiMentioning').textContent=all.filter(x=>x.stance==='mentioning'||x.stance==='unknown').length;$('evidenceResults').innerHTML=list.length?list.map(x=>paperCard(x.w,q,'evidence',x.i)).join(''):'<div class="empty-card">目前篩選條件下沒有結果。</div>';}
$('stanceFilter').addEventListener('change',renderEvidence);$('evidenceSort').addEventListener('change',renderEvidence);$('evidenceFilter').addEventListener('input',debounce(renderEvidence,100));
async function pdfTextFromFile(file){const b=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument({data:b}).promise;let t='';for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),tc=await p.getTextContent();t+=`\n[Page ${i}]\n`+tc.items.map(x=>x.str).join(' ');}return t;}
function targetAnchors(target){const titleTokens=queryTokens(target.title).filter(x=>x.length>=5).slice(0,12), surname=(target.authors||'').split(',')[0].trim().split(/\s+/).pop()||'',year=String(target.year||'');return{titleTokens,surname,year};}
function citationContexts(text,target){const a=targetAnchors(target),clean=text.replace(/\s+/g,' '),sentences=clean.split(/(?<=[.!?])\s+/),hits=[];for(let i=0;i<sentences.length;i++){const s=sentences[i],l=s.toLowerCase();let score=a.titleTokens.filter(t=>l.includes(t.toLowerCase())).length;if(a.surname&&l.includes(a.surname.toLowerCase()))score+=2;if(a.year&&l.includes(a.year))score+=1;if(score>=3){hits.push([sentences[i-1],s,sentences[i+1]].filter(Boolean).join(' '));if(hits.length>=10)break;}}return [...new Set(hits)];}
async function analyzeCitingPdf(index,file){const w=state.evidence.works[index];if(!w)return;toast('正在從 citing PDF 尋找引用上下文…');try{const text=await pdfTextFromFile(file),ctx=citationContexts(text,state.evidence.target);w.contexts=ctx;if(ctx.length){const cls=classifyStance(ctx.join(' '));w.stance=cls.stance;w.confidence=Math.max(.7,cls.confidence);toast(`找到 ${ctx.length} 個 citation contexts`);}else{toast('PDF 已解析，但沒有可靠綁定到目標論文的引用段落');}renderEvidence();}catch(e){toast(`PDF 解析失敗：${e.message}`);} }
$('exportJson').addEventListener('click',()=>{downloadText(`openscite-${safeFile(state.evidence.target?.title||'report')}.json`,JSON.stringify({target:state.evidence.target,works:state.evidence.works,exportedAt:new Date().toISOString()},null,2),'application/json')});
$('exportMd').addEventListener('click',()=>{const t=state.evidence.target;let md=`# OpenScite Citation Evidence Report\n\n## Target\n${t?`**${t.title}**\n\n${t.authors||''} · ${t.source||''} · ${t.year||''}\n\n`:''}`;for(const w of state.evidence.works){md+=`## ${w.stance.toUpperCase()} — ${w.title}\n\n- Year: ${w.year||''}\n- Venue: ${w.source||''}\n- Citations: ${w.citations||0}\n- Estimated quartile: ${w.q||'Q?'}\n- DOI: ${w.doi||''}\n\n${w.abstract||''}\n\n`;if(w.contexts?.length)md+=w.contexts.map(c=>`> ${c}`).join('\n\n')+'\n\n';}downloadText(`openscite-${safeFile(t?.title||'report')}.md`,md,'text/markdown')});

// ---------------- AI modal ----------------
$('settingsBtn').addEventListener('click',()=>{const s=aiSettings();$('aiKey').value=s.key;$('aiModel').value=s.model;$('aiEndpoint').value=s.endpoint;$('rememberAi').checked=s.remember;$('aiModal').classList.remove('hidden')}); $('closeModal').addEventListener('click',()=>$('aiModal').classList.add('hidden')); $('aiModal').addEventListener('click',e=>{if(e.target===$('aiModal'))$('aiModal').classList.add('hidden')});
$('saveAi').addEventListener('click',()=>{const key=$('aiKey').value.trim(),remember=$('rememberAi').checked;if(remember){localStorage.setItem(STORE.aiKey,key);sessionStorage.removeItem(STORE.aiKey)}else{sessionStorage.setItem(STORE.aiKey,key);localStorage.removeItem(STORE.aiKey)}localStorage.setItem(STORE.aiModel,$('aiModel').value.trim()||'gpt-5-mini');localStorage.setItem(STORE.aiEndpoint,$('aiEndpoint').value.trim()||'https://api.openai.com/v1/responses');$('aiModal').classList.add('hidden');toast('AI 設定已更新')}); $('clearAi').addEventListener('click',()=>{[localStorage,sessionStorage].forEach(s=>s.removeItem(STORE.aiKey));localStorage.removeItem(STORE.aiModel);localStorage.removeItem(STORE.aiEndpoint);$('aiKey').value='';toast('AI 設定已清除')});

function safeFile(s='file'){return s.replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,80)||'file'}
function downloadText(name,text,type='text/plain'){const blob=new Blob([text],{type:`${type};charset=utf-8`}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

// Detect scrolling page inside PDF viewport
$('pdfViewport').addEventListener('scroll',debounce(()=>{const pages=$$('.pdf-page',$('pdfPages'));if(!pages.length)return;const top=$('pdfViewport').getBoundingClientRect().top;let best={d:Infinity,n:1};for(const p of pages){const d=Math.abs(p.getBoundingClientRect().top-top-8);if(d<best.d)best={d,n:Number(p.dataset.page)}}state.reader.currentPage=best.n;$('pageJump').value=best.n;},90));

// Initial state
renderLibrary();
const params=new URLSearchParams(location.search); if(params.get('q')){$('searchQuery').value=params.get('q');runSearch(true)}
