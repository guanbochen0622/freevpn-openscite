// Developer smoke check: no account login or model requests.
const {app}=require('electron');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'openscite-window-'));app.setPath('userData',profile);
require('./main.cjs');
const timer=setTimeout(()=>{console.error('Desktop window smoke timed out');app.exit(1);},45000);
app.on('browser-window-created',(_e,win)=>{
 win.webContents.once('did-finish-load',async()=>{
 try{
 await new Promise(r=>setTimeout(r,2500));
 const result=await win.webContents.executeJavaScript(`(async()=>({button:document.getElementById('settingsBtn')?.textContent,bridge:typeof window.opensciteDesktop?.ask,status:await window.opensciteDesktop.status(),pdf:!!window.pdfjsLib}))()`);
 assert.equal(result.button,'ChatGPT 帳號');assert.equal(result.bridge,'function');assert.equal(result.pdf,true);assert.equal(result.status.account,null);
 await win.webContents.executeJavaScript(`document.getElementById('settingsBtn').click()`);
 assert.equal(await win.webContents.executeJavaScript(`!!document.querySelector('dialog[open]')`),true);
 console.log('PASS desktop window, PDF engine, isolated bridge, account status and account dialog');
 clearTimeout(timer);app.quit();
 }catch(e){console.error(e);clearTimeout(timer);app.exit(1);}
 });
});
