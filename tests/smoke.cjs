const {chromium}=require('playwright');
const {PDFDocument,StandardFonts}=require('pdf-lib');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const http=require('node:http'),path=require('node:path');
const siteBase=process.env.TEST_BASE||'';
const testUrl=(process.env.TEST_URL?process.env.TEST_URL+'?verify='+Date.now():'')||('http://127.0.0.1:8765'+siteBase+'/');
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(__dirname,'..','.'+new URL(req.url,'http://localhost').pathname.slice(siteBase.length).replace(/\/$/,'/index.html'));const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end('Not found')}});
(async()=>{
 await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=1;i<=16;i++){let p=pdf.addPage([595,842]);p.drawText(`Research document - Page ${i}`,{x:50,y:790,size:20,font});p.drawText(`Evanescent wave evidence on page ${i}. Fiber-to-silicon coupling.`,{x:50,y:740,size:12,font});p.drawText('The measured wavelength is 980 nm. Controls are required.',{x:50,y:715,size:12,font});p.drawText('Figure 1. Sensor response with baseline correction.',{x:50,y:380,size:12,font});p.drawRectangle({x:60,y:420,width:400,height:200,borderWidth:2});}
 await fs.writeFile('/tmp/openscite-fixture.pdf',await pdf.save());
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:["--no-sandbox"]}:{})});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>d.accept('Important measurement'));
 await page.route('https://api.openalex.org/**',async route=>{const u=new URL(route.request().url());if(u.pathname==='/works')return route.fulfill({json:{meta:{count:2},results:[{id:'https://openalex.org/W1',title:'Fiber-to-silicon coupling with evanescent waves',publication_year:2025,cited_by_count:42,doi:'https://doi.org/10.1234/test',authorships:[{author:{display_name:'A. Researcher'}}],abstract_inverted_index:{Evanescent:[0],wave:[1],coupling:[2],demonstrates:[3],improved:[4],efficiency:[5]},primary_location:{source:{display_name:'Optics Research'},landing_page_url:'https://doi.org/10.1234/test'},open_access:{is_oa:true}},{id:'https://openalex.org/W2',title:'Optical fiber sensor characterization',publication_year:2024,cited_by_count:10,primary_location:{source:{display_name:'Photonics Letters'}},abstract_inverted_index:{Sensor:[0],response:[1],is:[2],measured:[3]}}]}});return route.fulfill({json:{results:[]}});});
 await page.goto(testUrl);await page.waitForSelector('#documentToolsToggle',{state:'attached'});
 assert.deepEqual(await page.evaluate(()=>queryTokens('Fiber-to–Silicon')),['silicon','fiber','to']);
 await page.fill('#searchQuery','Fiber-to-silicon');await page.click('#searchBtn');await page.waitForSelector('[data-compare]');assert.equal(await page.locator('.paper-card').count(),2);
 await page.locator('[data-compare]').first().click();await page.locator('[data-compare]').last().click();await page.click('#compareOpen');assert.equal(await page.locator('.comparison-table th').count()>0,true);await page.click('#dialogClose');
 await page.locator('[data-action="library"]').first().click();await page.click('.nav-tab[data-view="library"]');await page.waitForSelector('.library-card');await page.fill('#libraryQuery','no match');await page.waitForTimeout(250);assert.equal(await page.locator('.library-card:visible').count(),0);await page.fill('#libraryQuery','fiber');await page.waitForTimeout(250);assert.equal(await page.locator('.library-card:visible').count(),1);
 await page.click('.nav-tab[data-view="search"]');await page.screenshot({path:'/tmp/openscite-search.png',fullPage:true});
 await page.click('.nav-tab[data-view="reader"]');await page.setInputFiles('#readerFile','/tmp/openscite-fixture.pdf');await page.waitForFunction(()=>state.reader.pageTexts.length===16&&document.querySelector('#readerProgress').textContent.includes('全文索引完成'),{timeout:30000});
 await page.waitForSelector('.textLayer span');assert.ok(await page.locator('.pdf-page canvas').count()<16);
 await page.fill('#pdfFind','980');await page.waitForTimeout(500);assert.match(await page.locator('#findCount').textContent(),/16/);await page.click('#findNext');assert.equal(await page.evaluate(()=>state.reader.currentPage),2);
 await page.fill('#pageJump','12');await page.dispatchEvent('#pageJump','change');await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="12"]').dataset.ready==='1');
 await page.click('#bookmarkPage');assert.equal(await page.locator('[data-page-link="12"]').count(),1);
 await page.click('#zoomIn');await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="12"]')?.dataset.ready==='1');assert.equal(await page.evaluate(()=>state.reader.pageTexts.length),16);
 await page.selectOption('#highlightColor','green');await page.evaluate(()=>{const span=[...document.querySelectorAll('.pdf-page[data-page="12"] .textLayer span')].find(s=>s.textContent.includes('The measured'));const range=document.createRange();range.setStart(span.firstChild,0);range.setEnd(span.firstChild,16);state.reader.selectionRange=range;state.reader.selectedText=range.toString();state.reader.selectionPage=12;addHighlight();});assert.ok(await page.locator('.saved-highlight.green').count()>0);assert.ok(await page.evaluate(()=>state.reader.highlights[0].rects.length>0));
 await page.click('#zoomOut');await page.waitForSelector('.saved-highlight.green');await page.click('#readerSaveLibrary');await page.waitForTimeout(400);const key=await page.evaluate(()=>readerKey());
 await page.screenshot({path:'/tmp/openscite-reader.png',fullPage:true});
 // Reopening identical bytes must reuse document identity and saved annotations.
 await page.setInputFiles('#readerFile','/tmp/openscite-fixture.pdf');await page.waitForFunction(()=>document.querySelector('#readerProgress').textContent.includes('全文索引完成')&&state.reader.highlights.length===1);assert.equal(await page.evaluate(()=>readerKey()),key);

 // Library reopening must preserve the hash-based annotation identity.
 await page.click('.nav-tab[data-view="library"]');await page.fill('#libraryQuery','');await page.waitForTimeout(200);const previousDocumentToken=await page.evaluate(()=>state.reader.renderToken);await page.locator('[data-lib-action="open"]').first().click();
 await page.waitForFunction(previous=>state.reader.renderToken>previous&&state.reader.pdf&&state.reader.indexReady&&state.reader.highlights.length===1,previousDocumentToken);assert.equal(await page.evaluate(()=>readerKey()),key);
 // An AI response is mocked; no real credentials or paid requests are used.
 await page.route('https://api.openai.com/v1/responses',async route=>{const payload=JSON.parse(route.request().postData());assert.equal(payload.store,false);assert.match(JSON.stringify(payload),/Page 12/);await route.fulfill({json:{output:[{content:[{type:'output_text',text:JSON.stringify({claims:[{text:'The wavelength is 980 nm.',kind:'observation',sources:[{id:'p12s1',quote:'The measured wavelength is 980 nm.'}]}]})}]}]}});});
 await page.evaluate(()=>sessionStorage.setItem(STORE.aiKey,'test-key-not-a-real-credential'));await page.fill('#askInput','What is the wavelength?');await page.click('#askBtn');await page.waitForFunction(()=>!state.aiBusy&&!state.reader.understandingBusy);assert.match(await page.locator('#assistantOutput').textContent(),/980 nm/);await page.waitForSelector('.page-citation');await page.locator('.page-citation').click();assert.equal(await page.evaluate(()=>state.reader.currentPage),12);

 // Reading detours return exactly to the original page; invalid references remain plain text.
 await page.evaluate(()=>goPdfPage(4));await page.locator('.page-citation').click();
 assert.equal(await page.evaluate(()=>state.reader.currentPage),12);
 await page.click('#readerBack');assert.equal(await page.evaluate(()=>state.reader.currentPage),4);
 await page.evaluate(()=>goPdfPage(12));
 await page.click('#saveReaderAnswer');assert.equal(await page.locator('#saveReaderAnswer').isDisabled(),true);
 assert.ok(await page.evaluate(()=>state.reader.notes.some(n=>n.note.includes('980 nm')&&n.page===12)));
 assert.equal(await page.locator('#conversationHistory').getAttribute('open'),null);
 await page.locator('[data-reader-prompt]').first().click();assert.match(await page.inputValue('#askInput'),/主要貢獻/);
 await page.evaluate(()=>{state.reader.selectedText='stale selection';state.reader.selectionPage=12;$('selectionBox').classList.remove('hidden');});
 await page.click('#clearReaderSelection');assert.equal(await page.evaluate(()=>state.reader.selectedText),'');
 assert.equal(await page.locator('#selectionBox').isVisible(),false);
 assert.equal(await page.evaluate(()=>answerMarkup('<img src=x onerror=alert(1)> [Page 0] [Page 999] **verified**').includes('<img')),false);
 assert.equal(await page.evaluate(()=>answerMarkup('[Page 0] [Page 999]').includes('data-page-link')),false);
 const readingWindowY=await page.evaluate(()=>window.scrollY);
 // Source metadata must belong to the request, even when selection changes while waiting.
 await page.evaluate(()=>{state.reader.selectedText='Original measurement';state.reader.selectionPage=12;setAssistant('Paper Q&A','處理中…');state.reader.selectedText='A different passage';state.reader.selectionPage=3;setAssistant('Paper Q&A','Source stays on [Page 12].');});
 assert.equal(await page.evaluate(()=>window.scrollY),readingWindowY);
 assert.equal(await page.evaluate(()=>currentReaderAnswer.page),12);
 assert.equal(await page.evaluate(()=>currentReaderAnswer.quote),'Original measurement');
 await page.evaluate(()=>hideSelectionUi(true));
 // Preview does not move the document; follow-up includes prior conversation.
 await page.locator('[data-preview-page]').click();await page.waitForSelector('#pagePreviewBody canvas');
 assert.equal(await page.evaluate(()=>state.reader.currentPage),12);await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>state.reader.currentPage),12);await page.click('#closePagePreview');
 let followupBody;await page.route('https://api.openai.com/v1/responses',async route=>{followupBody=JSON.parse(route.request().postData());await route.fulfill({json:{output_text:JSON.stringify({claims:[{text:'Follow-up verified.',kind:'observation',sources:[{id:'p12s1',quote:'The measured wavelength is 980 nm.'}]}]})}});});
 await page.fill('#askInput','Why that wavelength?');await page.click('#askBtn');await page.waitForFunction(()=>!state.aiBusy&&!state.reader.understandingBusy&&chatTurns.length===2);
 assert.match(JSON.stringify(followupBody),/What is the wavelength/);assert.match(JSON.stringify(followupBody),/980 nm/);
 assert.equal(await page.locator('.chat-turn').count(),2);assert.equal(await page.locator('#conversationHistory').getAttribute('open'),null);
 await page.click('#toggleReaderTools');assert.equal(await page.locator('.reader-left').isVisible(),false);await page.click('#toggleReaderTools');
 // Figure analysis renders reader prose, never its internal JSON.
 const figureRequests=[];const figureRoute=async route=>{const body=JSON.parse(route.request().postData());figureRequests.push(body);await route.fulfill({json:{output_text:JSON.stringify(body.text.format.name==='scientific_figure_extraction'?{panels:[],unreadable_or_ambiguous:['Synthetic figure']}:{meaning:'A control measurement.',context:'The nearby text describes the sensor [Page 12].',evidence:'The measured wavelength is 980 nm.',caveat:'Synthetic test only.'})}});};
 await page.route('https://api.openai.com/v1/responses',figureRoute);
 await page.evaluate(()=>explainPdfFigure(12,{left:50,top:350,right:600,bottom:750,width:550,height:400,source:'test'}));
 assert.equal(figureRequests.length,2);assert.match(await page.locator('#assistantOutput').textContent(),/nearby text/);assert.doesNotMatch(await page.locator('#assistantOutput').textContent(),/"meaning"|"panels"/);
 await page.screenshot({path:'/tmp/openscite-figure.png',fullPage:true});await page.unroute('https://api.openai.com/v1/responses',figureRoute);
 // Export contains persisted notes/metadata but no credentials, restore merges safely.
 await page.click('.nav-tab[data-view="library"]');const dlPromise=page.waitForEvent('download');await page.click('#backupWorkspace');const dl=await dlPromise;const backup=JSON.parse(await fs.readFile(await dl.path(),'utf8'));assert.equal(backup.includesPdfFiles,false);assert.equal(backup.data.openscite_chat_v1[key].length,2);assert.ok(!JSON.stringify(backup).includes('test-key-not-a-real-credential'));
 await fs.writeFile('/tmp/openscite-backup.json',JSON.stringify(backup));await page.setInputFiles('#backupFile','/tmp/openscite-backup.json');await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('已合併'));assert.equal(await page.evaluate(()=>state.library.length),2);
 // Invalid year ranges never send a search request.
 await page.click('.nav-tab[data-view="search"]');await page.fill('#yearFrom','2026');await page.fill('#yearTo','2020');await page.click('#searchBtn');assert.match(await page.locator('#toast').textContent(),/起始年/);await page.fill('#yearFrom','');await page.fill('#yearTo','');
 // Older results must never replace a newer query.
 await page.route('https://api.openalex.org/works?**',async route=>{const q=new URL(route.request().url()).searchParams.get('search');if(q==='slow')await new Promise(r=>setTimeout(r,150));await route.fulfill({json:{meta:{count:1},results:[{id:'https://openalex.org/W999',title:q,publication_year:2025}]}});});
 await page.evaluate(()=>{$('searchQuery').value='slow';runSearch(true);$('searchQuery').value='newest query';runSearch(true);});await page.waitForFunction(()=>state.search.works[0]?.title==='newest query');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>state.search.works[0].title),'newest query');
 // OA-only failures must not silently replace the filter with unverified Crossref data.
 await page.route('https://api.openalex.org/works?**',route=>route.fulfill({status:503,json:{error:'test outage'}}));await page.selectOption('#searchOA','oa');await page.waitForSelector('#searchResults .empty-card');await page.waitForFunction(()=>document.querySelector('#searchResults').textContent.includes('Crossref 無法可靠'));assert.equal(await page.locator('#nextPage').isDisabled(),true);
 let crossrefFilter='';await page.route('https://api.crossref.org/works?**',route=>{crossrefFilter=new URL(route.request().url()).searchParams.get('filter');return route.fulfill({json:{message:{'total-results':1,items:[{title:['Fallback result'],published:{'date-parts':[[2023]]},DOI:'10.1234/fallback'}]}}});});
 await page.fill('#yearFrom','2020');await page.fill('#yearTo','2025');await page.selectOption('#searchOA','all');await page.waitForFunction(()=>state.search.provider.includes('Crossref')&&state.search.works[0]?.title==='Fallback result');assert.equal(crossrefFilter,'from-pub-date:2020-01-01,until-pub-date:2025-12-31');assert.equal(await page.evaluate(()=>state.search.works[0].year),2023);
 // Exact citation binding, negation and ambiguity.
 assert.equal(await page.evaluate(()=>citationContexts('[Page 2] This agrees with prior results [7].\nReferences\n[7] Smith. Special optical fiber sensor study. doi:10.1234/test\n[8] Other unrelated paper.',{doi:'10.1234/test',title:'Special optical fiber sensor study'}).length),1);
 assert.equal(await page.evaluate(()=>classifyStance('This does not support the conclusion.').stance),'contrasting');
 assert.equal(await page.evaluate(()=>citationContexts('Smith 2020 observed a sensor.\nReferences\n[7] Unrelated paper',{title:'Special optical fiber sensor study',authors:'Smith',year:2020}).length),0);
 assert.equal(await page.evaluate(()=>safeUrl('javascript:alert(1)')),'');
 assert.equal(await page.evaluate(()=>{try{validateBackup({format:'openscite-workspace',version:1,data:{openscite_library_v24:[{}]}});return false}catch{return true}}),true);
 await page.setViewportSize({width:390,height:844});await page.click('.nav-tab[data-view="search"]');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:'/tmp/openscite-mobile.png',fullPage:true});
 await page.click('#themeToggle');assert.ok(await page.evaluate(()=>{const style=getComputedStyle(document.getElementById('languageSelect'));const lum=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(x=>{const v=Number(x)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};const a=lum(style.color),b=lum(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;}),'Language selector text contrast');await page.screenshot({path:'/tmp/openscite-light.png',fullPage:true});
 // Language changes preserve research data, typed input, behavior and persistence.
 await page.evaluate(()=>{const paper=document.createElement('div');paper.id='languagePaper';paper.className='paper-title';paper.textContent='搜尋論文';document.body.append(paper);$('assistantOutput').textContent='搜尋論文';$('askInput').value='Keep my question 980 nm';});
 for(const [locale,label] of [['en','Academic search'],['zh-Hant','學術搜尋'],['zh-Hans','学术搜索'],['ja','論文検索'],['ko','논문 검색']]){
   await page.selectOption('#languageSelect',locale);
   await page.waitForFunction(([locale,label])=>document.documentElement.lang===locale&&document.querySelector('.nav-tab[data-view="search"]').textContent===label,[locale,label]);
   assert.equal(await page.locator('#readerBack').textContent(),({'en':'Back to reading position','zh-Hant':'返回閱讀位置','zh-Hans':'返回阅读位置','ja':'元のページに戻る','ko':'읽던 위치로 돌아가기'})[locale]);
   assert.equal(await page.locator('[data-reader-prompt]').first().textContent(),({'en':'Key contribution','zh-Hant':'主要貢獻','zh-Hans':'主要贡献','ja':'主な貢献','ko':'주요 기여'})[locale]);
   assert.equal(await page.locator('#languagePaper').textContent(),'搜尋論文');
   assert.equal(await page.locator('#assistantOutput').textContent(),'搜尋論文');
   assert.equal(await page.locator('#askInput').inputValue(),'Keep my question 980 nm');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
 await page.selectOption('#languageSelect','en');await page.reload();await page.waitForSelector('#documentToolsToggle',{state:'attached'});
 assert.equal(await page.locator('#languageSelect').inputValue(),'en');
 assert.equal(await page.locator('.nav-tab[data-view="search"]').textContent(),'Academic search');
 await page.selectOption('#languageSelect','zh-Hant');await page.click('.nav-tab[data-view="reader"]');
 await page.setInputFiles('#readerFile',path.join(__dirname,'fixtures/scientific.pdf'));
 await page.waitForFunction(()=>state.reader.indexReady&&state.reader.pages===2&&state.reader.fullText.includes('Scientific notation'));
 const scientificText=await page.evaluate(()=>state.reader.fullText);
 assert.ok(scientificText.indexOf('LEFT column sentence 6')<scientificText.indexOf('RIGHT column sentence 1'),scientificText);
 for(const value of ['10⁻¹⁴','H₂O','Δλ','α','β','μ','µ','Ω','±','×','≤','≥','∞','−14','10–20'])assert.ok(scientificText.includes(value),'Missing '+value+': '+scientificText);
 for(const scale of [.8,1.25,1.8]){
  await page.evaluate(async scale=>{state.reader.scale=scale;await renderPdfPages();goPdfPage(2);await state.reader.paintPage(2);},scale);
  const selected=await page.evaluate(()=>{const layer=document.querySelector('.textLayer[data-page="2"]'),spans=[...layer.querySelectorAll('span[data-reader-line]')];const first=spans.find(s=>s.textContent.startsWith('Concentration:')),last=spans.find(s=>s.dataset.readerScript==='super');const range=document.createRange();range.setStart(first.firstChild,0);range.setEnd(last.firstChild,last.textContent.length);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);syncPdfSelection();return state.reader.selectedText;});
  assert.equal(selected,'Concentration: 10⁻¹⁴');
 }
 await page.screenshot({path:'/tmp/openscite-scientific.png',fullPage:true});
 // Real local OCR on an image-only PDF: no mocked recognition service.
 await page.setViewportSize({width:1440,height:1000});
 await page.setInputFiles('#readerFile',path.join(__dirname,'fixtures/scanned.pdf'));
 await page.waitForFunction(()=>state.reader.indexReady&&state.reader.pages===1&&state.reader.fileName==='scanned.pdf');
 assert.equal(await page.evaluate(()=>state.reader.pageTexts[0].trim()),'');
 await page.evaluate(()=>DocumentUnderstanding.runOcr());
 const ocr=await page.evaluate(()=>({text:state.reader.pageTexts[0],status:document.getElementById('documentStatus').textContent}));
 assert.match(ocr.text,/980\s*nm/i,JSON.stringify(ocr));
 assert.ok(await page.locator('.ocr-text-layer span').count()>5);
 await page.fill('#pdfFind','980');await page.waitForFunction(()=>document.getElementById('findCount').textContent.includes('2'));
 await page.fill('#ocrTranscript','Measured wavelength is 980 nm. Concentration is 10⁻¹⁴.');await page.click('#applyOcr');
 assert.match(await page.evaluate(()=>state.reader.fullText),/10⁻¹⁴/);
 const structure={formulas:[{latex:'10^{-14}',meaning:'A concentration exponent.',uncertainty:''}],tables:[{title:'Measured wavelengths',headers:['Sample','Wavelength (nm)'],rows:[['Control','980'],['Treatment','985']],uncertainty:''}],notes:'Synthetic model response; OCR above is real.'};
 await page.route('https://api.openai.com/v1/responses',async route=>{const payload=JSON.parse(route.request().postData());assert.equal(payload.text.format.name,'document_structure');assert.ok(payload.input[1].content.some(x=>x.type==='input_image'));await route.fulfill({json:{output_text:JSON.stringify(structure)}});});
 await page.evaluate(()=>DocumentUnderstanding.analyzeStructure());await page.waitForSelector('#structureResults .katex');assert.equal(await page.locator('#structureResults tbody tr').count(),2);
 assert.doesNotMatch(await page.locator('#structureResults').innerText(),/"latex"|"headers"/);
 const downloadPromise=page.waitForEvent('download');await page.click('[data-export-table]');const download=await downloadPromise;assert.match(download.suggestedFilename(),/table-page-1/);
 await page.route('https://api.openai.com/v1/responses',async route=>{await route.fulfill({json:{output_text:JSON.stringify({claims:[{text:'The wavelength is 980 nm.',kind:'observation',sources:[{id:'p1s1',quote:'Measured wavelength is 980 nm.'}]},{text:'Unverified claim.',kind:'inference',sources:[{id:'p999s1',quote:'Invented supporting quote'}]}]})}});});
 await page.fill('#askInput','What does the scan show?');await page.evaluate(()=>askPaperQuestion());
 await page.locator('.answer-evidence summary').click();assert.equal(await page.locator('[data-evidence-link]').count(),1);
 await page.click('[data-evidence-link]');assert.match(await page.locator('.evidence-quote').textContent(),/980 nm/);await page.click('#closePagePreview');
 await page.screenshot({path:'/tmp/openscite-understanding.png',fullPage:true});
 // Original text is recoverable and model JSON errors never become prose.
 await page.click('#restoreNativeText');assert.equal(await page.evaluate(()=>state.reader.pageTexts[0]),'');
 await page.route('https://api.openai.com/v1/responses',r=>r.fulfill({json:{output_text:'invalid structured data'}}));
 await page.evaluate(()=>DocumentUnderstanding.analyzeStructure());assert.match(await page.locator('#documentStatus').textContent(),/解析未完成/);
 await page.evaluate(async()=>{const pending=DocumentUnderstanding.runOcr();DocumentUnderstanding.cancel();await pending;});
 assert.equal(await page.locator('#ocrPage').isDisabled(),false);
 console.log('PASS real image-only OCR, searchable index, corrections, structured formulas/tables, CSV, exact evidence links, invalid citations and cancellation');

 assert.deepEqual(errors,[]);console.log('PASS: failure paths, request races, mocked AI page links, backup roundtrip, library reopen,  search, comparison, library filters, PDF text, bounded canvases, find, navigation, bookmarks, zoom, stable annotations, citation binding, backup validation, mobile layout.');await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
