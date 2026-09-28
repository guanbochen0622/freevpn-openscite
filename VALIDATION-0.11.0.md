# PaperLume 0.11.0 / web 25.11 verification

Tested application commit: `e5d24ba3791a1abf15bd87181a0987d1430b4df0`.

- Repository renamed to https://github.com/guanbochen0622/paperlume .
- Website: https://guanbochen0622.github.io/paperlume/ .
- Published preview installers: https://github.com/guanbochen0622/paperlume/releases/tag/desktop-32 .
- Local syntax, logic and locale checks passed; desktop unit tests: 15 passed.
- Branch verification: https://github.com/guanbochen0622/paperlume/actions/runs/36334068306 — all eight jobs passed.
- Main verification: https://github.com/guanbochen0622/paperlume/actions/runs/36334247318 — all eight jobs passed, including two deployed-website checks and two native-window checks per platform (Mac arm64, Mac x64, Windows x64).
- Packaging: https://github.com/guanbochen0622/paperlume/actions/runs/36334247339 — web root/subpath tests, all three builds, Windows installation/launch/close, Mac bundle signature checks and release publication passed.
- Pages deployment: https://github.com/guanbochen0622/paperlume/actions/runs/36334246735 — passed. Browser inspection confirmed PaperLume v25.11 and the new GitHub link.

## Rename compatibility

UI branding, locale strings, npm packages, desktop executable/installer names, IPC channels, renderer bridge, source links and build workflows use PaperLume. Legacy storage keys, IndexedDB database, backup formats, cloud-backup filename, desktop application ID, custom origin and profile directory remain unchanged to preserve compatibility. The desktop profile override respects explicit user-data paths used by native tests. Existing users' real profiles have not been individually verified after upgrade; these checks do not claim that coverage.

## Remaining product limitations

Google login still requires owner-provided OAuth configuration. Personal ChatGPT login and live paid model analysis require the user's own account and available usage; automated tests do not establish successful live analysis for every account. Mac installers use an ad-hoc signature, and Windows installers have no purchased code-signing certificate. These are preview installers. Citation stance is grounded inference, not independent scientific verification.
