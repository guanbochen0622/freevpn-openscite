# OpenScite 0.6.0 — document understanding

## Changes

Local page OCR with editable drafts, selectable word boxes for scanned pages, searchable corrected text, original-text restoration, cancellation, timeout and per-document/page IndexedDB cache. English engine and data are bundled; optional Traditional/Simplified Chinese, Japanese and Korean language data download on first use.

Explicit formula/table analysis sends a fresh bounded-resolution page image through the existing account/API bridge. Formula output is rendered with KaTeX in untrusted mode; tables validate dimensions and export quoted CSV with spreadsheet formula injection neutralization. Model JSON never appears as reader prose.

Selection explanations and paper Q&A receive page images and numbered evidence passages. Each claim's quoted source is matched exactly against the supplied passage, including scientific symbols. Missing/invented sources produce an unverified warning, not a fabricated source button. A verified text match establishes provenance, not semantic entailment or scientific truth.

## Verification scope

- Pure tests: exponent distinction, invented citation rejection, structured response validation, OCR word geometry, table shape, bounded context, CSV safety; existing lifecycle, search, language and account bridge tests.
- Browser and native Mac tests: real Tesseract recognition on an image-only scientific PDF, selectable OCR text, searchable index, corrections, formula/table rendering, exact source passage preview, malformed model output and OCR cancellation.
- Model responses are controlled fixtures. No claim of real-model transcription accuracy, perfect math recognition, or account quota availability is made.
- Two-pass browser/live-site and Apple Silicon/Intel Mac CI workflows are the release verification source.

## Limits

OCR is explicitly page-by-page and does not automatically process an entire paper. Correcting the transcript changes search/AI text; on-page word boxes retain the original OCR draft coordinates. Complex/blurred formulas and tables require original-page review. AI structure extraction is a draft, not a deterministic scientific parser. Existing saved answers keep their prior content. Mac builds remain preview builds without Apple notarization.
