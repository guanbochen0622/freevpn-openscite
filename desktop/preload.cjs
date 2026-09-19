const {contextBridge,ipcRenderer}=require('electron');
const methods=Object.fromEntries(['downloadPdf','cancelLogin','providerStatus','providerSet','providerModels','providerAsk','status','login','logout','models','ask','cancel'].map(method=>[method,(params)=>ipcRenderer.invoke('openscite:'+method,params)]));
methods.onProgress=callback=>{const handler=(_event,progress)=>callback(progress);ipcRenderer.on('openscite:progress',handler);return ()=>ipcRenderer.removeListener('openscite:progress',handler);};
methods.onLogin=callback=>{const handler=(_event,value)=>callback(value);ipcRenderer.on('openscite:login',handler);return ()=>ipcRenderer.removeListener('openscite:login',handler);};
contextBridge.exposeInMainWorld('opensciteDesktop',Object.freeze(methods));
