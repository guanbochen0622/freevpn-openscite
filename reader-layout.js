'use strict';
(function(){
const tr=s=>window.I18n?.t(s)||s,bar=document.querySelector('.reader-commandbar');
const more=document.createElement('details');more.id='readerMoreTools';more.className='reader-more-tools';more.innerHTML='<summary class="btn small">更多工具</summary><div class="reader-more-menu"></div>';bar.append(more);
for(const el of [$('downloadPdf'),$('focusReader'),document.querySelector('.assistant-width-control'),$('documentToolsToggle')])if(el)more.lastElementChild.append(el);
const guide=document.createElement('div');guide.className='reader-guide';guide.innerHTML='<span>1 開啟論文</span><span>2 選取文字或提問</span><span>3 核對來源並存筆記</span>';$('view-reader').querySelector('.reader-grid').before(guide);
$('assistantOutput').closest('.reader-side-body').classList.add('readable-assistant');
const tabs={assistant:'提問',summary:'摘要',citations:'文獻資料',notes:'筆記'};for(const tab of document.querySelectorAll('[data-reader-tab]'))tab.textContent=tr(tabs[tab.dataset.readerTab]);
$('askBtn').textContent=tr('提問');document.querySelector('.assistant-intro span').textContent=tr('先選模型，再針對論文提問；點引用可核對原文。');
more.addEventListener('keydown',e=>{if(e.key==='Escape'){more.open=false;more.querySelector('summary').focus();}});
document.addEventListener('click',e=>{if(!more.contains(e.target))more.open=false;});
window.ReaderLayout={openMore:()=>{more.open=true;}};
})();

// Mouse and keyboard resizing share the saved width setting.
(function(){
 const panel=document.querySelector('.reader-right'),handle=document.createElement('button');handle.className='assistant-resize';handle.setAttribute('aria-label','拖曳調整閱讀助理寬度；左右方向鍵調整');handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');panel.prepend(handle);
 const set=width=>{const grid=document.querySelector('.reader-grid');const max=Math.max(360,Math.min(900,grid.clientWidth-(document.body.classList.contains('reader-tools-hidden')?350:565)));readerPrefs.width=Math.round(Math.max(360,Math.min(max,width)));applyReaderLayout();handle.setAttribute('aria-valuenow',readerPrefs.width);};
 handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const x=e.clientX,width=panel.getBoundingClientRect().width;handle.setPointerCapture(e.pointerId);const move=m=>set(width+x-m.clientX);const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);saveJSON('openscite_reader_layout',readerPrefs);};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);});
 handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();set(panel.clientWidth+(e.key==='ArrowLeft'?20:-20));saveJSON('openscite_reader_layout',readerPrefs);};
 if(readerPrefs.height)document.documentElement.style.setProperty('--assistant-height',Math.min(innerHeight-100,Math.max(360,readerPrefs.height))+'px');let height=panel.clientHeight;const observer=new ResizeObserver(()=>{if(innerWidth<=1250||Math.abs(panel.clientHeight-height)<2)return;height=panel.clientHeight;readerPrefs.height=height;saveJSON('openscite_reader_layout',readerPrefs);});observer.observe(panel);
 const label=document.createElement('label');label.className='assistant-font-control';label.textContent='閱讀字級 ';const input=document.createElement('input');input.type='range';input.min='16';input.max='24';input.value=readerPrefs.font||18;input.setAttribute('aria-label','閱讀助理字級');label.append(input);$('askInput').before(label);const font=()=>{document.documentElement.style.setProperty('--assistant-font',input.value+'px');};input.oninput=()=>{readerPrefs.font=Number(input.value);font();saveJSON('openscite_reader_layout',readerPrefs);};font();
})();
