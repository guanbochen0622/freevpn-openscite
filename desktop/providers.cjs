const fs=require('node:fs'),path=require('node:path');
const Providers=require(fs.existsSync(path.join(__dirname,'web/ai-providers.js'))?'./web/ai-providers.js':'../ai-providers.js');
class ProviderAccounts {
 constructor(file,safeStorage){this.file=file;this.safeStorage=safeStorage;this.keys=new Map();this.saved={};this.active=null;try{this.saved=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}}
 validate(provider){if(!['gemini','claude','openai'].includes(provider))throw Error('不支援的服務');}
 key(provider){this.validate(provider);if(this.keys.has(provider))return this.keys.get(provider);const value=this.saved[provider];if(!value)return '';try{return this.safeStorage.decryptString(Buffer.from(value,'base64'));}catch{return '';}}
 status(){return Object.fromEntries(['gemini','claude','openai'].map(p=>[p,{configured:!!this.key(p),persistent:!!this.saved[p]}]));}
 set({provider,key,remember=false}){this.validate(provider);if(typeof key!=='string'||key.length>4096||/[\r\n]/.test(key))throw Error('API 金鑰格式不正確');key=key.trim();const saved={...this.saved};delete saved[provider];if(key&&remember){if(!this.safeStorage.isEncryptionAvailable()||this.safeStorage.getSelectedStorageBackend?.()==='basic_text')throw Error('系統安全儲存不可用，請使用僅本次連線');saved[provider]=this.safeStorage.encryptString(key).toString('base64');}fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(saved),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);this.saved=saved;this.keys.set(provider,key);return this.status();}
 async ask({provider,model,body}){if(this.active)throw Error('已有分析正在進行');const controller=new AbortController();this.active=controller;try{return await Providers.send(provider,model,this.key(provider),body,{signal:controller.signal});}finally{if(this.active===controller)this.active=null;}}
 async models({provider}){return Providers.models(provider,this.key(provider));}
 cancel(){this.active?.abort();}
}
module.exports={ProviderAccounts};
