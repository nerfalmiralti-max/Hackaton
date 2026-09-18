---
name: quality-gate
description: Verify a NIS AI change before demo, commit, or handoff.
---

Run npm run lint, npm run typecheck, npm test, npm run build, then npm run test:e2e.
Check Russian/Kazakh/English, missing-key error, image preview, stop/retry, knowledge empty/indexing/error states, and 390px mobile overflow.
Use mocked responses for deterministic UI/protocol tests. Never describe them as live OpenAI verification.
Search .next/static for credential environment names and ensure no actual .env files are staged.
For live verification use npm run test:live; it is opt-in, incurs API usage, and cleans its temporary resources.
Report remaining account/configuration limitations and leave a working local server URL.
