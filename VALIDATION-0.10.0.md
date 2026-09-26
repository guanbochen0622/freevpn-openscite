# Verification scope — 0.10.0

This release removes API-provider adapters, credentials and manual handoff from the runtime. ChatGPT browser/device-code login remains the official Codex flow. Response speed maps to `turn/start.serviceTierForTurn` (`default` / `fast`) independently of effort. Tests validate protocol wiring and errors; no paid user account was available to measure live response latency.

Browser regression covers actual generated PDF rendering and quote geometry in the main reader and preview; real local OCR; persistent drafts and conversation evidence; failed PDF replacement; backup/restore; UI and request cancellation; formula structure; guest/Google account separation with mocked OAuth and Drive calls. The broad suite runs at the root and a hosted subpath. Native platform tests additionally exercise the Electron bridge and official logged-out Codex server.

Google OAuth configuration is missing and live sign-in is not verified. The native PKCE/loopback flow is implemented and fixture-tested, but also remains disabled until an installed-application OAuth registration is configured. Google integration tests are explicitly mocked. PDF bytes are not included in cloud snapshots.

Citation support is verified using actual PDF parsing of target-bound references and XML reference-ID fixtures. External coverage and available full text vary. A direction classification is inference from located passages, never a claim of independent scientific replication. Unmatched quotes are not highlighted.

Build and native test results will be recorded after CI completion. The macOS build is ad-hoc signed, not notarized; Windows is unsigned.
