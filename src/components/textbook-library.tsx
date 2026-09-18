"use client";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, FileWarning, Search } from "lucide-react";
import type { Language } from "@/lib/types";
import { translations } from "@/lib/i18n";
interface Book { id: string; name: string; subject: string; grade: number; language: string; pages: number; available: boolean }
interface Hit { id: string; title: string; text: string }
const copy = {
  ru: { title: "Учебники NIS", subtitle: "Материалы, предоставленные автором сайта", search: "Искать в учебниках", placeholder: "Тема или термин: теңдеу, квадратный корень…", pages: "стр.", available: "Доступен для поиска", failed: "PDF не читается", unavailable: "Файл не подготовлен", explain: "Объяснить отрывок", chemistry: "Химия", biology: "Биология", noResults: "Совпадений нет. Попробуй термин на языке учебника.", searchError: "Не удалось выполнить поиск. Попробуй ещё раз.", prompt: "Объясни этот отрывок из учебника простыми словами и укажи источник:", local: "Локальный поиск · материалы не отправлены в OpenAI" },
  kk: { title: "NIS оқулықтары", subtitle: "Сайт авторы ұсынған материалдар", search: "Оқулықтардан іздеу", placeholder: "Тақырып немесе термин: теңдеу, квадратный корень…", pages: "бет", available: "Іздеуге дайын", failed: "PDF оқылмайды", unavailable: "Файл дайындалмаған", explain: "Үзіндіні түсіндіру", chemistry: "Химия", biology: "Биология", noResults: "Сәйкестік жоқ. Оқулық тіліндегі терминді қолданып көр.", searchError: "Іздеу мүмкін болмады. Қайталап көр.", prompt: "Оқулықтағы осы үзіндіні қарапайым түсіндір және дереккөзін көрсет:", local: "Жергілікті іздеу · материалдар OpenAI-ға жіберілмеген" },
  en: { title: "NIS textbooks", subtitle: "Materials provided by the website creator", search: "Search textbooks", placeholder: "Topic or term: теңдеу, квадратный корень…", pages: "pages", available: "Searchable", failed: "Unreadable PDF", unavailable: "File not prepared", explain: "Explain this passage", chemistry: "Chemistry", biology: "Biology", noResults: "No matches. Try a term in the textbook's language.", searchError: "Search failed. Please try again.", prompt: "Explain this textbook passage simply and cite its source:", local: "Local search · materials not uploaded to OpenAI" },
};
export function TextbookLibrary({ language, onAsk }: { language: Language; onAsk: (text: string) => void }) {
  const t = translations[language]; const c = copy[language];
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { const controller = new AbortController(); void fetch("/api/materials", { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject()).then(body => setBooks(body.files)).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, []);
  async function search() {
    if (!query.trim() || loading) return;
    setLoading(true); setError(false);
    try { const response = await fetch(`/api/materials?q=${encodeURIComponent(query.trim())}`); if (!response.ok) throw new Error(); const body = await response.json(); setResults(body.results); setSearched(true); }
    catch { setError(true); } finally { setLoading(false); }
  }
  if (!books.length && !error) return null;
  return <section className="textbook-library" aria-label={c.title}>
    <div className="section-heading"><h2><BookOpen size={17}/>{c.title}</h2><span className="muted">{books.filter(b => b.available).length}/{books.length}</span></div><p className="muted">{c.subtitle}</p>
    <ul className="catalog-files">{books.map(book => <li className="catalog-row" key={book.id}><span className={`catalog-icon ${book.available ? "blue" : "rose"}`}>{book.available ? <BookOpen size={19}/> : <FileWarning size={19}/>}</span><div><strong>{book.subject === "Mathematics" ? t.maths : book.subject === "Chemistry" ? c.chemistry : c.biology} · {t.grade} {book.grade}{book.id.includes("p1") ? " · I" : book.id.includes("p2") ? " · II" : ""}</strong><small>{book.language === "kk" ? "ҚАЗ" : book.language === "ru" ? "РУС" : "ENG"} {book.pages ? `· ${book.pages} ${c.pages}` : ""}</small></div><span className="catalog-status"><span className="status-dot" data-status={book.available ? "completed" : "failed"}/>{book.available ? c.available : book.pages === 0 ? c.failed : c.unavailable}</span></li>)}</ul>
    <form className="textbook-search" onSubmit={e => { e.preventDefault(); void search(); }}><label className="search-field"><Search size={15}/><input aria-label={c.search} placeholder={c.placeholder} value={query} onChange={e => setQuery(e.target.value)} maxLength={500}/></label><button className="secondary-button" disabled={loading || !query.trim()} type="submit">{loading ? t.searching : c.search}</button></form>
    {error && <p className="error-banner" role="alert">{c.searchError}</p>}
    {searched && !results.length && <p className="muted">{c.noResults}</p>}
    <div className="textbook-results">{results.map(hit => <details key={hit.id}><summary>{hit.title}</summary><p>{hit.text}</p><button className="secondary-button" onClick={() => onAsk(`${c.prompt}\n${hit.title}\n${hit.text}`)}>{c.explain}<ChevronRight size={14}/></button></details>)}</div>
  </section>;
}
