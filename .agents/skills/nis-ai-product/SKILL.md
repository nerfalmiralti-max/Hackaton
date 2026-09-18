---
name: nis-ai-product
description: Preserve NIS AI school context, language parity, and source trust when changing product behavior.
---

Read AGENTS.md, src/lib/types.ts, src/lib/profile.ts, src/lib/i18n.ts, and the touched components.
1. Identify which of the demo flows changes: study priority, TriLingua, image task, or grounded material answer.
2. Keep UI navigation, errors, controls, and empty states localized in ru/kk/en.
3. Display only simulated school events from the provider; never imply official connectivity.
4. Keep source metadata separate from Markdown. NIS badges require configured school retrieval; personal uploads get uploaded-file badges.
5. Test the affected flow at desktop and 390px width, including failure and keyboard states.
