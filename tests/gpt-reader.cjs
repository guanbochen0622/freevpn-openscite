const assert=require('node:assert/strict');
module.exports=async page=>{
 assert.equal(await page.evaluate(()=>AIConnections.config().primary),'chatgpt');
 assert.equal(await page.locator('#mixedModels,#providerCards,#aiModal').count(),0);
 await page.evaluate(()=>{showView('reader');readerPrefs.width=500;applyReaderLayout();});
 await page.setViewportSize({width:1600,height:1000});
 const handle=page.locator('.assistant-resize');await handle.focus();const before=await page.evaluate(()=>readerPrefs.width);await page.keyboard.press('ArrowLeft');assert.ok(await page.evaluate(()=>readerPrefs.width)>before);
 await page.click('#userAccount');assert.match(await page.locator('#userAccountName').textContent(),/訪客/);assert.equal(await page.locator('#googleSignIn').isDisabled(),true);await page.click('#closeUserAccount');
 const result=await page.evaluate(()=>CitationSource.fromXml('<article><body><p>Results agree with previous findings <xref ref-type="bibr" rid="r1">1</xref>.</p></body><back><ref-list><ref id="r1"><element-citation><pub-id pub-id-type="doi">10.1234/target</pub-id></element-citation></ref></ref-list></back></article>',{doi:'10.1234/target'}));assert.equal(result.length,1);
 console.log('PASS GPT-only controls, accessible resizing, guest workspace and exact XML citation binding');
};
