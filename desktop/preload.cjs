const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('opensciteDesktop',Object.freeze(Object.fromEntries(['status','login','logout','models','ask','cancel'].map(method=>[method,(params)=>ipcRenderer.invoke('openscite:'+method,params)]))));
