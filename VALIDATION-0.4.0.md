# OpenScite 0.4.0 — reading flow improvements

Compared the public Moonlight feature description (https://www.themoonlight.io/tw), focusing on context-aware explanation, reading without interruption, and note collection. This is not a claim of feature parity or superiority based on a controlled competitor evaluation.

Changes:
- Keep the latest answer above a collapsed conversation history.
- Safe paragraph / bold / heading formatting with validated page references; no raw HTML execution.
- Copy an answer or save it as a persistent note with the selected quote and page.
- Return to the previous reading page after an evidence detour; reset the trail when changing papers.
- Explicitly clear selected context; fix stale selection panels.
- Do not turn PDF pages behind an open preview dialog.
- Concise passage explanations and direct Q&A answers; three localized suggested questions.
- Compact figure preview and five-language controls.

Verification:
- Existing logic, PDF lifecycle, partial indexing, locale and desktop bridge tests.
- Added browser regression checks for notes, page return, clearing selection, inert HTML, invalid page references, prompt population, collapsed history and dialog key handling.
- verify-all workflow runs two independent passes of local and deployed browser tests, live bibliographic search, and both Mac architectures.

Limits: AI responses in automated tests are controlled fixtures. These tests do not establish scientific correctness or verify inference using the user's ChatGPT subscription. Native Mac builds remain preview builds without Apple notarization.
