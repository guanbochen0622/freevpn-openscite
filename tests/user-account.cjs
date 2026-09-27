const assert=require('node:assert/strict');
module.exports=async original=>{
 const context=await original.context().browser().newContext({storageState:await original.context().storageState()});const page=await context.newPage();let uploaded='';
 await page.route('**/account-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.PaperLumeAccountConfig={googleClientId:"fixture.apps.googleusercontent.com"};'}));
 await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:"fixture-token",expires_in:3600})})}}};'}));
 await page.route('https://www.googleapis.com/**',r=>{const url=r.request().url();assert.equal(r.request().headers().authorization,'Bearer fixture-token');if(url.includes('/userinfo'))return r.fulfill({json:{sub:'fixture-subject',name:'Test account'}});if(url.includes('/upload/')){uploaded=r.request().postData();return r.fulfill({json:{id:'backup'}});}return r.fulfill({json:{files:[]}});});
 await page.goto(original.url());await page.waitForFunction(()=>!!window.UserAccount);const guest=await page.evaluate(()=>localStorage.getItem(STORE.library));
 await page.click('#userAccount');await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.click('#googleSignIn')]);await page.waitForFunction(()=>window.UserAccount?.current().id==='google:fixture-subject');
 assert.equal(await page.evaluate(()=>state.library.length),0);assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>localStorage.getItem(k)?.includes('fixture-token'))),false);
 await page.click('#userAccount');await page.click('#cloudSave');await page.waitForFunction(()=>document.querySelector('#accountStatus').textContent.includes('已備份'));assert.match(uploaded,/openscite-account/);assert.doesNotMatch(uploaded,/desktopModel|ai_key|fixture-token/);
 await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.click('#guestSignIn')]);await page.waitForFunction(()=>window.UserAccount?.current().id==='guest');assert.equal(await page.evaluate(()=>localStorage.getItem(STORE.library)),guest);
 await context.close();console.log('PASS mocked Google OAuth identity, isolated accounts, token-free storage, cloud upload and guest restoration (live OAuth configuration still required)');
};
