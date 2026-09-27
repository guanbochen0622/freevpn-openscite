const {contextBridge,ipcRenderer}=require('electron');
const methods=Object.fromEntries(['googleStatus','googleLogin','googleCancel','googleLogout','googleRequest','downloadPdf','cancelLogin','status','login','logout','models','ask','cancel'].map(method=>[method,(params)=>ipcRenderer.invoke('paperlume:'+method,params)]));
methods.onProgress=callback=>{const handler=(_event,progress)=>callback(progress);ipcRenderer.on('paperlume:progress',handler);return ()=>ipcRenderer.removeListener('paperlume:progress',handler);};
methods.onLogin=callback=>{const handler=(_event,value)=>callback(value);ipcRenderer.on('paperlume:login',handler);return ()=>ipcRenderer.removeListener('paperlume:login',handler);};
contextBridge.exposeInMainWorld('paperlumeDesktop',Object.freeze(methods));
