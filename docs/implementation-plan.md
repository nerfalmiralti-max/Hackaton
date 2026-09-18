# NIS AI implementation

## Product and design
An immediately usable student workspace: slim left navigation, a spacious central conversation, and a right-hand contextual study agenda. White and cool gray surfaces, ink text, cobalt actions, restrained teal and amber subject/status accents. Segoe UI for multilingual body text, Georgia for the restrained empty-state greeting. The signature is the school-context rail paired with a three-language Term Bridge.

## Architecture
Next.js App Router / React / TypeScript; localized client workspace and server-only OpenAI, session, knowledge, and context services. Signed anonymous browser-session cookie; per-session vector store; optional shared read-only school store. Local JSON state is suitable for a single Node process. Chat history remains in browser session storage; image bytes are not persisted there.

## Sequence
1. Scaffold contracts, security, context selection, and tests.
2. Implement validated upload/index/list/delete and Responses streaming with annotation-based sources.
3. Build localized chat, knowledge, profile, image input, term cards, and responsive layout.
4. Test failure paths, protocol fixtures, language switching, mobile, secrets separation, build, and live smoke when credentials exist.

## Key boundaries
No fake AI fallback and no pretend connected documents. An unanswered school-only question offers explicit general-knowledge/web continuation. School event dates are relative simulated fixtures. Images use native model vision. TriLingua terms share the answer generation, without a second translation call.
