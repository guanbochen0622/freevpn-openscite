'use strict';
const http=require('node:http'),crypto=require('node:crypto');
class GoogleAccount{
 constructor(config,openExternal,transport=fetch){this.config=config;this.openExternal=openExternal;this.transport=transport;this.token='';this.expires=0;this.pending=null;}
 status(){return {configured:!!this.config.clientId,authorized:!!this.token&&this.expires>Date.now()+60000};}
 cancel(){this.pending?.reject(Error('Google 登入已取消'));}
 logout(){this.cancel();this.token='';this.expires=0;}
 async login(){
  if(!this.config.clientId)throw Error('Google 登入尚待應用程式管理者設定');if(this.status().authorized)return this.status();if(this.pending)throw Error('Google 登入正在進行');
  const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(32).toString('base64url'),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  return new Promise((resolve,reject)=>{let settled=false,exchanging=false,timer;const controller=new AbortController();const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);controller.abort();server.close();server.closeAllConnections?.();this.pending=null;if(error)reject(error);else resolve(this.status());};
   const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'");
    if(req.method!=='GET'||url.pathname!=='/'||url.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid login response');return;}
    if(exchanging){res.writeHead(409);res.end('Login already processing');return;}exchanging=true;
    if(url.searchParams.has('error')||!url.searchParams.get('code')){res.end('Google login was not completed. Return to PaperLume.');finish(Error('Google 授權未完成'));return;}
    try{const body=new URLSearchParams({client_id:this.config.clientId,code:url.searchParams.get('code'),code_verifier:verifier,grant_type:'authorization_code',redirect_uri:redirect});if(this.config.clientSecret)body.set('client_secret',this.config.clientSecret);
     const response=await this.transport('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]),redirect:'error'});const data=await response.json();if(!response.ok||typeof data.access_token!=='string'||!Number.isFinite(Number(data.expires_in)))throw Error('Google 授權交換失敗，請重新登入');if(settled)return;
     this.token=data.access_token;this.expires=Date.now()+Number(data.expires_in)*1000;res.end('Google login completed. Return to PaperLume.');finish();
    }catch(e){res.end('Google login failed. Return to PaperLume.');finish(Error(e.name==='AbortError'?'Google 登入已取消':e.message));}
   });let redirect;this.pending={reject:finish};timer=setTimeout(()=>finish(Error('Google 登入等待逾時')),180000);server.on('error',()=>finish(Error('無法開啟本機登入回傳連線')));server.listen(0,'127.0.0.1',()=>{redirect='http://127.0.0.1:'+server.address().port+'/';const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:this.config.clientId,redirect_uri:redirect,response_type:'code',scope:'openid email profile https://www.googleapis.com/auth/drive.appdata',code_challenge:challenge,code_challenge_method:'S256',state,prompt:'select_account'}).toString();Promise.resolve(this.openExternal(url.href)).catch(()=>finish(Error('無法開啟瀏覽器登入')));});
  });
 }
 async request({url,method='GET',headers={},body}={}){
  const u=new URL(url);if(u.origin!=='https://www.googleapis.com'||u.username||u.password||!/^\/(?:oauth2\/v3\/userinfo|drive\/v3\/files(?:\/[A-Za-z0-9_-]+)?|upload\/drive\/v3\/files(?:\/[A-Za-z0-9_-]+)?)$/.test(u.pathname)||!['GET','POST','PATCH'].includes(method))throw Error('不允許的 Google 請求');
  if(!this.status().authorized)throw Error('Google 授權已到期，請重新登入');if(body!==undefined&&(typeof body!=='string'||body.length>20000000))throw Error('雲端紀錄超過大小限制');const contentType=headers['Content-Type']||'application/json';if(typeof contentType!=='string'||/[\r\n]/.test(contentType))throw Error('無效的請求格式');
  const response=await this.transport(u.href,{method,headers:{Authorization:'Bearer '+this.token,'Content-Type':contentType},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(30000),redirect:'error'});if(!response.ok){if(response.status===401)this.logout();throw Error('Google 操作未完成（'+response.status+'）');}const text=await response.text();if(text.length>20000000)throw Error('雲端紀錄超過大小限制');return text?JSON.parse(text):null;
 }
}
module.exports={GoogleAccount};
