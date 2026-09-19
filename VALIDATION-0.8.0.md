# OpenScite 0.8.0 / web 25.8 — multi-model desktop and reader revision

## Implemented

Provider-neutral text/image/schema adapters for OpenAI Responses, Gemini generateContent and Claude Messages. Existing official Codex account sign-in remains available on desktop. Gemini/Claude use the user's own API key, not a third-party chat-subscription sign-in. Model-list and explicit connection-test actions are provided. API requests use fixed provider hosts, reject redirects, validate inline images and impose size/time limits. Refusals, empty or truncated output and quota/authentication failures are explicit errors.

Single-provider mode is the default. Mixed mode asks 2–3 distinct services, then asks the primary service to synthesize with the original paper evidence and schema still present. Drafts are explicitly untrusted; disagreements must remain visible when unresolved. With fewer than two successful reviews, synthesis fails explicitly. Cancel stops subsequent reviews and synthesis. No automatic retry, silent provider substitution or automatic paid request occurs. Each operation shows provider/model execution records; new saved Q&A includes that provenance. Original quote matching still validates final grounded claims; model agreement is not evidence.

A unified model dialog, collapsible connection cards, clearer reading steps/tabs, larger answer text and grouped secondary reader tools reduce visual clutter. Five-language interface catalog retained and expanded. Windows-native testing caught CRLF leaking into Korean labels; the catalog parser now normalizes CRLF and UTF-8 BOM input, with an explicit regression test.

Desktop API credentials live in the main process, using session memory by default and optional OS-encrypted persistence. They never return to the renderer after saving. The app refuses to persist without secure encryption. Gemini/Claude browser credentials are session-only. Workspace exports exclude credentials.

Mac Apple Silicon/Intel packages remain supported. Windows x64 gets an NSIS installer with user-selectable installation directory. Release verification installs the actual Windows package, compares bundled source assets, runs the bundled Codex binary and opens/closes the installed app window.

## Verification

- Pure adapters: image conversion, scientific Unicode preservation, JSON schemas, response extraction/refusal/truncation, model listing, single/mixed request counts, partial failure, cancellation and credential-safe errors.
- Provider store: session-vs-persistent behavior, encrypted-file abstraction, deletion, unsupported providers, malformed keys and refusal of plaintext fallback.
- Full existing search/PDF/annotations/backup/scientific notation/OCR/figure/evidence/browser lifecycle regressions.
- Added browser flow with controlled Gemini/Claude responses through the real connection UI, independent image/schema requests, final synthesis, exact evidence links, quota failure, cancellation and no persisted browser secrets. Root and deployment-subdirectory layouts are tested.
- Native Mac/Windows window tests retain the existing account/PDF/OCR checks and add real OS-encrypted credential storage, session credentials, provider IPC routing, mixed synthesis and removal. Model responses are controlled fixtures; no personal API credentials are used by CI.
- Two-pass deployed-browser/real bibliographic-search and two-pass native Mac/Windows workflow matrices. Release jobs build both Mac architectures and Windows x64. Workflow results for the exact release commit are authoritative.

## Scope and limits

No paid Gemini/Claude account has been used for a live end-to-end answer in this session. Users can explicitly run the in-app model connection test with their own key and available quota. This is functional integration verification, not a model-quality benchmark. Mobile layout is browser-emulated, not physical-device certification. Mac packages are not Apple-notarized; Windows installer lacks a purchased publisher code-signing certificate.

Official integration references: [Gemini authentication](https://ai.google.dev/gemini-api/docs/get-started), [generateContent](https://ai.google.dev/api/generate-content), [Claude API](https://platform.claude.com/docs/en/api/overview), [Claude authentication boundaries](https://code.claude.com/docs/en/legal-and-compliance).
