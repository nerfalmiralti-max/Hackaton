import "server-only";
import { z } from "zod";

export const DEFAULT_NEWS_RSS_URL = "https://nisaktau.edupage.org/rss/news";
const allowedOrigin = "https://nisaktau.edupage.org";
const cacheTtl = 10 * 60 * 1000;
let cache: { expires: number; url: string; items: Recommendation[] } | undefined;
let pending: Promise<Recommendation[]> | undefined;

const recommendationSchema = z.object({
  id: z.string().min(1).max(180), title: z.string().min(1).max(180), summary: z.string().min(1).max(500),
  publishedAt: z.string().optional(), source: z.literal("NIS ХБН Актау"), sourceUrl: z.string().url(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function tag(item: string, name: string) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(item);
  return match ? decodeXml(match[1]) : "";
}
function sourceUrl() {
  const value = (process.env.NIS_PUBLIC_NEWS_RSS_URL || DEFAULT_NEWS_RSS_URL).trim();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== allowedOrigin || url.pathname !== "/rss/news") return undefined;
    return url.href;
  } catch { return undefined; }
}

export async function getRecommendations() {
  if (process.env.NIS_RECOMMENDATIONS_ENABLED?.trim().toLowerCase() !== "true") return [];
  const url = sourceUrl();
  if (!url) return [];
  if (cache && cache.url === url && cache.expires > Date.now()) return cache.items;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8_000) });
      if (!response.ok || response.headers.get("location")) return [];
      const xml = await response.text();
      const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(match => match[1]);
      const normalized = items.flatMap((item, index) => {
        const title = tag(item, "title");
        const summary = tag(item, "description");
        const link = tag(item, "link");
        const category = tag(item, "category");
        const publishedAt = tag(item, "pubDate");
        const parsed = recommendationSchema.safeParse({ id: link || `rss-${index}`, title, summary, publishedAt: publishedAt || undefined, source: "NIS ХБН Актау", sourceUrl: link });
        return category.toUpperCase().startsWith("AUTO") || !parsed.success ? [] : [parsed.data];
      }).flat().slice(0, 3);
      cache = { expires: Date.now() + cacheTtl, url, items: normalized };
      return normalized;
    } catch { return cache?.items ?? []; }
    finally { pending = undefined; }
  })();
  return pending;
}
