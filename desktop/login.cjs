'use strict';
class AccountLogin {
 constructor(rpc,openExternal,notify=()=>{}){this.rpc=rpc;this.openExternal=openExternal;this.notify=notify;this.pending=null;this.starting=false;
 rpc.on('notification',m=>{if(m.method==='account/login/completed'&&m.params?.loginId===this.pending){this.pending=null;notify({success:!!m.params.success,error:m.params.error||''});}});}
 async cancel(){const id=this.pending;this.pending=null;if(id)await this.rpc.request('account/login/cancel',{loginId:id});}
 async start(options={}){if(this.starting)throw Error('登入正在啟動，請稍候');this.starting=true;try{await this.cancel();const type=options.device?'chatgptDeviceCode':'chatgpt';const r=await this.rpc.request('account/login/start',{type});this.pending=r.loginId;const url=new URL(r.authUrl||r.verificationUrl);if(url.protocol!=='https:'||url.username||url.password||!['auth.openai.com','auth0.openai.com','chatgpt.com'].includes(url.hostname))throw Error('登入網址不在官方允許清單');let opened=true;try{await this.openExternal(url.href);}catch{opened=false;}return {url:url.href,userCode:r.userCode||'',opened,type};}catch(e){await this.cancel().catch(()=>{});throw e;}finally{this.starting=false;}}
}
module.exports={AccountLogin};
