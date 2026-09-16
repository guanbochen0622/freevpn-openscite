// Keep search and the library usable even if the PDF engine cannot initialize.
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

  const mainSource = await inflate('./vendor/pdf.mjs.gz');
  const mainUrl = URL.createObjectURL(new Blob([mainSource], { type: 'text/javascript' }));
  window.pdfjsLib = await import(mainUrl);

  const workerSource = await inflate('./vendor/pdf.worker.mjs.gz');
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  window.pdfjsWorker = new Worker(workerUrl, { type: 'module' });

  window.addEventListener('pagehide', () => {
    window.pdfjsWorker?.terminate();
    URL.revokeObjectURL(mainUrl);
    URL.revokeObjectURL(workerUrl);
  }, { once: true });
} catch (error) {
  console.error('PDF engine could not initialize', error);
  window.pdfEngineError = error instanceof Error ? error.message : String(error);
}
for (const src of ['app.js', 'workspace.js']) {
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
