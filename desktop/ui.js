const bridge=window.opensciteDesktop;
if(bridge){
 const modal=document.createElement('dialog');modal.style.cssText='max-width:560px;width:90%;border:1px solid #646b86;border-radius:20px;padding:28px;background:#151a28;color:#f5f6ff';
 modal.innerHTML=`<h2>ChatGPT 帳號</h2><p>使用自己的帳號與可用模型，不需要 API 金鑰。</p><p id="desktopStatus" role="status">正在連線…</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn primary" id="desktopLogin">登入 ChatGPT</button><button class="btn" id="desktopRefresh">重新整理</button><button class="btn" id="desktopLogout">登出</button></div><label class="stack-label">模型<select class="control" id="desktopModel"></select></label><label class="stack-label">推理強度<select class="control" id="desktopEffort"></select></label><p>按下分析時，所需的論文文字或裁切圖片會傳送給 OpenAI。模型與額度依你的帳號而定，不會自動帶入其他 ChatGPT 對話。</p><button class="btn" id="desktopClose">完成</button>`;
 document.body.append(modal);const el=id=>modal.querySelector('#'+id);let models=[];let poll;
 const fail=e=>el('desktopStatus').textContent=e.message;
 function effort(){const m=models.find(m=>m.model===el('desktopModel').value);el('desktopEffort').replaceChildren(...(m?.supportedReasoningEfforts||[]).map(e=>new Option(({low:'低',medium:'中',high:'高',xhigh:'更高'})[e.reasoningEffort]||e.reasoningEffort,e.reasoningEffort)));const saved=localStorage.getItem('desktopEffort')||'medium';el('desktopEffort').value=[...el('desktopEffort').options].some(o=>o.value===saved)?saved:m?.defaultReasoningEffort||'';save();}
 function save(){localStorage.setItem('desktopModel',el('desktopModel').value);localStorage.setItem('desktopEffort',el('desktopEffort').value);}
 async function refresh(){const s=await bridge.status();el('desktopStatus').textContent=s.account?.type==='chatgpt'?`已登入：${s.account.email||'ChatGPT'} · ${s.account.planType||''}`:'尚未登入';if(s.account?.type!=='chatgpt'){el('desktopModel').replaceChildren();el('desktopEffort').replaceChildren();return;}clearInterval(poll);models=await bridge.models();el('desktopModel').replaceChildren(...models.map(m=>new Option(m.displayName,m.model)));const saved=localStorage.getItem('desktopModel');el('desktopModel').value=models.some(m=>m.model===saved)?saved:(models.find(m=>m.isDefault)||models[0])?.model||'';effort();}
 document.getElementById('settingsBtn').textContent='ChatGPT 帳號';document.getElementById('settingsBtn').addEventListener('click',event=>{event.stopImmediatePropagation();modal.showModal();refresh().catch(fail);},{capture:true});
 el('desktopModel').onchange=effort;el('desktopEffort').onchange=save;
 el('desktopClose').onclick=()=>modal.close();modal.addEventListener('close',()=>clearInterval(poll));
 el('desktopRefresh').onclick=()=>refresh().catch(fail);
 el('desktopLogin').onclick=async()=>{try{await bridge.login();el('desktopStatus').textContent='請在瀏覽器完成登入，再回到這裡。';clearInterval(poll);poll=setInterval(()=>refresh().catch(fail),3000);}catch(e){fail(e);}};
 el('desktopLogout').onclick=async()=>{try{await bridge.logout();await refresh();}catch(e){fail(e);}};
 refresh().catch(fail);
}
