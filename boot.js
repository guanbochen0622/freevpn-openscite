// Keep search and the library usable even if the PDF engine cannot initialize.
try {
  const inflate = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${url} (${response.status})`);
    if (!('DecompressionStream' in window)) {
      throw new Error('This browser does not support the PDF engine loader.');
    }
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).blob();
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
  document.getElementById('readerEmpty').textContent = 'PDF 閱讀器未能載入。請重新整理或使用最新版瀏覽器；搜尋與論文庫仍可使用。';
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
