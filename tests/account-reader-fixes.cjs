const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{PDFDocument,StandardFonts}=require('pdf-lib');
module.exports=async page=>{
 // The real result-card click must move to the reader and load the bytes.
 const bytes=await fs.readFile('/tmp/openscite-fixture.pdf');
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
 // All three choices exist, no duplicate OpenAI option. Manual handoff consumes returned evidence.
 await page.click('#settingsBtn');assert.deepEqual(await page.locator('#primaryProvider option').evaluateAll(x=>x.map(o=>o.value)),['chatgpt','gemini','claude']);await page.selectOption('#primaryProvider','gemini');await page.selectOption('[data-provider-mode="gemini"]','manual');await page.uncheck('#mixedModels');await page.click('#saveModelConfig');await page.click('#closeModelConnections');
 await page.evaluate(()=>{window.handoffTest=AIConnections.request({input:[{role:'user',content:[{type:'input_text',text:'User question'}]}],text:{format:{schema:{type:'object',required:['claims']}}}},new AbortController().signal);});
 await page.waitForSelector('#officialHandoff[open]');assert.equal(await page.locator('#openOfficial').getAttribute('href'),'https://gemini.google.com/app');await page.fill('#handoffAnswer','not json');await page.click('#acceptHandoff');assert.match(await page.locator('#handoffError').innerText(),/格式不完整/);await page.fill('#handoffAnswer','{"claims":[]}');await page.click('#acceptHandoff');assert.equal(await page.evaluate(()=>window.handoffTest),'{"claims":[]}');
 await page.evaluate(()=>{const c=new AbortController();window.cancelHandoffTest=AIConnections.request({input:[{role:'user',content:[{type:'input_text',text:'cancel'}]}]},c.signal).catch(e=>e.name);c.abort();});assert.equal(await page.evaluate(()=>window.cancelHandoffTest),'AbortError');assert.equal(await page.locator('#officialHandoff').count(),0);
 // Native login UI: exercise official completion/failure events without entering user credentials.
 await page.evaluate(()=>{window.loginEvents=[];window.opensciteDesktop={status:async()=>({account:null}),models:async()=>[],login:async({device})=>({url:'https://auth.openai.com/codex/device',userCode:device?'TEST-1234':'',opened:true}),cancelLogin:async()=>{},onLogin:cb=>window.testLoginNotification=cb,onProgress:()=>{},cancel:async()=>{},logout:async()=>{}};});
 await page.addScriptTag({path:require('node:path').resolve('desktop/ui.js')});await page.evaluate(()=>openChatGPTSettings());await page.click('#desktopDeviceLogin');assert.match(await page.locator('#desktopLoginHelp').innerText(),/TEST-1234/);await page.evaluate(()=>testLoginNotification({success:false,error:'Login denied test'}));assert.match(await page.locator('#desktopStatus').innerText(),/Login denied test/);await page.click('#desktopClose');
 console.log('PASS direct PDF result click, alternate source, HTML rejection, automatic full-text citation inference, no duplicate provider, manual account handoff/schema/cancellation, device login UI failure notification');
};
