# OpenScite 25 validation

## Verified in an isolated Chromium browser

The browser tests use a generated 16-page PDF, controlled bibliographic responses and a mocked AI response. They do not transmit private papers or call paid AI services.

- Application initialization, query highlighting and hyphen tokenization.
- Search results, three-paper comparison tools, source citation formatting, library filters.
- PDF text rendering, bounded canvas retention, full-document search, page jumping and zoom.
- Position-anchored colored highlights across zoom and re-upload; stable SHA-256 document identity.
- PDF storage in IndexedDB and reopening from the library with annotations preserved.
- Bookmarks and page navigation.
- Mocked AI question submission, `store: false`, relevant page context and clickable response page references.
- Workspace backup download, validation and merge restoration; API keys excluded.
- Invalid year range rejection, request race protection, provider outage handling, OA-filter integrity and Crossref date-filter propagation.
- Numbered-reference binding, missing/ambiguous evidence and negation handling.
- Mobile document width, desktop reader layout and dark/light theme inspection.
- No uncaught page errors in the tested flows.
- Full browser suite repeated under `/freevpn-openscite/`, matching a GitHub Pages project subpath.

`npm run check` and `npm run test:logic` validate JavaScript parsing and isolated logic. `npm test` runs the browser suite with its own local HTTP server. Set `CHROMIUM_PATH` to use an existing Chromium installation; otherwise install Playwright Chromium first.

## Not verified by these tests

Live API reliability, actual paid-model accuracy, publisher CORS behavior, Safari/Firefox behavior, every scholarly PDF layout, large-document stress beyond the fixture, scanned-document OCR, and a production multi-user backend are not covered. UI presence or successful mocked responses are not evidence of scientific accuracy or commercial service readiness.
