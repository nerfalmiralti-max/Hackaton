"use client";

import { memo, useEffect, useState } from "react";
import { Check, Copy, Globe, LoaderCircle, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Language, Message, Source, SourceKind, Term } from "@/lib/types";

type ErrorCode = "NOT_CONFIGURED" | "UNAUTHORIZED" | "RATE_LIMITED" |
  "MODEL_UNAVAILABLE" | "UPSTREAM_ERROR" | "INVALID_REQUEST" |
  "NETWORK_ERROR" | "KNOWLEDGE_ERROR";

type Labels = {
  answer: string; thinking: string; stopped: string; truncated: string;
  empty: string; sources: string; terms: string; copy: string; copied: string;
  copyFailed: string; retry: string; fallback: string; general: string; web: string;
  noSchoolSource: string;
  kinds: Record<SourceKind, string>; errors: Record<ErrorCode, string>;
};

const labels: Record<Language, Labels> = {
  en: {
    answer: "NIS AI", thinking: "Preparing an answer…", stopped: "Generation stopped.",
    truncated: "The answer reached its length limit and may be incomplete.",
    empty: "No answer was returned.", sources: "Sources", terms: "TriLingua Term Bridge",
    copy: "Copy answer", copied: "Answer copied", copyFailed: "Could not copy the answer. Please try again.",
    retry: "Retry answer", fallback: "The available school materials do not contain enough information.",
    general: "Use general knowledge", web: "Search the web",
    noSchoolSource: "No school source was cited.",
    kinds: { nis: "NIS material", file: "Uploaded file", image: "Attached image", general: "General knowledge", web: "Web", context: "Demo school context" },
    errors: {
      NOT_CONFIGURED: "AI is not configured. Ask the demo administrator to configure it.",
      UNAUTHORIZED: "AI authorization failed. Ask the demo administrator to check the credentials.",
      RATE_LIMITED: "The request limit was reached. Please try again later.",
      MODEL_UNAVAILABLE: "The AI model is unavailable. Please try again later.",
      UPSTREAM_ERROR: "The AI service could not complete the answer. Please try again.",
      INVALID_REQUEST: "The request could not be accepted. Check your message and attachments.",
      NETWORK_ERROR: "The connection was interrupted. Check your connection and try again.",
      KNOWLEDGE_ERROR: "The school materials could not be accessed. Please try again.",
    },
  },
  ru: {
    answer: "NIS AI", thinking: "Готовим ответ…", stopped: "Генерация остановлена.",
    truncated: "Ответ достиг ограничения по длине и может быть неполным.",
    empty: "Ответ не получен.", sources: "Источники", terms: "TriLingua — термины",
    copy: "Скопировать ответ", copied: "Ответ скопирован", copyFailed: "Не удалось скопировать ответ. Попробуйте ещё раз.",
    retry: "Повторить ответ", fallback: "В доступных школьных материалах недостаточно информации.",
    general: "Использовать общие знания", web: "Искать в интернете",
    noSchoolSource: "Школьный источник не указан.",
    kinds: { nis: "Материал NIS", file: "Загруженный файл", image: "Прикреплённое изображение", general: "Общие знания", web: "Интернет", context: "Демоконтекст школы" },
    errors: {
      NOT_CONFIGURED: "ИИ не настроен. Обратитесь к администратору демоверсии.",
      UNAUTHORIZED: "Ошибка авторизации ИИ. Попросите администратора проверить учётные данные.",
      RATE_LIMITED: "Достигнут лимит запросов. Попробуйте позже.",
      MODEL_UNAVAILABLE: "Модель ИИ недоступна. Попробуйте позже.",
      UPSTREAM_ERROR: "Сервис ИИ не смог завершить ответ. Попробуйте ещё раз.",
      INVALID_REQUEST: "Запрос не принят. Проверьте сообщение и вложения.",
      NETWORK_ERROR: "Соединение прервано. Проверьте подключение и повторите попытку.",
      KNOWLEDGE_ERROR: "Не удалось получить доступ к школьным материалам. Попробуйте ещё раз.",
    },
  },
  kk: {
    answer: "NIS AI", thinking: "Жауап дайындалуда…", stopped: "Жауап құру тоқтатылды.",
    truncated: "Жауап ұзындық шегіне жетті және толық болмауы мүмкін.",
    empty: "Жауап алынбады.", sources: "Дереккөздер", terms: "TriLingua — терминдер",
    copy: "Жауапты көшіру", copied: "Жауап көшірілді", copyFailed: "Жауапты көшіру мүмкін болмады. Қайталап көріңіз.",
    retry: "Жауапты қайталау", fallback: "Қолжетімді мектеп материалдарында ақпарат жеткіліксіз.",
    general: "Жалпы білімді пайдалану", web: "Интернеттен іздеу",
    noSchoolSource: "Мектеп дереккөзіне сілтеме берілмеген.",
    kinds: { nis: "NIS материалы", file: "Жүктелген файл", image: "Тіркелген сурет", general: "Жалпы білім", web: "Интернет", context: "Мектептің демоконтексті" },
    errors: {
      NOT_CONFIGURED: "ЖИ бапталмаған. Демонұсқа әкімшісіне хабарласыңыз.",
      UNAUTHORIZED: "ЖИ авторизациясы сәтсіз аяқталды. Әкімшіден тіркелгі деректерін тексеруді сұраңыз.",
      RATE_LIMITED: "Сұраулар шегіне жеттіңіз. Кейінірек қайталап көріңіз.",
      MODEL_UNAVAILABLE: "ЖИ моделі қолжетімсіз. Кейінірек қайталап көріңіз.",
      UPSTREAM_ERROR: "ЖИ қызметі жауапты аяқтай алмады. Қайталап көріңіз.",
      INVALID_REQUEST: "Сұрау қабылданбады. Хабарлама мен тіркемелерді тексеріңіз.",
      NETWORK_ERROR: "Байланыс үзілді. Қосылымды тексеріп, қайталап көріңіз.",
      KNOWLEDGE_ERROR: "Мектеп материалдарына қол жеткізу мүмкін болмады. Қайталап көріңіз.",
    },
  },
};

function safeWebUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const MarkdownBody = memo(function MarkdownBody({ content, busy }: { content: string; busy: boolean }) {
  return (
    <div className="answer-body" aria-busy={busy}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore", throwOnError: false, maxExpand: 1000 }]]}
        skipHtml
        components={{
          a: ({ href, children }) => {
            const url = safeWebUrl(href);
            return url ? <a href={url} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>;
          },
          // Generated Markdown must not load remote images or tracking pixels.
          img: ({ alt }) => alt ? <span>{alt}</span> : null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function SourceList({ sources, text }: { sources: Source[]; text: Labels }) {
  return (
    <section aria-label={text.sources}>
      <h3>{text.sources}</h3>
      <ul className="source-list">
        {sources.map((source) => {
          const url = safeWebUrl(source.url);
          const title = url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.title}</a> : <span>{source.title}</span>;
          return (
            <li className="source-card" key={source.id}>
              <span className="source-badge" data-kind={source.kind}>{text.kinds[source.kind]}</span>
              {source.excerpt ? (
                <details>
                  <summary>{source.title}</summary>
                  <p>{source.excerpt}</p>
                  {url ? title : null}
                </details>
              ) : title}
              {source.kind === "general" ? <p><small>{text.noSchoolSource}</small></p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TermBridge({ terms, text }: { terms: Term[]; text: Labels }) {
  return (
    <section className="term-bridge" aria-label={text.terms}>
      <h3>{text.terms}</h3>
      <div className="term-grid">
        {terms.map((term, index) => (
          <dl className="term-card" key={`${term.en}-${index}`}>
            <dt>EN</dt><dd lang="en">{term.en}</dd>
            <dt>RU</dt><dd lang="ru">{term.ru}</dd>
            <dt>KZ</dt><dd lang="kk">{term.kk}</dd>
          </dl>
        ))}
      </div>
    </section>
  );
}

function AnswerActions({ content, busy, text, onRetry }: {
  content: string; busy: boolean; text: Labels; onRetry: () => void;
}) {
  const [feedback, setFeedback] = useState<{ content: string; result: "copied" | "failed" } | null>(null);
  const [copying, setCopying] = useState(false);
  const currentFeedback = feedback?.content === content ? feedback.result : null;

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function copyAnswer() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(content);
      setFeedback({ content, result: "copied" });
    } catch {
      setFeedback({ content, result: "failed" });
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="answer-actions">
      <button type="button" className="icon-button" onClick={copyAnswer}
        disabled={busy || copying || !content.trim()} aria-label={currentFeedback === "copied" ? text.copied : text.copy}
        title={currentFeedback === "copied" ? text.copied : text.copy}>
        {currentFeedback === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
      <button type="button" className="icon-button" onClick={onRetry} disabled={busy} aria-label={text.retry} title={text.retry}>
        <RotateCcw size={16} aria-hidden="true" />
      </button>
      <span role="status" className={currentFeedback === "failed" ? "error-banner" : "sr-only"}>
        {currentFeedback === "copied" ? text.copied : currentFeedback === "failed" ? text.copyFailed : ""}
      </span>
    </div>
  );
}

function Fallback({ text, busy, onFallback }: { text: Labels; busy: boolean; onFallback: (web: boolean) => void }) {
  return (
    <div className="fallback">
      <p>{text.fallback}</p>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => onFallback(false)}>{text.general}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => onFallback(true)}>
        <Globe size={16} aria-hidden="true" /> {text.web}
      </button>
    </div>
  );
}

export function Answer({ message, language, onRetry, onFallback }: {
  message: Message; language: Language; onRetry: () => void; onFallback: (web: boolean) => void;
}) {
  const text = labels[language];
  const busy = message.status === "streaming";
  const hasError = message.status === "error" || Boolean(message.errorCode);
  const error = message.errorCode && Object.hasOwn(text.errors, message.errorCode)
    ? text.errors[message.errorCode as ErrorCode] : text.errors.UPSTREAM_ERROR;

  return (
    <article className="answer" lang={language} aria-label={text.answer}>
      <h2 className="answer-heading">{text.answer}</h2>
      {message.content ? <MarkdownBody content={message.content} busy={busy} /> : null}
      {busy ? <div className="thinking" role="status"><LoaderCircle size={16} aria-hidden="true" /> {text.thinking}</div> : null}
      {hasError ? <p className="error-banner" role="alert">{error}</p> : null}
      {message.status === "stopped" ? <p role="status">{text.stopped}</p> : null}
      {message.truncated ? <p role="status">{text.truncated}</p> : null}
      {!message.content && !busy && !hasError && message.status !== "stopped" && !message.needsFallback ? <p>{text.empty}</p> : null}
      {message.sources?.length ? <SourceList sources={message.sources} text={text} /> : null}
      {message.terms?.length ? <TermBridge terms={message.terms} text={text} /> : null}
      {message.needsFallback ? <Fallback text={text} busy={busy} onFallback={onFallback} /> : null}
      <AnswerActions key={message.id} content={message.content} busy={busy} text={text} onRetry={onRetry} />
    </article>
  );
}
