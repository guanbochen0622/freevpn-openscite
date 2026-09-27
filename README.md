# PaperLume 25 — Research Workspace

A browser-based academic research workspace: discover papers, inspect PDFs, collect notes, and trace citation passages. No account or installation is required for readers. The existing `freevpn/` directory is unrelated and is not used by the website.

## This release

Desktop 0.11.0 / web 25.11 restores **ChatGPT account login only**. No AI API keys, Gemini/Claude adapters or manual answer handoff remain. Desktop users select their available ChatGPT model, reasoning effort and standard/fast response tier. Fast mode requires service support and may consume more quota; unsupported requests surface the actual error.

The assistant defaults to larger text and a wider column, with a mouse/keyboard resize handle and font slider. Validated answer quotes are located in PDF text/OCR geometry and highlighted in both the reader and preview. Ambiguous or unlocatable quotes are explicitly reported. Formula analysis includes the name, every symbol, units, physical interpretation, paper-specific role and assumptions, with safe math rendering in prose.

Citation lookup supports bracketed and parenthesized references plus Europe PMC full-text reference IDs. Stance remains an inference grounded in actual passages; unavailable full text is not reported as verified.

Guest workspaces persist locally. Google web login and Drive app-data backup are implemented but **not activated**: the deployment has no Google OAuth client ID. Desktop Google OAuth uses the system browser with PKCE and a loopback callback; it also needs its own registered client ID. See [Google setup](GOOGLE-SETUP.md) and [verification scope](VALIDATION-0.10.0.md). PDF bytes are local and excluded from cloud backups.

## Run

Serve this directory over HTTP(S), for example `python3 -m http.server 8765`, then open `http://localhost:8765`. ES modules and PDF workers cannot reliably load from a double-clicked `file://` page. GitHub Pages can serve the root directory directly.

Runtime files: `index.html`, `styles.css`, `workspace.css`, `boot.js`, `app.js`, `workspace.js`, `vendor/`. No build step is required. PDF.js is pinned and self-hosted; its license is in `vendor/PDFJS-LICENSE`.

## Verification

Run `npm install`, `npx playwright install chromium`, then `npm test` (the suite starts its own temporary local server). The browser smoke suite uses a generated 16-page PDF and intercepted bibliographic responses; it never sends real documents or paid AI requests. `CHROMIUM_PATH` may point to a preinstalled compatible Chromium. See `VALIDATION-0.10.0.md` for current verification. Optional real-file regression: `node tests/real-papers.cjs /absolute/paper.pdf [...]`; files stay local and no model service is called.

## Product limits and commercial readiness

This is a local-first browser application, not a hosted multi-tenant subscription service. It has no server-side accounts, billing, cloud synchronization, team access controls, managed API budget or subscription enforcement. Those require a backend, operational decisions, and real integration/security validation before selling it as a service.

- OpenAlex/Crossref availability, API entitlements and rate limits are external. OA-only search fails explicitly if OpenAlex is unavailable, because Crossref cannot provide an equivalent verified filter.
- Bibliographic totals are provider totals, not deduplicated corpus counts. Search results and author lists can be incomplete. Verify citations against the publisher.
- Scanned PDFs support explicit local page OCR; adopted/corrected text becomes searchable. OCR drafts require checking against the original. Layouts without numbered reference entries are not automatically bound.
- Direct remote PDF loading requires the publisher to allow CORS and access. The app does not bypass publisher login or subscription access.
- The reader limits rasterized canvases, not all PDF parsing/index memory. Very large documents may still consume considerable browser memory.
- AI answers and figure readings can be wrong. Inspect the cited page and original visual before relying on them. Page links are not proof that the model's claim is supported. Context selection uses lexical ranking, not semantic retrieval; summaries use excerpts.
- API keys are user-supplied and used in the browser. Session storage is the default; persistent storage is optional. Do not distribute a shared secret in these files. A paid service should use a secured server-side gateway and per-user limits.
- Browser storage is device/origin-specific and may be cleared. Exports are not encrypted. Keep backups and original PDFs.

## Reference documentation

- [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)
- [OpenAlex documentation](https://docs.openalex.org/)
- [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)

## 電腦版：使用自己的 ChatGPT 帳號

[電腦版預覽與啟動說明](desktop/README.md)。包含官方 Codex 登入、帳號可用模型選擇、PDF 問答與圖表分析整合；不需填 API 金鑰。Mac 使用者可從 [預覽版下載頁](https://github.com/guanbochen0622/paperlume/releases) 下載 DMG，無須安裝 Node.js。Apple 晶片與 Intel 的 Mac 啟動測試已通過；個人帳號登入後的分析仍待使用者實機驗證。

## PaperLume rename and existing data

The display name, npm packages, desktop executables, installer assets, connection messages and developer bridge now use PaperLume. The repository target is `guanbochen0622/paperlume`. Existing storage keys, IndexedDB name, backup formats, cloud-backup filename, desktop application ID, custom origin and profile directory deliberately retain legacy identifiers. These are compatibility identifiers, not displayed product names. Keeping them preserves libraries, notes, OAuth sessions and Windows upgrade identity. Browser storage remains on the same GitHub Pages origin when only the repository path changes. Old exported workspace backups remain supported.
