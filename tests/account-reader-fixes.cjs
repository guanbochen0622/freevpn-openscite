const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{PDFDocument,StandardFonts}=require('pdf-lib');
module.exports=async page=>{
 // The real result-card click must move to the reader and load the bytes.
 const bytes=await fs.readFile('/tmp/paperlume-fixture.pdf');
 await page.route('https://papers.example/**',r=>r.fulfill({contentType:'application/pdf',body:bytes}));
 await page.evaluate(()=>{state.search.works=[{title:'Direct PDF',pdfUrl:'https://papers.example/direct.pdf',raw:{}}];$('searchResults').innerHTML=paperCard(state.search.works[0],'','search',0);showView('search');});
 await page.click('[data-action="read"]');await page.waitForFunction(()=>state.reader.meta.title==='Direct PDF'&&state.reader.indexReady);assert.equal(await page.locator('#pdfViewport').isVisible(),true);
 await page.route('https://papers.example/bad.pdf',r=>r.fulfill({contentType:'text/html',body:'<html>Login required</html>'}));
 await page.evaluate(()=>openPdfUrl('https://papers.example/bad.pdf',{title:'Fallback',raw:{locations:[{pdf_url:'https://papers.example/good.pdf'}]}}));assert.equal(await page.evaluate(()=>state.reader.meta.title),'Fallback');
 await page.evaluate(()=>openPdfUrl('https://papers.example/bad.pdf',{title:'Broken'}));assert.equal(await page.evaluate(()=>state.reader.meta.title),'Fallback');assert.match(await page.locator('#assistantOutput').innerText(),/並非 PDF/);
 // Automatic evidence fetch uses an actual PDF with a numbered reference, not supplied contexts.
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),p=pdf.addPage([595,842]);
 ['Our response is consistent with the earlier observation [7].','References','[7] Smith. A special experimental fiber sensor study. 10.1234/target'].forEach((line,i)=>p.drawText(line,{x:30,y:750-i*35,size:11,font}));
 await page.route('https://papers.example/citing.pdf',r=>r.fulfill({contentType:'application/pdf',body:Buffer.from([])}));const citingBytes=Buffer.from(await pdf.save());
 await page.route('https://papers.example/citing.pdf',r=>r.fulfill({contentType:'application/pdf',body:citingBytes}));
 await page.route('https://api.openalex.org/works?**',r=>r.fulfill({json:{results:[{id:'https://openalex.org/W33',title:'Citing paper',best_oa_location:{pdf_url:'https://papers.example/citing.pdf'},publication_year:2025}]}}));
 await page.evaluate(async()=>{state.evidence.target={id:'W7',doi:'10.1234/target',title:'A special experimental fiber sensor study'};await runCitationAnalysis();});
 assert.equal(await page.evaluate(()=>state.evidence.works[0].stance),'supporting');assert.match(await page.locator('#evidenceResults').innerText(),/已定位/);assert.match(await page.locator('#evidenceResults').innerText(),/推論：支持/);
 // AI inference cannot promote fabricated quotes to supporting evidence.
 await page.route('https://api.openai.com/v1/responses',r=>r.fulfill({json:{output_text:JSON.stringify({stance:'supporting',reason:'An uncertain relation.',quote:'This quote was never in the paper.'})}}));
 await page.evaluate(()=>inferCitation(state.evidence.works[0],state.evidence.target));assert.equal(await page.evaluate(()=>state.evidence.works[0].stance),'unknown');assert.match(await page.locator('#evidenceResults').innerText(),/未能匹配/);
 assert.equal(await page.evaluate(()=>AIConnections.config().primary),'chatgpt');
 // Native login UI: exercise official completion/failure events without entering user credentials.
 await page.evaluate(()=>{window.loginEvents=[];window.paperlumeDesktop={status:async()=>({account:null}),models:async()=>[],login:async({device})=>({url:'https://auth.openai.com/codex/device',userCode:device?'TEST-1234':'',opened:true}),cancelLogin:async()=>{},onLogin:cb=>window.testLoginNotification=cb,onProgress:()=>{},cancel:async()=>{},logout:async()=>{}};});
 await page.addScriptTag({path:require('node:path').resolve('desktop/ui.js')});await page.evaluate(()=>openChatGPTSettings());await page.click('#desktopDeviceLogin');assert.match(await page.locator('#desktopLoginHelp').innerText(),/TEST-1234/);await page.evaluate(()=>testLoginNotification({success:false,error:'Login denied test'}));assert.match(await page.locator('#desktopStatus').innerText(),/Login denied test/);await page.click('#desktopClose');
 console.log('PASS direct PDF result click, alternate source, HTML rejection, automatic full-text citation inference, GPT-only account mode, device login UI failure notification');
};
