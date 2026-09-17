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
  if(state.aiBusy)return;
  const question=$('askInput').value.trim();if(!question){toast('請先輸入問題');return;}
  if(!state.reader.pdf){toast('請先載入 PDF');return;}
  if(chatDocument!==readerKey())resetReaderConversation();
  const key=readerKey(),selected=state.reader.selectedText||'';
  try{
    const evidence=relevantContext(question+' '+selected+' '+(chatTurns.at(-1)?.question||''));
    const previous=chatTurns.slice(-4).map(t=>({question:t.question.slice(0,3000),answer:t.answer.slice(0,5000)}));
    setAssistant('Paper Q&A','處理中…');
    const answer=await askAI('Answer questions about an academic paper using only supplied paper evidence. Respond in Traditional Chinese. Use the conversation only to understand follow-up questions, never as verified evidence. Cite [Page N] markers for claims. Distinguish observations, author claims and inference. Say when evidence is insufficient.',`PAPER EVIDENCE:\n${evidence}\n\nPREVIOUS CONVERSATION (unverified):\n${JSON.stringify(previous)}\n\nSELECTED PASSAGE:\n${selected}\n\nQUESTION:\n${question}`);
    if(readerKey()!==key)return;
    chatTurns.push({question,answer});chatTurns=chatTurns.slice(-20);
    const all=loadJSON(CHAT_STORE,{});all[key]=chatTurns;saveJSON(CHAT_STORE,all);
    renderReaderHistory();setAssistant('Paper Q&A',answer);$('askInput').value='';
  }catch(e){if(readerKey()===key)setAssistant('問答未完成',aiErrorMessage(e));}
}
$('assistantOutput').insertAdjacentHTML('beforebegin','<div class="chat-history-head"><span>本篇對話</span><button id="clearReaderChat" class="btn small">清除對話</button></div><div id="readerHistory"></div>');
$('clearReaderChat').onclick=()=>{if(state.aiBusy)return;if(!confirm(readerText('清除這篇論文的對話？')))return;const all=loadJSON(CHAT_STORE,{});delete all[readerKey()];saveJSON(CHAT_STORE,all);chatTurns=[];renderReaderHistory();$('assistantOutput').innerHTML='';};
$('readerHistory').onclick=e=>{const b=e.target.closest('[data-chat-restore]');if(b){const turn=chatTurns[Number(b.dataset.chatRestore)];if(turn)setAssistant('Paper Q&A',turn.answer);}};
$('askInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();askPaperQuestion();}});
document.addEventListener('research:document',resetReaderConversation);
document.addEventListener('research:language',renderReaderHistory);
renderReaderHistory();

// Preserve the selected original alongside its translation without rewriting it.
const readingSetAssistant=setAssistant;
setAssistant=function(title,body){readingSetAssistant(title,body);if(title==='Translation（翻譯）'&&body!=='處理中…'&&state.reader.selectedText){const block=document.createElement('blockquote');block.className='translation-original';block.dataset.i18nSkip='';block.textContent=state.reader.selectedText;$('assistantOutput').prepend(block);}for(const button of $$('.page-citation',$('assistantOutput'))){const preview=document.createElement('button');preview.className='btn small page-preview';preview.dataset.previewPage=button.dataset.pageLink;preview.textContent=readerText('預覽');button.after(preview);}};

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
