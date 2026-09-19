import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRecommendations } from "../../src/lib/server/recommendations";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NIS_RECOMMENDATIONS_ENABLED", "false");
  vi.stubEnv("NIS_PUBLIC_NEWS_RSS_URL", "https://nisaktau.edupage.org/rss/news");
  vi.stubGlobal("fetch", vi.fn());
});

describe("school recommendation provider", () => {
  it("stays hidden when recommendations are disabled", async () => {
    expect(await getRecommendations()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes only non-AUTO official RSS items and caps them at three", async () => {
    vi.stubEnv("NIS_RECOMMENDATIONS_ENABLED", "true");
    vi.mocked(fetch).mockResolvedValue(new Response(`<?xml version="1.0"?><rss><channel>
      <item><title><![CDATA[Olympiad results]]></title><link>https://nisaktau.edupage.org/news/?newid=99</link><description><![CDATA[Students achieved strong results.]]></description><pubDate>Fri, 18 Sep 2026 10:00:00 GMT</pubDate><category>NEWS</category></item>
      <item><title>Internal timetable</title><link>https://nisaktau.edupage.org/news/?newid=3</link><description>Schedule</description><category>AUTO3</category></item>
    </channel></rss>`, { status: 200 }));
    expect(await getRecommendations()).toEqual([{ id: "https://nisaktau.edupage.org/news/?newid=99", title: "Olympiad results", summary: "Students achieved strong results.", publishedAt: "Fri, 18 Sep 2026 10:00:00 GMT", source: "NIS ХБН Актау", sourceUrl: "https://nisaktau.edupage.org/news/?newid=99" }]);
  });

  it("fails closed for a non-allowlisted RSS URL", async () => {
    vi.stubEnv("NIS_RECOMMENDATIONS_ENABLED", "true");
    vi.stubEnv("NIS_PUBLIC_NEWS_RSS_URL", "https://evil.example/rss/news");
    expect(await getRecommendations()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
