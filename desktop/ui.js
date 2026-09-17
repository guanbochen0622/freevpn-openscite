const bridge = window.opensciteDesktop;
if (bridge) {
  const modal = document.createElement('dialog');
  modal.style.cssText = 'max-width:620px;width:90%;max-height:90vh;overflow:auto;border:1px solid #646b86;border-radius:20px;padding:28px;background:#151a28;color:#f5f6ff';
  modal.innerHTML = `<h2>ChatGPT 帳號</h2>
    <p>登入後，可用「測試模型回答」確認是否真的能分析。</p>
    <p id="desktopStatus" role="status">正在連線…</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn primary" id="desktopLogin">登入 ChatGPT</button>
      <button class="btn" id="desktopRefresh">重新整理</button>
      <button class="btn" id="desktopLogout">登出</button>
    </div>
    <label class="stack-label">模型<select class="control" id="desktopModel"></select></label>
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
  document.getElementById('assistantOutput').before(status);
  let models = [], poll, refreshing = false, testing = false, running = false;
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
      el('desktopStatus').textContent = loggedIn ? `帳號已登入：${s.account.email || 'ChatGPT'} · ${s.account.planType || ''}` : '尚未登入';
      el('desktopTest').disabled = !loggedIn;
      if (!loggedIn) {
        status.textContent = 'ChatGPT 尚未登入：按右上「ChatGPT 帳號」登入。';
        el('desktopModel').replaceChildren();el('desktopEffort').replaceChildren();
        return;
      }
      models = await bridge.models();
      if (!models.length) throw new Error('帳號已登入，但服務尚未提供可用模型。請重新整理或確認 Codex 使用權限。');
      clearInterval(poll);
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
    else if (progress.stage === 'answering' && progress.text && !state.reader.figureBusy) {
      const output = document.getElementById('assistantOutput');
      output.textContent = progress.text;
    }
  });
  const settings = document.getElementById('settingsBtn');
  settings.textContent = 'ChatGPT 帳號';
  settings.addEventListener('click', event => { event.stopImmediatePropagation();modal.showModal();refresh().catch(fail); }, {capture:true});
  el('desktopModel').onchange = effort;
  el('desktopEffort').onchange = save;
  el('desktopClose').onclick = () => modal.close();
  el('desktopRefresh').onclick = () => refresh().catch(fail);
  window.addEventListener('focus', () => { if (!testing) refresh().catch(fail); });
  el('desktopLogin').onclick = async () => {
    try {
      await bridge.login();el('desktopStatus').textContent = '請在瀏覽器完成登入，再回到程式。';
      clearInterval(poll);poll = setInterval(() => refresh().catch(fail), 3000);
    } catch (e) { fail(e); }
  };
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
