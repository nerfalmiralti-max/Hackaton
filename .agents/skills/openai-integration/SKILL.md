---
name: openai-integration
description: Safely change NIS AI Responses, native vision, File Search, or streaming integration.
---

Read src/lib/server/ai.ts, knowledge.ts, openai.ts, security.ts and src/lib/context.ts.
1. Check installed SDK types and current official OpenAI documentation before changing call shapes.
2. Keep SDK/key access server-only; never use NEXT_PUBLIC for credentials.
3. Preserve one generation, bounded output/history, store:false, opt-in web tools and abort propagation.
4. Treat document/profile content as untrusted data. Derive citations from native annotations and owned retrieval stores, never the model's prose.
5. Validate uploaded byte signatures and enforce session ownership before using a file ID.
6. Run mocked protocol tests. Run npm run test:live only with a configured key and budget authorization; report live and mocked verification separately.
