# Local OCR assets

- Tesseract.js 6.0.1: npm distribution (`tesseract.min.js`, `worker.min.js`), Apache-2.0.
- Tesseract.js-core 6.1.2: npm distribution (`tesseract-core-lstm.wasm.js`), Apache-2.0.
- English trained data: `@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz` (Tesseract tessdata, Apache-2.0).

The explicit baseline LSTM core is intentional: the same bundled implementation runs without SIMD on supported browser and Electron engines. It trades some speed for a smaller offline distribution. OCR images are processed locally and are not uploaded. Additional OCR language data is downloaded on demand from https://tessdata.projectnaptha.com/4.0.0_best_int and cached by Tesseract; this download contains model data, not the user's document.

General OCR is not a mathematical typesetter. OCR text is a reviewable draft. Formula/table analysis is a separate, explicitly invoked image request to the user's configured AI, and is never presented as verified transcription.
