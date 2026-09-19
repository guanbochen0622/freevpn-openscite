const {app,BrowserWindow,protocol,net,ipcMain,shell,safeStorage}=require('electron');
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {ProviderAccounts}=require('./providers.cjs');
const {Rpc}=require('./rpc.cjs');const {Assistant}=require('./assistant.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'openscite',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
let rpc,assistant,win,ready;
app.whenReady().then(async()=>{
 const web=path.join(__dirname,'web');
 protocol.handle('openscite',req=>{const url=new URL(req.url);const file=path.resolve(web,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(url.host!=='app'||!file.startsWith(web+path.sep))return new Response('Not found',{status:404});return net.fetch(pathToFileURL(file).href);});
 const data=app.getPath('userData'),codexHome=path.join(data,'codex'),cwd=path.join(data,'analysis');fs.mkdirSync(codexHome,{recursive:true,mode:0o700});fs.mkdirSync(cwd,{recursive:true});
 // Use a separate official Codex configuration directory, never renderer storage.
 const env={...process.env,CODEX_HOME:codexHome,ELECTRON_RUN_AS_NODE:'1'};delete env.OPENAI_API_KEY;delete env.CODEX_API_KEY;
 const config=['forced_login_method="chatgpt"','features.shell_tool=false','features.unified_exec=false','features.shell_snapshot=false','features.remote_plugin=false','web_search="disabled"','history.persistence="none"'];
 const child=spawn(process.execPath,[path.join(__dirname,'node_modules/@openai/codex/bin/codex.js'),'app-server',...config.flatMap(c=>['-c',c])],{cwd,env,stdio:['pipe','pipe','pipe'],windowsHide:true});
 rpc=new Rpc(child);assistant=new Assistant(rpc,cwd,progress=>{if(win&&!win.isDestroyed())win.webContents.send('openscite:progress',progress);});ready=rpc.request('initialize',{clientInfo:{name:'openscite_desktop',title:'OpenScite Desktop',version:app.getVersion()}}).then(()=>rpc.send({method:'initialized',params:{}}));ready.catch(()=>{});
 const accounts=new ProviderAccounts(path.join(data,'provider-keys.json'),safeStorage);
 const handlers={status:()=>rpc.request('account/read'),models:()=>assistant.models(),ask:b=>assistant.ask(b),cancel:async()=>{accounts.cancel();await assistant.cancel();},logout:async()=>{await assistant.cancel();return rpc.request('account/logout');},login:async()=>{const r=await rpc.request('account/login/start',{type:'chatgpt'});const u=new URL(r.authUrl);if(u.protocol!=='https:'||!['auth.openai.com','auth0.openai.com','chatgpt.com'].includes(u.hostname))throw new Error('登入網址不在官方允許清單');await shell.openExternal(u.href);return {started:true};}};
 const apiHandlers={providerStatus:()=>accounts.status(),providerSet:b=>accounts.set(b),providerModels:b=>accounts.models(b),providerAsk:b=>accounts.ask(b)};
 for(const [method,fn]of Object.entries({...handlers,...apiHandlers}))ipcMain.handle('openscite:'+method,async(event,arg)=>{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||!event.senderFrame.url.startsWith('openscite://app/'))throw new Error('不允許的來源');if(!apiHandlers[method]&&method!=='cancel')await ready;return fn(arg);});
 win=new BrowserWindow({width:1440,height:960,minWidth:860,minHeight:640,title:'OpenScite Desktop',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/.test(url))shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('openscite://app/')){event.preventDefault();if(/^https?:/.test(url))shell.openExternal(url);}});
 await win.loadURL('openscite://app/index.html');
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>rpc?.close());
