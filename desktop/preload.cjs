const {contextBridge,ipcRenderer}=require('electron');
const methods=Object.fromEntries(['status','login','logout','models','ask','cancel'].map(method=>[method,(params)=>ipcRenderer.invoke('openscite:'+method,params)]));
methods.onProgress=callback=>{const handler=(_event,progress)=>callback(progress);ipcRenderer.on('openscite:progress',handler);return ()=>ipcRenderer.removeListener('openscite:progress',handler);};
contextBridge.exposeInMainWorld('opensciteDesktop',Object.freeze(methods));
