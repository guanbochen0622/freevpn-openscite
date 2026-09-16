// Keep search and the library usable even if the PDF engine cannot initialize.
try {
  window.pdfjsLib = await import('./vendor/pdf.mjs');
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
