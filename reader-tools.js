'use strict';
// Reading interactions are local; model requests still use the existing account bridge.
const CHAT_STORE='openscite_chat_v1';
const readerText=s=>window.I18n?.t(s)||s;
let chatDocument='',chatTurns=[];
function resetReaderConversation(){
  chatDocument=readerKey();const all=loadJSON(CHAT_STORE,{});
  chatTurns=Array.isArray(all[chatDocument])?all[chatDocument].filter(x=>typeof x.question==='string'&&typeof x.answer==='string').slice(-20):[];
  $('assistantOutput').innerHTML='';$('summaryOutput').innerHTML='';$('askInput').value='';renderReaderHistory();
}
function renderReaderHistory(){
  $('readerHistory').innerHTML=chatTurns.map((x,i)=>`<details class="chat-turn"><summary data-i18n-skip>${esc(x.question)}</summary><div class="chat-answer" data-i18n-skip>${esc(x.answer).replace(/\n/g,'<br>')}</div><button class="btn small" data-chat-restore="${i}">${esc(readerText('查看回答'))}</button></details>`).join('');
  $('clearReaderChat').disabled=!chatTurns.length;
}
async function askPaperQuestion(){
  if(state.aiBusy||state.reader.figureBusy)return;
  const question=$('askInput').value.trim();if(!question){toast('請先輸入問題');return;}
  if(!state.reader.pdf){toast('請先載入 PDF');return;}
  if(chatDocument!==readerKey())resetReaderConversation();
  const key=readerKey(),selected=state.reader.selectedText||'';
  try{
    const evidence=relevantContext(question+' '+selected+' '+(chatTurns.at(-1)?.question||''));
    const previous=chatTurns.slice(-4).map(t=>({question:t.question.slice(0,3000),answer:t.answer.slice(0,5000)}));
    setAssistant('Paper Q&A','處理中…');
    const answer=await askAI('Answer questions about an academic paper using only supplied paper evidence. Respond in Traditional Chinese. Use the conversation only to understand follow-up questions, never as verified evidence. Cite [Page N] markers for claims. Distinguish observations, author claims and inference. Say when evidence is insufficient. Start with the direct answer in one sentence, then at most three short evidence points. Use no more than 220 words unless the user explicitly requests detail. Avoid repeating the question or adding generic introductions.',`PAPER EVIDENCE:\n${evidence}\n\nPREVIOUS CONVERSATION (unverified):\n${JSON.stringify(previous)}\n\nSELECTED PASSAGE:\n${selected}\n\nQUESTION:\n${question}`);
    if(readerKey()!==key)return;
    chatTurns.push({question,answer});chatTurns=chatTurns.slice(-20);
    const all=loadJSON(CHAT_STORE,{});all[key]=chatTurns;saveJSON(CHAT_STORE,all);
    renderReaderHistory();setAssistant('Paper Q&A',answer);$('askInput').value='';
  }catch(e){if(readerKey()===key)setAssistant('問答未完成',aiErrorMessage(e));}
}
$('assistantOutput').insertAdjacentHTML('afterend','<details id="conversationHistory"><summary>本篇對話</summary><div class="chat-history-head"><button id="clearReaderChat" class="btn small">清除對話</button></div><div id="readerHistory"></div></details>');
$('clearReaderChat').onclick=()=>{if(state.aiBusy)return;if(!confirm(readerText('清除這篇論文的對話？')))return;const all=loadJSON(CHAT_STORE,{});delete all[readerKey()];saveJSON(CHAT_STORE,all);chatTurns=[];renderReaderHistory();$('assistantOutput').innerHTML='';};
$('readerHistory').onclick=e=>{const b=e.target.closest('[data-chat-restore]');if(b){const turn=chatTurns[Number(b.dataset.chatRestore)];if(turn)setAssistant('Paper Q&A',turn.answer);}};
$('askInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();askPaperQuestion();}});
document.addEventListener('research:document',resetReaderConversation);
document.addEventListener('research:language',renderReaderHistory);
renderReaderHistory();

// Preserve the selected original alongside its translation without rewriting it.
const readingSetAssistant=setAssistant;
let currentReaderAnswer=null,pendingReaderSource=null;
function answerMarkup(text){
  // Escape everything first. Only a small, non-executable formatting subset is supported.
  const inline=s=>esc(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\[Page (\d+)\]/g,(m,n)=>Number(n)>=1&&Number(n)<=state.reader.pages?`<button class="page-citation" data-page-link="${Number(n)}">${esc(readerText(`第 ${Number(n)} 頁`))} ↗</button>`:m);
  return String(text).split(/\n\s*\n/).map(part=>`<p>${part.split('\n').map(line=>/^#{1,4}\s/.test(line)?`<strong>${inline(line.replace(/^#{1,4}\s+/,''))}</strong>`:inline(line)).join('<br>')}</p>`).join('');
}
setAssistant=function(title,body){
  if(document.body.classList.contains('reader-focus')){document.body.classList.remove('reader-focus');$('focusReader').textContent=readerText('專注閱讀');}
  readingSetAssistant(title,body);
  const pending=body==='處理中…'||/^Stage [12]\/2/.test(body);
  const failed=/未完成|失敗/.test(title)||/^圖片分析失敗/.test(body);
  if(pending)pendingReaderSource={key:readerKey(),page:state.reader.selectionPage||state.reader.currentPage,quote:state.reader.selectedText||''};
  currentReaderAnswer=null;
  if(!pending){
    $('assistantOutput').lastElementChild.innerHTML=answerMarkup(body);
    for(const button of $$('.page-citation',$('assistantOutput'))){const preview=document.createElement('button');preview.className='btn small page-preview';preview.dataset.previewPage=button.dataset.pageLink;preview.textContent=readerText('預覽');button.after(preview);}
  }
  if(!pending&&!failed&&state.reader.pdf){
    const figure=/圖片|Image Explanation/.test(title)?state.reader.activeFigure:null;
    const source=pendingReaderSource?.key===readerKey()?pendingReaderSource:{page:state.reader.selectionPage||state.reader.currentPage,quote:state.reader.selectedText||''};
    currentReaderAnswer={title,body:String(body),key:readerKey(),page:figure?.pageNo||source.page,quote:figure?.caption||source.quote};
    $('assistantOutput').insertAdjacentHTML('beforeend',`<div class="answer-actions"><button id="copyReaderAnswer" class="btn small">${esc(readerText('複製回答'))}</button><button id="saveReaderAnswer" class="btn small">${esc(readerText('存成筆記'))}</button></div>`);
  }
  if(!pending)pendingReaderSource=null;
  $('assistantOutput').setAttribute('aria-busy',String(pending));
  if(!pending){
    const panel=document.querySelector('.reader-right'),output=$('assistantOutput');
    if(innerWidth>=1200)panel.scrollTop+=output.getBoundingClientRect().top-panel.getBoundingClientRect().top-16;
    else output.scrollIntoView({block:'nearest',behavior:'instant'});
  }
};
function setTranslationResult(original,answer){setAssistant('Translation（翻譯）',answer);const block=document.createElement('blockquote');block.className='translation-original';block.dataset.i18nSkip='';block.textContent=original;$('assistantOutput').prepend(block);}

// A separate preview canvas leaves the reading position unchanged.
insertTools('body','<dialog id="pagePreviewDialog"><div class="dialog-header"><strong id="pagePreviewTitle"></strong><button id="closePagePreview" class="icon-btn" aria-label="關閉">×</button></div><div id="pagePreviewBody"></div><button id="jumpPreviewPage" class="btn primary">前往此頁</button></dialog>');
let previewTask=null,previewEpoch=0,previewPage=1;
function closePagePreview(){previewEpoch++;previewTask?.cancel();previewTask=null;$('pagePreviewDialog').close();}
async function previewReaderPage(number){
  const pdf=state.reader.pdf;if(!pdf||number<1||number>pdf.numPages)return;
  previewTask?.cancel();const epoch=++previewEpoch;previewPage=number;
  $('pagePreviewTitle').textContent=readerText(`第 ${number} 頁`);$('pagePreviewBody').textContent=readerText('處理中…');
  if(!$('pagePreviewDialog').open)$('pagePreviewDialog').showModal();
  try{const page=await pdf.getPage(number);if(epoch!==previewEpoch)return;const base=page.getViewport({scale:1}),scale=Math.min(1.5,Math.max(240,innerWidth-72)/base.width,720/base.width),viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',readerText(`第 ${number} 頁`));$('pagePreviewBody').replaceChildren(canvas);previewTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await previewTask.promise;if(epoch===previewEpoch)previewTask=null;}catch(e){if(epoch===previewEpoch&&e.name!=='RenderingCancelledException')$('pagePreviewBody').textContent=String(e.message);}
}
$('closePagePreview').onclick=closePagePreview;
$('pagePreviewDialog').addEventListener('cancel',e=>{e.preventDefault();closePagePreview();});
$('pagePreviewDialog').addEventListener('click',e=>{if(e.target===$('pagePreviewDialog'))closePagePreview();});
$('jumpPreviewPage').onclick=()=>{const page=previewPage;closePagePreview();goPdfPage(page);};
$('assistantOutput').addEventListener('click',e=>{const b=e.target.closest('[data-preview-page]');if(b)previewReaderPage(Number(b.dataset.previewPage));});
document.addEventListener('research:document',closePagePreview);

// Keep tools optional and make the response column adjustable on a desktop.
insertTools('.reader-commandbar','<button id="toggleReaderTools" class="btn small" aria-pressed="false">收合文件工具</button><label class="assistant-width-control"><span>助理寬度</span><input id="assistantWidth" type="range" min="280" max="520" step="20" aria-label="助理寬度"></label>');
const readerPrefs=loadJSON('openscite_reader_layout',{});
function applyReaderLayout(){document.body.classList.toggle('reader-tools-hidden',!!readerPrefs.hideTools);document.documentElement.style.setProperty('--assistant-width',Math.max(280,Math.min(520,Number(readerPrefs.width)||360))+'px');$('assistantWidth').value=Number(readerPrefs.width)||360;$('toggleReaderTools').setAttribute('aria-pressed',String(!!readerPrefs.hideTools));$('toggleReaderTools').textContent=readerText(readerPrefs.hideTools?'展開文件工具':'收合文件工具');}
$('toggleReaderTools').onclick=()=>{readerPrefs.hideTools=!readerPrefs.hideTools;saveJSON('openscite_reader_layout',readerPrefs);applyReaderLayout();};
$('assistantWidth').oninput=e=>{readerPrefs.width=Number(e.target.value);saveJSON('openscite_reader_layout',readerPrefs);applyReaderLayout();};
document.addEventListener('research:language',applyReaderLayout);applyReaderLayout();


// Explicit context removal prevents an old selection leaking into a later question.
$('selectionBox').insertAdjacentHTML('afterbegin','<button id="clearReaderSelection" class="btn small clear-selection">清除選取</button>');
$('clearReaderSelection').onclick=()=>{hideSelectionUi(true);window.getSelection()?.removeAllRanges();};
$('assistantOutput').addEventListener('click',async e=>{
  const answer=currentReaderAnswer;if(!answer||answer.key!==readerKey())return;
  if(e.target.closest('#copyReaderAnswer')){
    try{await navigator.clipboard.writeText(answer.body);toast('回答已複製');}catch{toast('無法複製，請選取回答文字');}
  }
  const save=e.target.closest('#saveReaderAnswer');if(save){
    const all=loadJSON(STORE.notes,[]);all.push({id:crypto.randomUUID(),paperKey:answer.key,page:answer.page,quote:answer.quote||answer.title,note:answer.body,created:new Date().toISOString()});
    if(!saveJSON(STORE.notes,all))return;state.reader.notes=all.filter(n=>n.paperKey===answer.key);renderNotes();save.disabled=true;save.textContent=readerText('已儲存');toast('筆記已儲存');
  }
});
document.addEventListener('research:document',()=>{currentReaderAnswer=null;pendingReaderSource=null;hideSelectionUi(true);$('conversationHistory').open=false;});

// A reading trail makes evidence detours reversible without moving browser history.
insertTools('.reader-commandbar','<button id="readerBack" class="btn small" disabled>返回閱讀位置</button>');
let readingTrail=[];
const readerGoPage=goPdfPage;
goPdfPage=function(n){const next=Math.max(1,Math.min(state.reader.pages||1,Number(n)||1));if(state.reader.pdf&&next!==state.reader.currentPage){readingTrail.push(state.reader.currentPage);readingTrail=readingTrail.slice(-30);$('readerBack').disabled=false;}readerGoPage(next);};
$('readerBack').onclick=()=>{const page=readingTrail.pop();if(page)readerGoPage(page);$('readerBack').disabled=!readingTrail.length;};
document.addEventListener('research:document',()=>{readingTrail=[];$('readerBack').disabled=true;});

insertTools('.ask-row','<div class="reader-prompts"><button class="btn small" data-reader-prompt="這篇論文的主要貢獻是什麼？">主要貢獻</button><button class="btn small" data-reader-prompt="這篇論文有哪些限制與未驗證的假設？">限制與假設</button><button class="btn small" data-reader-prompt="請用白話解釋目前選取的內容，並說明它與論文的關係。">白話解釋</button></div>');
document.querySelector('.reader-prompts').addEventListener('click',e=>{const b=e.target.closest('[data-reader-prompt]');if(!b||state.aiBusy)return;$('askInput').value=readerText(b.dataset.readerPrompt);$('askInput').focus();});

document.addEventListener('research:language',()=>{if($('copyReaderAnswer'))$('copyReaderAnswer').textContent=readerText('複製回答');if($('saveReaderAnswer'))$('saveReaderAnswer').textContent=readerText($('saveReaderAnswer').disabled?'已儲存':'存成筆記');});
