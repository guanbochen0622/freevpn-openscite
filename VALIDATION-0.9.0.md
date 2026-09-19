# OpenScite 0.9.0 validation scope

## Changes and regression gates

- Official bundled Codex 0.154.0 protocol schema confirms `chatgptDeviceCode`, `verificationUrl`, `userCode` and login completion notifications. Unit tests cover browser-opening failure, cancellation of previous login, device fallback, stale notifications and rejected login hosts. Native/browser UI tests inject completion errors and assert displayed device codes.
- Search result clicks load an actual PDF fixture into the reader. Alternate-source recovery, HTML/login-page rejection, failed replacement preservation, native IPC buffer transport, bounded downloads and redirects are tested.
- Citation regression uses a generated real PDF, downloads it and extracts the target numbered reference before classifying a support inference. AI inference with an invented quote is downgraded to unknown. Existing negation, exact DOI, fabricated evidence and scientific-exponent checks remain.
- Exactly three visible provider options. Optional API-mode Gemini/Claude image/schema/mixed/cancellation tests remain. Official website handoff validates returned JSON, waits for the user, supports cancellation and records manual provenance. It does not authenticate to, scrape or reuse third-party website sessions.
- Full browser regression runs at root and repository subpath. Existing real local OCR, persisted corrections, formula/table handling, library, selection, page navigation, evidence history and mobile tests remain.
- Mac arm64, Mac Intel and Windows x64 run the native reader suite and unit tests in CI. Windows additionally builds an installer, installs it and opens the installed app. Release is gated on build and web-test success; the verification workflow independently runs two browser and six native jobs.

## Limits

No user's real account credentials or paid AI requests are used in automated tests. Real account login and entitlement must be confirmed on the user's computer. A login repair is not proof that a particular account is authorized. Gemini/Claude automatic subscription login is not implemented: their no-key route is clearly labeled manual official-website handoff, with API automation optional.

Browser-only CORS, publisher authentication/paywalls, unavailable full text and provider quotas remain external constraints. Citation inference is not scientific verification; automatic full-text matching currently supports numbered references. Only the first 12 downloadable citing PDFs are attempted automatically; others have individual actions. No claim of zero bugs or exhaustive coverage is made.

Installers remain preview builds without Apple notarization or a Windows publisher certificate.
