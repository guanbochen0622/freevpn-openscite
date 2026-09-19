try{await import('./i18n.js?v=25.8.1');}catch(e){console.error('Language setup failed',e);}
// Keep search and the library usable even if the PDF engine cannot initialize.
const ASSET_VERSION = '25.8.1';
try {
  const inflate = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${url} (${response.status})`);
    if ('DecompressionStream' in window) {
      return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).blob();
    }
    if (!window.fflate?.gunzipSync) throw new Error('No compatible PDF engine decompressor is available.');
    const compressed = new Uint8Array(await response.arrayBuffer());
    return new Blob([window.fflate.gunzipSync(compressed)], { type: 'text/javascript' });
  };

  const mainSource = await inflate(`./vendor/pdf.mjs.gz?v=${ASSET_VERSION}`);
  const mainUrl = URL.createObjectURL(new Blob([mainSource], { type: 'text/javascript' }));
  const pdfModule = await import(mainUrl);

  const workerSource = await inflate(`./vendor/pdf.worker.mjs.gz?v=${ASSET_VERSION}`);
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  // Let PDF.js own a separate worker for each loading task. Shared workerPort
  // races with asynchronous destruction when replacing a document.
  pdfModule.GlobalWorkerOptions.workerSrc = workerUrl;
  window.pdfjsLib = pdfModule;
  // Keep module URLs alive across back/forward-cache restoration. The browser
  // releases them when this document is actually discarded.
} catch (error) {
  console.error('PDF engine could not initialize', error);
  window.pdfEngineError = error instanceof Error ? error.message : String(error);
}
for (const src of [`ai-providers.js?v=${ASSET_VERSION}`, `pdf-text.js?v=${ASSET_VERSION}`, `app.js?v=${ASSET_VERSION}`, `workspace.js?v=${ASSET_VERSION}`, `reader-core.js?v=${ASSET_VERSION}`, `reader-tools.js?v=${ASSET_VERSION}`, `document-core.js?v=${ASSET_VERSION}`, `document-understanding.js?v=${ASSET_VERSION}`, `reader-experience.js?v=${ASSET_VERSION}`, `ai-connections.js?v=${ASSET_VERSION}`, `reader-layout.js?v=${ASSET_VERSION}`]) {
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  } catch (error) {
    const status = document.getElementById('searchStatus');
    status.textContent = '應用程式載入失敗，請重新整理。若仍無法使用，請檢查網路連線。';
    console.error('Application script could not load', src, error);
    break;
  }
}
if (!window.pdfjsLib) {
  const reader = document.getElementById('readerEmpty');
  if (reader) reader.textContent = `PDF 閱讀器未能載入：${window.pdfEngineError || '未知錯誤'}。搜尋與論文庫仍可使用。`;
}
