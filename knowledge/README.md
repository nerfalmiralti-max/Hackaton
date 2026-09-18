# Knowledge documents

This is a single-process local school-workspace demo. It has no official NIS integration. A document being uploaded, or indexed for retrieval, does not establish its authenticity or make its instructions trusted.

## Personal uploads

`POST /api/knowledge` accepts one multipart `file`: PDF, DOCX, UTF-8 TXT, or UTF-8 Markdown, at most 8 MiB. The route bounds the entire multipart body to 8 MiB plus 64 KiB of framing before parsing. Names reject paths, control characters, reserved characters and device names. `validateDocument` checks size and byte signatures; it is not a malware scanner or a complete DOCX archive validator. Content is never executed locally.

Each signed browser session owns a separate OpenAI vector store and up to 12 file records, including failed files. Upload returns `{ file: KnowledgeFile }` with `in_progress` (HTTP 201). `GET /api/knowledge` returns `{ files: KnowledgeFile[] }` and refreshes indexing statuses. Failed or cancelled indexing maps to `failed`. Delete failed files before replacing them if the session is full. `DELETE /api/knowledge/[id]` accepts only an owned ID, removes its vector association and underlying OpenAI file, then removes local metadata (HTTP 204). A missing upstream object is safe to retry.

All routes validate request origin. Upload attempts are limited to 6 per session per minute and 60 across the server per 24-hour window; deletion allows 20 per session and 120 server-wide per minute. Status reads allow 30 per session and 240 server-wide per minute. These in-memory counters reset on process restart and are not distributed quotas.

## Administrator material and provenance

Optional `OPENAI_VECTOR_STORE_ID` identifies administrator-provided material for the chat layer. This subsystem never uploads into or deletes that shared store, and never exposes it in route responses. Administrators must independently verify rights, authorship, school attribution and currency before presenting material as NIS material. Personal upload provenance means only "this session supplied this file". Neither filenames nor model-generated source claims establish official provenance. Citation badges must use actual API annotations or verified input provenance.

`physics-induction-demo.md` is synthetic educational content, not official NIS curriculum. Its English, Russian and Kazakh terminology is included for demonstration.

## Offline administrator textbook collection

`catalog.json` describes four user-supplied Grade 7/8 Kazakh/Russian books. Metadata includes subject, grade, language (`kk`, `ru`, `en`), original filename, PDF page count, private text path, and extraction counts/status. These are user-provided textbooks, not an official NIS connection or verified school attribution. Catalog metadata contains no original absolute paths or personal directory information.

Prepare the books entirely offline:

```powershell
node scripts/prepare-knowledge.mjs
# Optional custom source directory / Python installation:
node scripts/prepare-knowledge.mjs --source-dir 'C:\path\to\books' --python 'C:\path\to\python.exe'
```

The default source is the current user's Downloads directory. The script prefers bundled Codex Python with `pypdf`, then Python on PATH; `KNOWLEDGE_PYTHON` also overrides discovery. The inspected bundle has no `pdftotext`, so extraction uses `pypdf`. No new application dependency is needed. The script checks PDF magic bytes, source/output confinement, a 160 MiB input limit, a 2,000-page limit, and a 32 MiB text limit per book. PDFs that need a nonempty password are rejected. Empty-password encryption can be read. Embedded JavaScript, actions, attachments, links, and document instructions are never executed or followed.

Extracted UTF-8 files live only in ignored `.data/knowledge/*.txt`. Form feed (`\f`) separates physical PDF pages, including empty pages. `.data/knowledge/extraction-manifest.json` retains original absolute paths, source sizes/hashes and errors privately. Originals remain in Downloads and are not copied into the project. Do not commit or distribute originals, extracted copyrighted text, manifests, `.data`, or credentials.

Extraction does not perform OCR, interpret diagrams, or reconstruct mathematical notation. Counts of pages with text do not guarantee every formula/image is searchable. `no-text` means OCR is needed; partially empty pages remain in their original positions. Failed extractions remove stale text and are unavailable. Run preparation again after changing files; it refreshes catalog counts and the private extraction manifest.

Initial preparation results: Mathematics Grade 8 Part 2 Kazakh has 256/256 pages with text (436,422 characters); Chemistry Grade 8 Kazakh has 160/160 (368,214 characters); Mathematics Grade 8 Part 1 Russian has 192/192 (328,037 characters). The supplied Biology Grade 7 Kazakh PDF fails to open in pypdf, bundled Poppler and PDFium: missing EOF/trailer/xref structures or invalid PDF data. Its page count is unknown, status is `failed`, and it has no local searchable text. Replace it with a complete readable PDF and rerun preparation; this is not a verified scanned-only/OCR case.

`src/lib/server/local-knowledge.ts` exports `getLocalCatalog()` and `searchLocalKnowledge(query, { grade?, limit? })`. Catalog responses include `id`, `name`, `subject`, `grade`, `language`, `pages`, and actual local `available` status without private paths. Search tokenizes Unicode Kazakh/Russian/English text, ranks exact lexical matches in page chunks, returns at most four excerpts of 1,200 characters, and returns `[]` when nothing matches. There is no translation, stemming, semantic search, or fabricated fallback result. Parsed text/chunks are cached and refreshed when file/catalog metadata changes. Missing `.data` yields unavailable books and no excerpts.

Each result has a stable `<book-id>:page:<physical-PDF-page>` ID and a title containing the page number. Main integration should pass excerpts as bounded, untrusted context and use these input-derived IDs/titles for local provenance. Local availability must never be presented as successful OpenAI indexing. This CLI works without a browser session; request origin/session checks remain the responsibility of the route that calls the local service. The collection is shared administrator material in this single-process local demo.

Catalog entries also expose `vectorIndexed: boolean` and `vectorIndexStatus: "not-indexed" | "completed" | "pending" | "failed" | "unknown"`. `available` always means local text availability. Vector status comes only from a private index manifest record matching the current text's SHA-256; a changed file cannot inherit a prior version's indexed status. No manifest means `not-indexed`; malformed state or a configured store mismatch means `unknown`. `completed` describes the last persisted index operation, not a live connectivity check or official school connection. Currently all books are `not-indexed` and `vectorIndexed: false`.

Run the isolated lexical-search regression test (Node 24+, no network or copyrighted fixture):

```powershell
node --conditions=react-server --experimental-strip-types --test scripts/prepare-knowledge.test.mjs
```

## Optional OpenAI administrator indexing

Preview without credentials or network calls:

```powershell
node scripts/index-knowledge.mjs --dry-run
node scripts/index-knowledge.mjs --help
```

Dry-run is also the default. It validates the private extracted files and lists meaningful upload filenames, with no manifest mutation. Only when the user authorizes sending textbook text to OpenAI, configure `OPENAI_API_KEY` in ignored `.env.local`, ensure redistribution/use rights, and run:

```powershell
node scripts/index-knowledge.mjs --upload
```

The Node CLI loads `.env.local` and uses the installed official OpenAI SDK. It creates one shared administrator vector store, or reuses `OPENAI_VECTOR_STORE_ID` / the saved store. It uploads only extracted text with physical page labels, uses `vectorStores.files.createAndPoll`, checks for `completed`, and persists file IDs, hashes, store ID and statuses in ignored `.data/knowledge/index-manifest.json`. Repeated runs verify existing associations and reuse unchanged indexed files; interrupted uploads with saved file IDs resume. A lock prevents simultaneous index runs. If a process is forcibly killed, remove the stale `.data/knowledge/index.lock` only after confirming no index process is running. Authentication/network errors never silently create replacement stores.

Copy the resulting store ID into `OPENAI_VECTOR_STORE_ID` in `.env.local` and restart the application. The script makes no model generation calls. Upload/index/storage may incur costs; dry-run is not live verification. Changed text is uploaded as a new version, and prior file IDs remain in the manifest for administrator cleanup. The shared store has no automatic expiry; delete obsolete associations and underlying Files API objects explicitly. A crash between upstream creation and local persistence can leave an orphan that requires administrator cleanup. No live indexing has been performed for this preparation task.

## Expiry, cleanup and local state

Personal vector stores expire seven days after their OpenAI `last_active_at`. GET detects explicit expiry or a 404, marks retained file records failed and clears the obsolete personal store ID. The next upload creates a new personal store. It never silently re-indexes stale files or recreates stores on authentication, rate-limit or network failures. Stale records remain owned and deletable.

Vector-store expiry does not guarantee deletion of underlying OpenAI Files API uploads. Delete personal files explicitly while the session is accessible. There is no background cleanup worker. Upload API failures trigger file deletion, which also removes any association; if upstream cleanup fails, a failed owned record is retained for DELETE retry. If local metadata persistence itself fails and compensating deletion also fails, an administrator must clean up the orphan in OpenAI. Newly created empty personal stores are left to expire.

Only file metadata and the personal vector-store ID are persisted by the shared store helper in `.data/sessions`. File bytes are held in bounded request memory and sent to OpenAI, not saved as local documents. API keys remain server-only and are neither persisted here nor returned. Do not commit `.env` files, uploads, credentials or `.data`. Losing cookies, changing the session signing secret, or removing metadata can make files inaccessible through this UI; clean up upstream files before discarding state. Shared administrator material has its own administrator-managed retention policy.

`getKnowledge(sessionId): Promise<{ files: KnowledgeFile[]; vectorStoreId?: string }>` is a local snapshot for chat, without OpenAI polling. Pass only the ID returned by the signed `sessionId()` helper. Snapshot status can lag upstream until GET refreshes it. `refreshKnowledge`, `uploadKnowledge` and `deleteKnowledge` are server-only service functions; route handlers own origin checks and rate limits.

Public hosting requires authentication, persistent shared storage, distributed quotas and a durable cleanup process. Mocked tests do not verify live OpenAI indexing.
