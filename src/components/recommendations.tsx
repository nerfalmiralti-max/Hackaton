"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Language, Recommendation } from "@/lib/types";
import { translations } from "@/lib/i18n";

export function Recommendations({ language, onSelect }: { language: Language; onSelect?: (item: Recommendation) => void }) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const t = translations[language];
  useEffect(() => {
    let active = true;
    void fetch("/api/recommendations", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(body => {
      if (active && Array.isArray(body?.items)) setItems(body.items as Recommendation[]);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  return <section className="recommendations" aria-labelledby="recommendations-title">
    <div className="recommendations-heading"><h2 id="recommendations-title">{t.recommendationsTitle}</h2><span>NIS ХБН Актау</span></div>
    <div className="recommendation-list">{items.slice(0, 3).map(item => <article className="recommendation-card" key={item.id}>
      <button type="button" className="recommendation-main" onClick={() => onSelect?.(item)}>
        <strong>{item.title}</strong><p>{item.summary}</p>
        <span>{item.publishedAt ? new Intl.DateTimeFormat(language === "kk" ? "kk-KZ" : language, { day: "numeric", month: "short" }).format(new Date(item.publishedAt)) : ""} · {item.source}</span>
      </button>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t.recommendationSource}: ${item.title}`}>{t.recommendationSource} <ExternalLink size={12}/></a>
    </article>)}</div>
  </section>;
}
