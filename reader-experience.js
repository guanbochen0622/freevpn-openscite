'use strict';
/* Shared reader controls; the mobile sheet reuses the same assistant DOM and request state. */
(function(){
const tr=s=>window.I18n?.t(s)||s,mobile=()=>matchMedia('(max-width:900px)').matches;
const right=document.querySelector('.reader-right'),home=document.createComment('assistant-home');right.before(home);
insertTools('.reader-commandbar','<button id="knowledgeMapOpen" class="btn small">證據知識地圖</button><button id="mobileReading" class="btn small mobile-reader-control">全畫面閱讀</button><button id="mobileAsk" class="btn small mobile-reader-control">開啟研究助理</button>');
insertTools('body',`<dialog id="mobileAssistant" class="mobile-assistant-shell" aria-labelledby="mobileAssistantTitle"><div class="sheet-heading"><strong id="mobileAssistantTitle">研究助理</strong><button id="closeMobileAssistant" class="btn small">返回論文</button></div><div id="mobileAssistantBody"></div></dialog><dialog id="knowledgeMapDialog" aria-labelledby="knowledgeMapTitle"><div class="dialog-header"><h3 id="knowledgeMapTitle">證據知識地圖</h3><button id="closeKnowledgeMap" class="btn small">關閉</button></div><p>依本篇回答、筆記與高亮整理；連線表示來源位置，不代表科學結論已證實。</p><label for="knowledgeFilter">篩選地圖</label><input id="knowledgeFilter" class="control" type="search"><div id="knowledgeMapBody" data-i18n-skip></div></dialog>`);
insertTools('.reader-commandbar','<span class="mobile-reader-control mobile-page-nav"><button id="mobilePrevPage" class="btn small" aria-label="上一頁">←</button><input id="mobilePageJump" class="control tiny" inputmode="numeric" aria-label="頁碼" value="1"><span id="mobilePageCount">/ 0</span><button id="mobileNextPage" class="btn small" aria-label="下一頁">→</button></span>');
$('mobilePrevPage').onclick=()=>goPdfPage(state.reader.currentPage-1);$('mobileNextPage').onclick=()=>goPdfPage(state.reader.currentPage+1);$('mobilePageJump').onchange=e=>goPdfPage(Number(e.target.value));
function syncPage(){const n=state.reader.currentPage||1,total=state.reader.pages||0;$('mobilePageJump').value=n;$('mobilePageCount').textContent='/ '+total;$('mobilePrevPage').disabled=n<=1;$('mobileNextPage').disabled=n>=total;}
for(const event of ['research:current-page','research:document'])document.addEventListener(event,syncPage);syncPage();
$('readerProgress').insertAdjacentHTML('afterend','<button id="retryReaderIndex" class="btn small hidden">重試文件解析</button>');
document.addEventListener('research:document',()=>{$('retryReaderIndex').classList.toggle('hidden',!state.reader.indexErrors?.length);});
$('retryReaderIndex').onclick=async()=>{if(!state.reader.pdf||state.aiBusy)return;const token=state.reader.renderToken,button=$('retryReaderIndex');button.disabled=true;try{await DocumentUnderstanding.flush();if(token!==state.reader.renderToken)return;state.reader.indexReady=false;await renderPdfPages(token);await indexPdfText(token);if(token===state.reader.renderToken)document.dispatchEvent(new CustomEvent('research:document'));}catch(e){if(token===state.reader.renderToken)toast(String(e.message));}finally{button.disabled=false;}};
const sheet=$('mobileAssistant');let full=false,fitJob=0;
function viewportHeight(){document.documentElement.style.setProperty('--reading-height',(window.visualViewport?.height||innerHeight)+'px');}
async function fitMobile(){const n=++fitJob;if(!state.reader.pdf)return;const token=state.reader.renderToken,pageNo=state.reader.currentPage,pdf=state.reader.pdf;try{const page=await pdf.getPage(pageNo);if(n!==fitJob||token!==state.reader.renderToken)return;const width=Math.max(180,$('pdfViewport').clientWidth-20),scale=Math.min(2.5,width/page.getViewport({scale:1}).width);if(Math.abs(scale-state.reader.scale)>.01){state.reader.scale=scale;$('zoomLabel').textContent=Math.round(scale*100)+'%';await renderPdfPages();}}catch(e){console.warn('Fit reader',e);}}
function setFull(value){full=!!value&&mobile();document.body.classList.toggle('mobile-reading',full);$('mobileReading').textContent=tr(full?'結束全畫面':'全畫面閱讀');$('mobileReading').setAttribute('aria-pressed',String(full));viewportHeight();fitMobile();}
function closeSheet(){if(sheet.open)sheet.close();home.after(right);$('mobileAsk').setAttribute('aria-expanded','false');}
function openSheet(){if(!mobile()||state.currentView!=='reader')return;if(!sheet.open){$('mobileAssistantBody').append(right);sheet.showModal();$('mobileAsk').setAttribute('aria-expanded','true');}}
$('mobileReading').onclick=()=>{if(!state.reader.pdf){toast(tr('請先載入 PDF'));return;}setFull(!full);};
$('mobileAsk').onclick=openSheet;$('closeMobileAssistant').onclick=closeSheet;
sheet.addEventListener('cancel',e=>{e.preventDefault();closeSheet();});sheet.addEventListener('close',()=>{if(sheet.open)return;home.after(right);$('mobileAsk').setAttribute('aria-expanded','false');});
sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet();});
document.addEventListener('research:answer',()=>{if(mobile())openSheet();});
document.addEventListener('research:language',()=>{$('mobileReading').textContent=tr(full?'結束全畫面':'全畫面閱讀');});
document.addEventListener('research:document',()=>{closeSheet();if(full)fitMobile();if($('knowledgeMapDialog').open)renderMap();});
window.addEventListener('resize',debounce(()=>{viewportHeight();if(!mobile()){closeSheet();if(full)setFull(false);}else if(full)fitMobile();},150));window.visualViewport?.addEventListener('resize',viewportHeight);viewportHeight();
// Navigating away always restores the shared panel and exits the reading layout.
const previousShowView=showView;showView=function(name){if(name!=='reader'){closeSheet();full=false;document.body.classList.remove('mobile-reading');$('mobileReading').textContent=tr('全畫面閱讀');$('mobileReading').setAttribute('aria-pressed','false');}return previousShowView(name);};
const kindLabels={observation:'觀察',author_claim:'作者主張',inference:'推論',insufficient:'證據不足',answer:'回答',note:'筆記',highlight:'高亮'};
function buildMap(){return ReaderCore.knowledgeMap({key:readerKey(),pages:state.reader.pageTexts||[],turns:chatTurns,notes:state.reader.notes,highlights:state.reader.highlights});}
function renderMap(){
 const data=buildMap(),filter=$('knowledgeFilter').value.trim().toLowerCase(),body=$('knowledgeMapBody');body.replaceChildren();
 const matches=item=>!filter||(item.text+' '+(item.quote||'')).toLowerCase().includes(filter);
 const groups=data.groups.map(g=>({...g,items:g.items.filter(matches)})).filter(g=>g.items.length),unlinked=data.unlinked.filter(matches);
 const title=document.createElement('p');title.className='knowledge-root';title.textContent=state.reader.meta?.title||state.reader.fileName||tr('論文');body.append(title);
 if(!groups.length&&!unlinked.length){const empty=document.createElement('p');empty.textContent=tr('尚無符合的回答、筆記或高亮');body.append(empty);return;}
 // SVG shows only page-location edges that are present in the underlying records.
 if(groups.length){const shown=groups.slice(0,24),h=shown.length*48+24;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 600 ${h}`);svg.setAttribute('class','knowledge-overview');svg.setAttribute('role','img');svg.setAttribute('aria-label',tr('論文與頁碼來源關係'));svg.innerHTML=`<rect x="8" y="${h/2-18}" width="160" height="36" rx="8"/><text x="88" y="${h/2+5}" text-anchor="middle">${esc(tr('本篇論文'))}</text>`+shown.map((g,i)=>{const y=i*48+30;return `<path d="M168 ${h/2} C260 ${h/2},260 ${y},352 ${y}"/><g role="button" tabindex="0" data-map-page="${g.page}" aria-label="${esc(tr(`第 ${g.page} 頁`))}"><rect x="352" y="${y-18}" width="230" height="36" rx="8"/><text x="467" y="${y+5}" text-anchor="middle">${esc(tr(`第 ${g.page} 頁`))} · ${g.items.length}</text></g>`;}).join('');body.append(svg);}
 for(const g of [...groups,...(unlinked.length?[{page:null,items:unlinked}]:[])]){const section=document.createElement('section');section.className='knowledge-page';const head=document.createElement('h4');head.textContent=g.page?tr(`第 ${g.page} 頁`):tr('未連結原文');section.append(head);
 for(const item of g.items){const card=document.createElement('article');card.className='knowledge-card';const label=document.createElement('small');label.textContent=tr(kindLabels[item.type]||'回答')+' · '+tr(item.verified?'原文片段已匹配':'需核對原文');const text=document.createElement('p');text.textContent=item.text;card.append(label,text);if(item.quote){const quote=document.createElement('blockquote');quote.textContent=item.quote;card.append(quote);}if(g.page){const button=document.createElement('button');button.className='btn small';button.dataset.mapPage=String(g.page);button.textContent=tr('查看原頁');card.append(button);}section.append(card);}body.append(section);}
 if(data.omitted){const note=document.createElement('p');note.textContent=tr('地圖僅顯示前 120 筆；完整資料仍保留於筆記與對話。');body.append(note);}
}
$('knowledgeMapOpen').onclick=()=>{if(!state.reader.pdf){toast(tr('請先載入 PDF'));return;}renderMap();$('knowledgeMapDialog').showModal();};
$('closeKnowledgeMap').onclick=()=>$('knowledgeMapDialog').close();$('knowledgeFilter').oninput=renderMap;
$('knowledgeMapBody').onclick=e=>{const b=e.target.closest('[data-map-page]');if(b)previewReaderPage(Number(b.dataset.mapPage));};
$('knowledgeMapBody').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('g[data-map-page]')){e.preventDefault();previewReaderPage(Number(e.target.dataset.mapPage));}};
for(const event of ['research:evidence','research:index-updated','research:cache-ready'])document.addEventListener(event,()=>{if($('knowledgeMapDialog').open)renderMap();});
window.ReaderExperience={buildMap,openSheet,closeSheet,setFull,renderMap};
})();
