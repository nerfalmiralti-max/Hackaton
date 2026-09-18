import { z } from "zod";
import type { Term } from "./types";
const termsSchema = z.array(z.object({ en: z.string().min(1).max(120), ru: z.string().min(1).max(120), kk: z.string().min(1).max(120) })).max(5);
export function splitAnswer(raw: string): { text: string; terms: Term[] } {
  const index = raw.indexOf("```term-bridge");
  const tutorIndex = raw.indexOf("```tutor-state");
  const first = [index, tutorIndex].filter(i => i >= 0).sort((a,b) => a-b)[0];
  if (first === undefined) return { text: raw, terms: [] };
  const text = raw.slice(0, first).trimEnd();
  if (index < 0) return { text, terms: [] };
  try {
    const json = raw.slice(index + 14).replace(/^\s*/, "").split("```")[0].trim();
    const parsed = termsSchema.safeParse(JSON.parse(json));
    return { text, terms: parsed.success ? parsed.data : [] };
  } catch { return { text, terms: [] }; }
}
export function safeWebUrl(url: string): string | undefined {
  try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : undefined; } catch { return undefined; }
}
