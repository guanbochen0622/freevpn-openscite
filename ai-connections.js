 'use strict';
(function(){
const bridge=window.opensciteDesktop;let report=null;
function config(){return {primary:'chatgpt',mixed:false,reviewers:[],models:{chatgpt:localStorage.getItem('desktopModel')||''}};}
const status=document.createElement('p');status.id='modelRunStatus';status.className='model-run-status';status.setAttribute('role','status');status.textContent='ChatGPT 帳號分析';$('assistantOutput').before(status);
async function request(body,signal){
 report=null;signal?.throwIfAborted();
 if(!bridge)throw Error('請使用 OpenScite 桌面版登入 ChatGPT 帳號後分析。網頁版可搜尋、閱讀與保存論文。');
 const abort=()=>bridge.cancel().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});status.textContent='ChatGPT 正在分析…';
 try{const text=await bridge.ask({...body,desktopModel:localStorage.getItem('desktopModel')||'',desktopEffort:localStorage.getItem('desktopEffort')||'medium',desktopSpeed:localStorage.getItem('desktopSpeed')||'default',language:window.I18n?.language||'zh-Hant'});signal?.throwIfAborted();report={primary:'chatgpt',mixed:false,records:[{provider:'chatgpt',model:config().models.chatgpt,connection:'native',status:'success'}]};status.textContent='ChatGPT 回答完成';return text;}catch(e){status.textContent='分析未完成：'+String(e.message);throw e;}finally{signal?.removeEventListener('abort',abort);}
}
function open(){if(window.openChatGPTSettings)return window.openChatGPTSettings();const modal=document.createElement('dialog');modal.className='model-dialog';const title=document.createElement('h2');title.textContent='ChatGPT 帳號登入';const message=document.createElement('p');message.textContent='請在桌面版使用 ChatGPT 帳號直接分析，不需要 API 金鑰。';const link=document.createElement('a');link.className='btn primary';link.href='https://github.com/guanbochen0622/freevpn-openscite/releases/latest';link.target='_blank';link.rel='noreferrer';link.textContent='下載 macOS／Windows 桌面版';const close=document.createElement('button');close.className='btn';close.textContent='關閉';close.onclick=()=>modal.close();modal.append(title,message,link,close);modal.onclose=()=>modal.remove();document.body.append(modal);modal.showModal();}
$('settingsBtn').textContent='ChatGPT 帳號';$('settingsBtn').addEventListener('click',e=>{e.stopImmediatePropagation();open();},{capture:true});
// Retire old user-facing API controls and credentials. No API fallback remains.
$('aiModal')?.remove();for(const key of [STORE.aiKey,STORE.aiEndpoint,'openscite_ai_connections_v1','openscite_session_gemini','openscite_session_claude']){localStorage.removeItem(key);sessionStorage.removeItem(key);}
window.AIConnections={request,config,open,lastReport:()=>report?structuredClone(report):null};
})();
