// Developer smoke check: no account login or model requests.
const {app,ipcMain}=require('electron');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'openscite-window-'));app.setPath('userData',profile);
require('./main.cjs');
const timer=setTimeout(()=>{console.error('Desktop window smoke timed out');app.exit(1);},90000);
app.on('browser-window-created',(_e,win)=>{
 win.webContents.once('did-finish-load',async()=>{
 try{
 await new Promise(r=>setTimeout(r,2500));
 const result=await win.webContents.executeJavaScript(`(async()=>({button:document.getElementById('settingsBtn')?.textContent,bridge:typeof window.opensciteDesktop?.ask,status:await window.opensciteDesktop.status(),pdf:!!window.pdfjsLib}))()`);
 assert.equal(result.button,'ChatGPT 帳號');assert.equal(result.bridge,'function');assert.equal(result.pdf,true);assert.equal(result.status.account,null);
 await win.webContents.executeJavaScript(`document.getElementById('settingsBtn').click()`);
 assert.equal(await win.webContents.executeJavaScript(`!!document.querySelector('dialog[open]')`),true);
 await win.webContents.executeJavaScript(`document.querySelector('dialog[open]').close();showView('reader')`);
 const bytes=[...require('./fixture.cjs').fixturePdf()];
 await win.webContents.executeJavaScript(`loadPdfBuffer(new Uint8Array(${JSON.stringify(bytes)}).buffer,{},'geometry-fixture.pdf')`);
 for(const scale of [0.75,1.25,2]){
   const result=await win.webContents.executeJavaScript(`(async()=>{
     state.reader.scale=${scale};await renderPdfPages();
     const wrap=document.querySelector('.pdf-page[data-page="1"]');
     const span=[...wrap.querySelectorAll('.textLayer span')].find(s=>s.textContent==='Precise selection 980 nm');
     const page=await state.reader.pdf.getPage(1),tc=await page.getTextContent();
     const item=tc.items.find(i=>i.str==='Precise selection 980 nm');
     const r=span.getBoundingClientRect(),w=wrap.getBoundingClientRect();
     return {width:r.width,expected:item.width*${scale},left:r.left-w.left,expectedLeft:50*${scale},font:parseFloat(getComputedStyle(span).fontSize)};
   })()`);
   assert.ok(Math.abs(result.width-result.expected)<1.5,JSON.stringify(result));
   assert.ok(Math.abs(result.left-result.expectedLeft)<1.5,JSON.stringify(result));
   assert.ok(Math.abs(result.font-12*scale)<0.5,JSON.stringify(result));
 }
 let request;
 ipcMain.removeHandler('openscite:ask');
 ipcMain.handle('openscite:ask',(_event,body)=>{request=body;return 'TEST RESPONSE: wavelength is 980 nm [Page 1]';});
 await win.webContents.executeJavaScript(`(async()=>{
   const span=[...document.querySelectorAll('.textLayer span')].find(s=>s.textContent==='Precise selection 980 nm');
   const range=document.createRange();range.setStart(span.firstChild,18);range.setEnd(span.firstChild,21);
   const selection=getSelection();selection.removeAllRanges();selection.addRange(range);syncPdfSelection();
   if(state.reader.selectedText!=='980')throw Error('Selected text mismatch: '+state.reader.selectedText);
   await explainSelection();
 })()`);
 assert.ok(request.input[1].content[0].text.includes('SELECTED PASSAGE:\n980'));
 assert.match(await win.webContents.executeJavaScript(`document.getElementById('assistantOutput').textContent`),/TEST RESPONSE/);
 await win.webContents.executeJavaScript(`document.getElementById('askInput').value='What wavelength was measured?';document.getElementById('askBtn').click()`);
 await new Promise(r=>setTimeout(r,100));
 assert.ok(request.input[1].content[0].text.includes('What wavelength was measured?'));
 assert.match(await win.webContents.executeJavaScript(`document.getElementById('assistantOutput').textContent`),/TEST RESPONSE/);
 for(const [locale,label,name] of [['en','Academic search','English'],['zh-Hant','學術搜尋','Traditional Chinese'],['zh-Hans','学术搜索','Simplified Chinese'],['ja','論文検索','Japanese'],['ko','논문 검색','Korean']]){
   const text=await win.webContents.executeJavaScript(`I18n.setLanguage(${JSON.stringify(locale)});document.querySelector('.nav-tab[data-view="search"]').textContent`);
   assert.equal(text,label);
   await win.webContents.executeJavaScript(`explainSelection()`);
   assert.equal(request.language,locale);
   assert.ok(request.input[0].content[0].text.includes('Response language: '+name));
   assert.match(await win.webContents.executeJavaScript(`document.getElementById('assistantOutput').textContent`),/TEST RESPONSE/);
 }
 await win.webContents.executeJavaScript(`I18n.setLanguage('zh-Hant')`);
 // All reader AI actions must reach the bridge with document evidence.
 await win.webContents.executeJavaScript(`state.reader.selectedText='980 nm';translateSelection()`);
 assert.match(request.input[0].content[0].text,/Translate the selected/);
 await win.webContents.executeJavaScript(`researchFitSelection()`);
 assert.match(request.input[0].content[0].text,/research usefulness/);
 await win.webContents.executeJavaScript(`document.getElementById('aiSummaryBtn').click()`);
 await new Promise(r=>setTimeout(r,100));assert.match(request.input[0].content[0].text,/Summarize this research paper/);
 assert.match(request.input[1].content[0].text,/Page 1/);
 assert.match(await win.webContents.executeJavaScript(`document.getElementById('summaryOutput').textContent`),/TEST RESPONSE/);
 const beforePreview=await win.webContents.executeJavaScript(`state.reader.currentPage`);
 await win.webContents.executeJavaScript(`previewReaderPage(1)`);
 assert.equal(await win.webContents.executeJavaScript(`!!document.querySelector('#pagePreviewBody canvas')`),true);
 assert.equal(await win.webContents.executeJavaScript(`state.reader.currentPage`),beforePreview);
 await win.webContents.executeJavaScript(`closePagePreview();document.getElementById('askInput').value='Can you clarify your previous answer?';askPaperQuestion()`);
 assert.match(request.input[1].content[0].text,/What wavelength was measured/);
 assert.match(request.input[1].content[0].text,/PREVIOUS CONVERSATION/);
 assert.equal(await win.webContents.executeJavaScript(`chatTurns.length`),2);
 let figureCalls=[];
 ipcMain.removeHandler('openscite:ask');ipcMain.handle('openscite:ask',(_event,body)=>{figureCalls.push(body);return body.text?.format?'{"panels":[],"unreadable_or_ambiguous":["Synthetic test image"]}':'TEST FIGURE RESPONSE [Page 1]';});
 await win.webContents.executeJavaScript(`explainPdfFigure(1,{left:30,top:30,right:450,bottom:200,width:420,height:170,source:'test'})`);
 assert.equal(figureCalls.length,2);assert.ok(figureCalls[0].text.format.schema);
 for(const call of figureCalls)assert.equal(call.input[1].content.filter(p=>p.type==='input_image'&&p.image_url.startsWith('data:image/png;base64,')).length,2);
 assert.match(await win.webContents.executeJavaScript(`document.getElementById('assistantOutput').textContent`),/TEST FIGURE RESPONSE/);
 let failedCalls=0;
 ipcMain.removeHandler('openscite:ask');ipcMain.handle('openscite:ask',()=>{failedCalls++;throw Error('TEST: cancelled figure');});
 await win.webContents.executeJavaScript(`explainPdfFigure(1,{left:30,top:30,right:450,bottom:200,width:420,height:170,source:'test'})`);
 assert.equal(failedCalls,1);assert.match(await win.webContents.executeJavaScript(`document.getElementById('assistantOutput').textContent`),/cancelled figure/);
 await win.webContents.executeJavaScript(`state.reader.selectedText='980'`);
 ipcMain.removeHandler('openscite:ask');ipcMain.handle('openscite:ask',()=>{throw Error('TEST: model quota exhausted');});
 await win.webContents.executeJavaScript(`explainSelection()`);
 assert.match(await win.webContents.executeJavaScript(`document.getElementById('assistantOutput').textContent`),/model quota exhausted/);
 console.log('PASS desktop window, PDF geometry at 3 zoom levels, exact selection, explanation/Q&A IPC visible model errors five-language AI routing and two-stage figure requests without retry on failure');
 clearTimeout(timer);app.quit();
 }catch(e){console.error(e);clearTimeout(timer);app.exit(1);}
 });
});
