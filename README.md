# OpenScite 25 — Research Workspace

A browser-based academic research workspace: discover papers, inspect PDFs, collect notes, and trace citation passages. No account or installation is required for readers. The existing `freevpn/` directory is unrelated and is not used by the website.

## This release

Reader revision 4 (desktop 0.8.0 / web 25.8): Gemini and Claude API connections alongside the existing ChatGPT desktop sign-in and OpenAI API. Optional 2–3-provider synthesis, compact reader tools and Windows x64 installers. See [the verification scope](VALIDATION-0.8.0.md).

Open **AI 模型** to configure connections. Gemini uses a key from [Google AI Studio](https://aistudio.google.com/apikey); Claude uses [Claude Console](https://platform.claude.com/settings/keys). These API connections use separate quotas from chat subscriptions. Select a primary model, optionally enable mixed synthesis and additional reviewers, then save. Each selected service receives the supplied paper excerpts/images; the primary receives their drafts for synthesis. No model is called merely by opening a paper or choosing settings.

Desktop keys are session-only by default; optional persistence uses the OS encryption facility and refuses an unencrypted fallback. Browser Gemini/Claude keys remain in session storage. Connection tests send a short prompt, with no paper. Keys are excluded from workspace backups. Model availability, API billing and CORS support depend on the provider; use the desktop app if browser cross-origin access is unavailable.

- Search: OpenAlex with Crossref fallback, validated year ranges, provider-side date/citation sorting, deduplication within a page, stale-request protection, recent searches, individual keyword highlighting including hyphenated words.
- Compare up to three papers; inspect and export source metadata as BibTeX. The journal score sort is **within the current page**. Arbitrary metrics are never labeled official Q1–Q4 rankings.
- Reader: self-hosted PDF.js 5.6.205, lazy page rendering with a nine-canvas retention budget, independent full-text indexing, outline, full-document search, page navigation, bookmarks, resume position, focus mode, text selection, notes, four-color position-anchored highlights, figure analysis and original PDF download.
- Identical local PDF bytes share a SHA-256 identity, so re-uploading keeps annotations. Existing v24 storage keys are retained.
- Library: title/author/tag search, sort, tags, metadata/notes/highlight/bookmark backup and validated merge restore. Backups intentionally exclude API keys and PDF bytes; keep original PDFs separately.
- AI: relevant-page excerpts for questions, distributed page excerpts for summary, clickable returned page markers, explicit document-as-untrusted-data instruction. No automatic AI requests or bundled API secrets. Duplicate AI requests are blocked, current requests can be canceled, and questions wait for the full text index. MyMemory translation requires confirmation.
- Evidence: citing works start unverified. Numbered reference entries are matched to the target DOI or a strong title match before numeric citation markers are extracted. Any support/contrast classification is a **rule-based candidate for human review**, not validated semantic inference. Author–year and ambiguous bindings remain unresolved.
- Dark/light themes, compact list mode, responsive layout, keyboard shortcuts, focus indicators, reduced-motion support and accessible status messages.

## Run

Serve this directory over HTTP(S), for example `python3 -m http.server 8765`, then open `http://localhost:8765`. ES modules and PDF workers cannot reliably load from a double-clicked `file://` page. GitHub Pages can serve the root directory directly.

Runtime files: `index.html`, `styles.css`, `workspace.css`, `boot.js`, `app.js`, `workspace.js`, `vendor/`. No build step is required. PDF.js is pinned and self-hosted; its license is in `vendor/PDFJS-LICENSE`.

## Verification

Run `npm install`, `npx playwright install chromium`, then `npm test` (the suite starts its own temporary local server). The browser smoke suite uses a generated 16-page PDF and intercepted bibliographic responses; it never sends real documents or paid AI requests. `CHROMIUM_PATH` may point to a preinstalled compatible Chromium. See `VALIDATION-0.8.0.md` for current verification. Optional real-file regression: `node tests/real-papers.cjs /absolute/paper.pdf [...]`; files stay local and no model service is called.

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

[電腦版預覽與啟動說明](desktop/README.md)。包含官方 Codex 登入、帳號可用模型選擇、PDF 問答與圖表分析整合；不需填 API 金鑰。Mac 使用者可從 [預覽版下載頁](https://github.com/guanbochen0622/freevpn-openscite/releases) 下載 DMG，無須安裝 Node.js。Apple 晶片與 Intel 的 Mac 啟動測試已通過；個人帳號登入後的分析仍待使用者實機驗證。
