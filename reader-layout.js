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
