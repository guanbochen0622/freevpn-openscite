const bridge = window.opensciteDesktop;
if (bridge) {
  const modal = document.createElement('dialog');
  modal.style.cssText = 'max-width:620px;width:90%;max-height:90vh;overflow:auto;border:1px solid #646b86;border-radius:20px;padding:28px;background:#151a28;color:#f5f6ff';
  modal.innerHTML = `<h2>ChatGPT 帳號</h2>
    <p>登入後，可用「測試模型回答」確認是否真的能分析。</p>
    <p id="desktopStatus" role="status">正在連線…</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn primary" id="desktopLogin">登入 ChatGPT</button>
      <button class="btn" id="desktopDeviceLogin">改用裝置碼登入</button><button class="btn" id="desktopCancelLogin">取消登入</button><button class="btn" id="desktopRefresh">重新整理</button>
      <button class="btn" id="desktopLogout">登出</button>
    </div>
    <p id="desktopLoginHelp" role="status"></p><label class="stack-label">主模型（ChatGPT）<select class="control" id="desktopModel"></select></label>
    <label class="stack-label">推理強度<select class="control" id="desktopEffort"></select></label>
    <button class="btn primary" id="desktopTest" style="margin-top:16px">測試模型回答</button>
    <button class="btn" id="desktopCancelTest">取消分析</button>
    <p id="desktopTestResult" role="status" style="white-space:pre-wrap">尚未測試。測試會發送一句簡短問題，使用少量帳號額度，不傳送論文。</p>
    <p>分析時，所需論文文字或裁切圖片會傳送給 OpenAI。可用模型與額度依帳號而定。</p>
    <button class="btn" id="desktopClose">完成</button>`;
  document.body.append(modal);
  const el = id => modal.querySelector('#' + id);
  const status = document.createElement('div');
  status.id = 'desktopConnectionStatus';
  status.className = 'ai-connection-status';
  status.setAttribute('role', 'status');
  status.textContent = 'ChatGPT：正在確認帳號…';
  el('desktopStatus').after(status);
  let models = [], poll, loginPending=false, refreshing = false, testing = false, running = false;
  const cleanError = e => String(e.message || e).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
  const fail = e => { el('desktopStatus').textContent = cleanError(e); status.textContent = 'ChatGPT 連線錯誤：' + cleanError(e); };
  function save() {
    localStorage.setItem('desktopModel', el('desktopModel').value);
    localStorage.setItem('desktopEffort', el('desktopEffort').value);
  }
  function effort() {
    const model = models.find(m => m.model === el('desktopModel').value);
    el('desktopEffort').replaceChildren(...(model?.supportedReasoningEfforts || []).map(e => new Option(({low:'低',medium:'中',high:'高',xhigh:'更高'})[e.reasoningEffort] || e.reasoningEffort, e.reasoningEffort)));
    const saved = localStorage.getItem('desktopEffort') || 'medium';
    el('desktopEffort').value = [...el('desktopEffort').options].some(o => o.value === saved) ? saved : model?.defaultReasoningEffort || '';
    save();
    status.textContent = `ChatGPT 已登入 · ${model?.displayName || '尚無可用模型'} · 尚未驗證本次模型連線`;
  }
  async function refresh() {
    if (refreshing || testing || running) return;
    refreshing = true;
    try {
      const s = await bridge.status();
      const loggedIn = s.account?.type === 'chatgpt';
      el('desktopStatus').textContent = loggedIn ? `帳號已登入：${s.account.email || 'ChatGPT'} · ${s.account.planType || ''}` : loginPending?'等待官方登入完成…':'尚未登入';
      el('desktopTest').disabled = !loggedIn;
      if (!loggedIn) {
        status.textContent = 'ChatGPT 尚未登入：按右上「AI 模型」→ ChatGPT 登入。';
        el('desktopModel').replaceChildren();el('desktopEffort').replaceChildren();
        return;
      }
      models = await bridge.models();
      if (!models.length) throw new Error('帳號已登入，但服務尚未提供可用模型。請重新整理或確認 Codex 使用權限。');
      clearInterval(poll);loginPending=false;el('desktopLoginHelp').replaceChildren();
      el('desktopModel').replaceChildren(...models.map(m => new Option(m.displayName, m.model)));
      const saved = localStorage.getItem('desktopModel');
      el('desktopModel').value = models.some(m => m.model === saved) ? saved : (models.find(m => m.isDefault) || models[0]).model;
      effort();
    } finally { refreshing = false; }
  }
  bridge.onProgress?.(progress => {
    running = progress.stage !== 'idle';
    if (!running) { status.textContent = 'ChatGPT 分析已結束；回答或錯誤詳見下方。'; return; }
    const text = (progress.model ? progress.model + ' · ' : '') + progress.message;
    status.textContent = window.I18n?.t(text)||text;
    if (testing) el('desktopTestResult').textContent = text + (progress.text ? '\n' + progress.text : '');
    else if (progress.stage === 'answering' && progress.text && !state.reader.figureBusy && !window.AIConnections?.config().mixed) {
      const output = document.getElementById('assistantOutput');
      output.textContent = progress.text;
    }
  });
  const settings = document.getElementById('settingsBtn');
  settings.textContent = 'AI 模型';
  window.openChatGPTSettings = () => { modal.showModal();refresh().catch(fail); };
  el('desktopModel').onchange = effort;
  el('desktopEffort').onchange = save;
  el('desktopClose').onclick = () => modal.close();
  el('desktopRefresh').onclick = () => refresh().catch(fail);
  window.addEventListener('focus', () => { if (!testing) refresh().catch(fail); });
  async function startLogin(device=false){
    el('desktopLogin').disabled=true;el('desktopDeviceLogin').disabled=true;
    try{clearInterval(poll);const result=await bridge.login({device});loginPending=true;
      const help=el('desktopLoginHelp');help.replaceChildren();
      const link=document.createElement('a');link.href=result.url;link.target='_blank';link.rel='noreferrer';link.textContent='開啟官方登入頁';help.append(link);
      help.append(document.createTextNode(result.userCode?' · 裝置碼：'+result.userCode+'。若官方要求，請先在 ChatGPT 設定啟用裝置碼登入。':' · 請在這台電腦的瀏覽器登入，再回到程式。若無法返回，改用裝置碼登入。'));
      el('desktopStatus').textContent='等待官方登入完成…';const deadline=Date.now()+15*60*1000;
      poll=setInterval(()=>{if(Date.now()>deadline){clearInterval(poll);loginPending=false;bridge.cancelLogin().catch(()=>{});fail(Error('登入等待逾時，請重新登入或改用裝置碼'));}else refresh().catch(fail);},3000);
    }catch(e){loginPending=false;fail(e);}finally{el('desktopLogin').disabled=false;el('desktopDeviceLogin').disabled=false;}
  }
  el('desktopLogin').onclick=()=>startLogin(false);el('desktopDeviceLogin').onclick=()=>startLogin(true);
  el('desktopCancelLogin').onclick=async()=>{clearInterval(poll);loginPending=false;try{await bridge.cancelLogin();el('desktopLoginHelp').replaceChildren();await refresh();}catch(e){fail(e);}};
  bridge.onLogin?.(value=>{clearInterval(poll);loginPending=false;el('desktopLoginHelp').replaceChildren();if(value.success)refresh().catch(fail);else fail(Error(value.error||'登入未完成；可改用裝置碼登入'));});
  el('desktopLogout').onclick = async () => { try { await bridge.logout();clearInterval(poll);await refresh(); } catch (e) { fail(e); } };
  el('desktopCancelTest').onclick = () => bridge.cancel().catch(fail);
  el('desktopTest').onclick = async () => {
    testing = true;el('desktopTest').disabled = true;save();
    try {
      const answer = await bridge.ask({desktopModel:el('desktopModel').value,desktopEffort:el('desktopEffort').value,language:window.I18n?.language||'zh-Hant',input:[{role:'user',content:[{type:'input_text',text:'This is a connection test, not a paper question. Reply with exactly: OpenScite 連線成功'}]}]});
      el('desktopTestResult').textContent = '已收到模型真實回答：\n' + answer;
      status.textContent = 'ChatGPT 模型回答已驗證 · ' + el('desktopModel').value;
    } catch (e) {
      const message = '模型測試失敗：\n' + cleanError(e);
      el('desktopTestResult').textContent = message;status.textContent = message;
    } finally { testing = false;el('desktopTest').disabled = false; }
  };
  refresh().catch(fail);
}
