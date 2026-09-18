# Observed Verification

Recorded 2026-09-18. Mocked checks are not live OpenAI verification.

## Checks

- `npm run lint` and `npm run typecheck`: passed in this task.
- `npm test`: 154 tests passed across six files in this task. Main also reported these checks passing.
- `npm run build`: main reported a successful production build without warnings.
- Final full Edge suite, run by main: **23 passed, 1 failed** out of 24. The historical failure was the mobile Teach Me test attempting New conversation while its sidebar was closed. The test now explicitly opens the menu and waits for `.sidebar.open`.
- Focused mobile Teach Me rerun by main: the latest shared `.artifacts/playwright/.last-run.json` reports `status: "passed"` and no failed tests. This is the targeted rerun after the mobile navigation fix, not a new complete full-suite run.
- Installed browser: Microsoft Edge at `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. Playwright is restricted to `tests/e2e`, with unit tests excluded.
- `node --check scripts/live-smoke.mjs`: passed. Without `--run-live`, the script printed its skip message and made no API calls.

## Browser Coverage

Projects use 390x844, 1280x800 and 1440x900 viewports. The suite covers RU/KK/EN switching without generation, native JPEG preview, mocked NDJSON chat with Markdown/math/source chips/term bridge, tutoring turns and hints, observed-mistake memory, memory sent on a new task, stop/retry, mobile navigation and saved profile persistence.

Runtime `pageerror` and console errors are captured per test. Only the expected `/api/chat` HTTP 503 resource error is excluded. Overflow checks passed for workspace, image preview, answer, profile and Knowledge views in main's final full run.

The original origin mismatch returned 403 for the browser's `127.0.0.1` origin. After main's fix, a direct real POST using that origin returned `503 NOT_CONFIGURED`; main's final missing-key browser cases passed. Key absence was checked before sending any real chat request.

## Local Materials

Real `GET /api/materials?q=квадрат` returned HTTP 200: four catalog entries, three locally available books, zero vector-indexed files, and three excerpts bounded to 1200 characters with book/page provenance. Main's final suite also passed real Russian and Kazakh searches (`квадрат`, `теңдеу`) and the unavailable biology check at all three widths.

The catalog records 608 extracted pages across three Grade 8 mathematics/chemistry books. Grade 7 Kazakh biology is recorded as failed extraction and unavailable. Local lexical retrieval is verified; semantic relevance, OCR quality and OpenAI textbook indexing are not.

## Artifacts and Limits

Fifteen screenshots are saved at `.artifacts/screenshots/{mobile390,laptop1280,desktop1440}-{workspace,image-preview,answer,profile,knowledge}.png`. Private failure screenshots, browser-error attachments, traces and the HTML report are under `.artifacts`.

The server reported `configured: false`, default model `gpt-5.6-luna`, and no personal files. Live API smoke was **not run**. Chat generations are mocked except for the guarded real missing-key error test. These checks do not prove account model access, actual OpenAI citations, live tutoring behavior or successful File Search indexing. Automatic saved-manifest store discovery is documented in README but has not been live-verified here.
