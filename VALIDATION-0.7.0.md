# OpenScite 0.7.0 / web 25.7 — reader revision 3

## Changes

- Mobile viewport-sized reading, width fitting, page controls, safe-area handling and a modal AI bottom sheet. The sheet shares the original assistant DOM and request state; escaping, resizing and navigating away restore it without losing typed questions.
- A local evidence map connects this document's saved claims, notes and highlights to pages. Exact-quote provenance and user-entered locations have distinct labels. Filtering, keyboard page actions and preview are available. No extra model request is made.
- Saved Q&A carries bounded source records. Restoring a conversation rechecks its quotes against the current document text. Changed OCR, foreign documents and unsupported page markers cannot silently regain verified links. Legacy answers remain readable as unverified text.
- Per-document/page OCR drafts, adopted text and formula/table results persist separately. IndexedDB reads are batched and writes serialized; connections are closed. Page/document switches cannot install stale results. Formulas can be copied as LaTeX.
- Evidence retrieval adds Chinese/Japanese character-pair matching, rare-term weighting and selected-passage anchoring. Rendering deduplicates pending page jobs while retaining the desktop nine/mobile three canvas budgets.
- Failed page indexing can be retried. Initial PDF parsing has a 45-second deadline and preserves the current document when replacement fails. Cached OCR updates the searchable-text status correctly.
- Dependency lock metadata corrected to match the four existing resolved package archives; dependency archives and integrity hashes are unchanged.

## Local verification

Passed syntax, search/citation logic, document structure, persistent evidence/map model, lifecycle/timeout, partial-index recovery, scientific text, bibliographic source and 364-entry/five-language tests. Eight account/IPC tests passed.

Full browser suite passed on root and deployment-subdirectory layouts: search/fallback/races, library, backup merge, generated 16-page PDF, navigation, highlights, exact scientific selection, page/figure previews, real local English OCR, structured formula/table fixtures, CSV, cancellation and error handling. Added checks cover mobile full-screen/sheet lifecycle (including rapid reopen), persisted drafts/structure, OCR correction invalidating old citations, map filtering/preview, cross-document isolation and index retry. Screenshots were reviewed in a CJK-font-enabled browser.

Opt-in real-paper rendering/index tests passed on the public arXiv PDFs for Attention Is All You Need (1706.03762, 15 pages) and BERT (1810.04805, 16 pages): all 31 pages rendered, no index errors or unmapped-character flags, 40,350 and 65,112 indexed characters, respectively; desktop/mobile canvas limits held. A damaged pre-existing local PDF exercised the timeout/rejection path and preserved the previously open paper. The private file is not included in this repository.

Repeat with `node tests/real-papers.cjs /absolute/paper.pdf [...]`; optional `INVALID_PDF=/absolute/damaged.pdf` exercises failed replacement. The runner blocks non-local network requests.

## Release verification

The release workflows run the expanded local/deployed browser suite twice, verify deployed source bytes, perform live bibliographic search, and run native Mac window/account/PDF/OCR/history/cache tests on both Apple Silicon and Intel (two passes). DMG publication requires successful web tests, native tests, bundled Codex checks and application signature verification. Workflow results for the release commit are the authoritative release status.

## Boundaries

This is engineering regression coverage, not a 30–50-paper blind study or a Moonlight head-to-head accuracy benchmark. Model answers, formula/table extraction and figure responses are controlled fixtures; OCR recognition itself is real. A matched quote proves the source text exists, not that the claim follows scientifically. OCR boxes retain the original recognition coordinates after transcript edits. Mobile testing uses Chromium viewport emulation, not physical iPhone/Android devices. Mac installers remain preview builds without Apple notarization.
