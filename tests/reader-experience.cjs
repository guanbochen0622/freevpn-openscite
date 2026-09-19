const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async function testReaderExperience(page){
 const scan=path.join(__dirname,'fixtures/scanned.pdf'),scientific=path.join(__dirname,'fixtures/scientific.pdf');
 // A saved draft is durable without silently replacing the adopted searchable text.
 await page.fill('#ocrTranscript','Unsaved adoption: draft only 985 nm.');
 await page.evaluate(()=>DocumentUnderstanding.flush());
 const scanKey=await page.evaluate(()=>readerKey());
 await page.reload();await page.waitForSelector('#knowledgeMapOpen',{state:'attached'});
 await page.click('.nav-tab[data-view="reader"]');await page.setInputFiles('#readerFile',scan);
 await page.waitForFunction(()=>state.reader.indexReady&&state.reader.fileName==='scanned.pdf');await page.evaluate(()=>DocumentUnderstanding.ready());
 assert.equal(await page.evaluate(()=>readerKey()),scanKey);
 if(!await page.locator('#documentTools').isVisible())await page.click('#documentToolsToggle');
 assert.match(await page.locator('#readerProgress').textContent(),/全文索引完成/);
 assert.equal(await page.inputValue('#ocrTranscript'),'Unsaved adoption: draft only 985 nm.');
 assert.equal(await page.evaluate(()=>state.reader.pageTexts[0]),'Measured wavelength is 980 nm. Concentration is 10⁻¹⁴.');
 await page.waitForSelector('#structureResults .katex');
 assert.equal(await page.locator('#structureResults tbody tr').count(),2);
 assert.equal(await page.locator('[data-copy-formula]').count(),1);
 await page.evaluate(()=>{$('conversationHistory').open=true;document.querySelector('.chat-turn').open=true;});
 await page.click('[data-chat-restore="0"]');
 assert.equal(await page.locator('.page-citation').count(),1);
 assert.equal(await page.locator('[data-evidence-link]').count(),1);
 // Revalidation removes citations whose OCR source was subsequently corrected.
 await page.fill('#ocrTranscript','The revised scan gives wavelength 985 nm.');await page.click('#applyOcr');
 await page.click('[data-chat-restore="0"]');assert.equal(await page.locator('.page-citation').count(),0);assert.equal(await page.locator('[data-evidence-link]').count(),0);
 await page.click('#knowledgeMapOpen');assert.match(await page.locator('#knowledgeMapBody').innerText(),/未連結原文/);await page.click('#closeKnowledgeMap');
 await page.fill('#ocrTranscript','Measured wavelength is 980 nm. Concentration is 10⁻¹⁴.');await page.click('#applyOcr');
 await page.click('[data-chat-restore="0"]');
 await page.evaluate(()=>{state.reader.notes.push({paperKey:readerKey(),page:1,note:'Local measurement note',quote:'980 nm'});});
 await page.click('#knowledgeMapOpen');assert.match(await page.locator('#knowledgeMapBody').innerText(),/原文片段已匹配/);assert.match(await page.locator('#knowledgeMapBody').innerText(),/筆記 · 需核對原文/);
 await page.fill('#knowledgeFilter','Local measurement');assert.equal(await page.locator('.knowledge-card').count(),1);
 await page.locator('#knowledgeMapBody button[data-map-page]').first().click();await page.waitForSelector('#pagePreviewBody canvas');assert.equal(await page.evaluate(()=>state.reader.currentPage),1);await page.click('#closePagePreview');
 await page.fill('#knowledgeFilter','');await page.screenshot({path:'/tmp/openscite-knowledge-map.png'});await page.click('#closeKnowledgeMap');
 // Exercise actual mobile controls with the same assistant DOM, not a second copy.
 await page.setViewportSize({width:390,height:844});await page.click('#documentToolsToggle');await page.click('#mobileReading');
 await page.waitForFunction(()=>document.body.classList.contains('mobile-reading')&&parseFloat(document.querySelector('.pdf-page').style.width)<=document.querySelector('#pdfViewport').clientWidth);
 await page.waitForFunction(()=>document.querySelector('.pdf-page')?.dataset.ready==='1');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.screenshot({path:'/tmp/openscite-mobile-reading.png'});
 await page.click('#mobileAsk');await page.fill('#askInput','Keep this unsent question');
 assert.equal(await page.locator('#mobileAssistant .reader-right').count(),1);assert.equal(await page.locator('#askInput').count(),1);
 await page.screenshot({path:'/tmp/openscite-mobile-assistant.png'});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#mobileAssistant').evaluate(d=>d.open),false);
 // Closing/reopening in one turn queues an old close event; it must not steal the panel.
 await page.evaluate(()=>{ReaderExperience.openSheet();ReaderExperience.closeSheet();ReaderExperience.openSheet();});
 await page.waitForTimeout(100);assert.equal(await page.locator('#mobileAssistant .reader-right').count(),1);
 await page.click('#closeMobileAssistant');await page.click('#mobileAsk');assert.equal(await page.inputValue('#askInput'),'Keep this unsent question');
 await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>!document.querySelector('#mobileAssistant').open&&!document.body.classList.contains('mobile-reading'));
 assert.equal(await page.locator('#mobileAssistant .reader-right').count(),0);assert.equal(await page.inputValue('#askInput'),'Keep this unsent question');
 // Corrupt page text is recoverable without clearing annotations or cached results.
 await page.setInputFiles('#readerFile',scientific);await page.waitForFunction(()=>state.reader.indexReady&&state.reader.pages===2);await page.evaluate(()=>DocumentUnderstanding.ready());
 assert.equal(await page.locator('#structureResults .katex').count(),0);assert.equal(await page.evaluate(()=>chatTurns.length),0);
 await page.evaluate(async()=>{const p=await state.reader.pdf.getPage(2),original=p.getTextContent;p.getTextContent=async()=>{throw Error('Temporary extraction failure');};await indexPdfText(state.reader.renderToken);document.dispatchEvent(new CustomEvent('research:document'));await DocumentUnderstanding.ready();p.getTextContent=original;});
 assert.equal(await page.locator('#retryReaderIndex').isVisible(),true);assert.equal(await page.evaluate(()=>state.reader.indexErrors.length),1);
 await page.click('#retryReaderIndex');await page.waitForFunction(()=>state.reader.indexErrors.length===0&&!document.querySelector('#retryReaderIndex').disabled);await page.evaluate(()=>DocumentUnderstanding.ready());
 assert.equal(await page.locator('#retryReaderIndex').isVisible(),false);assert.match(await page.evaluate(()=>state.reader.pageTexts[1]),/10⁻¹⁴/);
 await page.setViewportSize({width:390,height:844});await page.click('#mobileReading');await page.waitForFunction(()=>document.querySelector('.pdf-page')?.dataset.ready==='1');
 await page.click('#mobileNextPage');assert.equal(await page.inputValue('#mobilePageJump'),'2');assert.equal(await page.locator('#mobileNextPage').isDisabled(),true);
 await page.click('#mobilePrevPage');assert.equal(await page.inputValue('#mobilePageJump'),'1');
 await page.evaluate(()=>showView('library'));assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('mobile-reading')),false);
 await page.setViewportSize({width:1440,height:1000});await page.click('.nav-tab[data-view="reader"]');await page.setInputFiles('#readerFile',scan);
 await page.waitForFunction(()=>state.reader.indexReady&&state.reader.fileName==='scanned.pdf');await page.evaluate(()=>DocumentUnderstanding.ready());
 if(!await page.locator('#documentTools').isVisible())await page.click('#documentToolsToggle');await page.waitForSelector('#structureResults .katex');
 console.log('PASS mobile reading/navigation/sheet lifecycle, evidence map/filter/preview, persisted OCR drafts and structures, revalidated history, document isolation and failed-index recovery');
};
