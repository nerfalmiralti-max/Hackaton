# NIS AI

A school learning website created by **Толеш Альтаир, NIS ХБН Актау**. OpenAI provides the foundation AI technology. Profiles begin empty and are configured by users. No school events, assignments, learning scores or recommendations are seeded; this is not an official NIS integration.

Chat in Russian, Kazakh or English, render Markdown and mathematics, preview task photos, search uploaded materials, and display source provenance. The materials catalog distinguishes locally extracted textbooks from their OpenAI indexing status; local text search works without an API key. TriLingua adds academic terms in all three languages. Teach Me asks one question at a time, offers targeted hints, and checks independent understanding. Lightweight learning memory records topics and observed mistakes in browser session storage and can inform a reminder on a matching new task; it is not a score, diagnosis or verified student record.

## Run locally

Use Node.js 22 or newer. Install with `npm ci`, configure private `.env.local` using the variable names in `.env.example`, and run `npm run dev`. Open [127.0.0.1:3000](http://127.0.0.1:3000).

`OPENAI_API_KEY` stays on the server. `OPENAI_MODEL` defaults to `gpt-5.6-luna`; the account must have access to the configured model. An optional `OPENAI_VECTOR_STORE_ID` overrides the administrator materials store. Otherwise, after successful `npm run knowledge:index`, the server automatically reads the store ID from the saved `.data/knowledge/index-manifest.json` when at least one file has completed indexing; no manual environment ID is required. `SESSION_SECRET` can fix cookie signing across restarts. `APP_ORIGIN` must match the local browser origin. Missing credentials produce a localized setup error without contacting OpenAI.

## Materials and architecture

Next.js server routes own OpenAI SDK calls, upload validation, rate limits and signed session cookies. Personal file IDs and vector stores are checked against session ownership before use. Chat uses one bounded Responses generation per answer, native image input, native File Search citations, and web search only when explicitly enabled. Model-written source claims do not create citation badges.

Large administrator-provided textbooks are extracted into private `.data/knowledge`, with non-content metadata in `knowledge/catalog.json`. The current catalog records three successfully extracted books (608 pages): Grade 8 mathematics in Kazakh (part 2, 256 pages), Grade 8 chemistry in Kazakh (160 pages), and Grade 8 mathematics in Russian (part 1, 192 pages). Grade 7 biology in Kazakh has failed extraction and is not ready for retrieval. Catalog entries alone do not mean OpenAI indexing is complete.

```sh
npm run knowledge:prepare
npm run knowledge:check
npm run knowledge:index
```

Preparation and `knowledge:check` are offline. `knowledge:index` invokes `--upload`, explicitly sends extracted textbook text to OpenAI and can incur charges; consult the saved private index manifest for indexing status. Keep `.data`, original textbooks, uploads, credentials and `.env.local` out of Git. Personal UI uploads are limited to 8 MB; administrator extraction is the route for larger books. Scanned pages need OCR before useful text retrieval.

The OpenAI API does not support fine-tuning `gpt-5.6-luna`, as listed in the official [model capabilities](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Use retrieval-augmented generation (RAG) with File Search for textbooks; indexing does not retrain the foundation model. See OpenAI's [File Search guide](https://developers.openai.com/api/docs/guides/tools-file-search) and [native vision guide](https://developers.openai.com/api/docs/guides/images-vision).

This demo stores session data locally and coordinates requests in one process. Public hosting needs authentication, persistent shared storage and shared rate limiting. Browser memory lasts only for its session; restarting without a fixed signing secret can invalidate local ownership cookies.

## Vercel deployment

`vercel.json` explicitly selects Next.js, `npm ci`, `npm run build`, and `.next` output so a project originally imported with the "Other" preset does not deploy an empty static directory. In Vercel, keep Root Directory at the repository root, Production Branch at `main`, and assign the production domain to this project. A platform `404 NOT_FOUND` can also indicate a missing deployment or domain assignment; these dashboard settings cannot be changed by Git alone.

Configure secrets privately in Vercel Environment Variables; local `.env.local` is not deployed. This application's session ownership and upload storage are still designed for a single-process local demo. A working hosted page does not make serverless file ownership or public AI access production-ready; shared storage and authentication are required before public use.

## Verification Commands

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Start the server on port 3000 before E2E tests. They use installed Edge (or Chrome), isolate `tests/e2e` from unit tests, mock chat streams, and check 390px, 1280px and 1440px viewports. Screenshots are saved under `.artifacts/screenshots`. On Windows, set `$env:E2E_START_SERVER='1'` to let Playwright start or reuse the server. `PLAYWRIGHT_BROWSER_CHANNEL` can override browser selection.

Live verification is separate and opt-in: `npm run test:live -- --run-live`. It requires a privately configured key, makes three bounded model calls (text, tiny native image, temporary File Search), and attempts to delete both temporary upload and vector store in `finally`. It may incur charges; it does not validate OCR quality or the real textbook collection. Actual observed results are recorded in [docs/verification.md](docs/verification.md).
