"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import type { Language } from "@/lib/types";
import type { TimetableResponse } from "@/lib/server/timetable";
import { translations } from "@/lib/i18n";

const SOURCE_URL = "https://nisaktau.edupage.org/timetable/";
const CLASS_KEY = "nis-ai-timetable-class-v1";
const TIME_ZONE = "Asia/Aqtau";

type TimetableProps = { language: Language };
function dateLabel(date: string, language: Language) { return new Intl.DateTimeFormat(language === "kk" ? "kk-KZ" : language, { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE }).format(new Date(`${date}T12:00:00Z`)); }
function todayInAktau() { return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function weekShift(date: string, amount: number) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount * 7); return value.toISOString().slice(0, 10); }
function currentState(lesson: { date: string; startTime?: string; endTime?: string }) {
  if (lesson.date !== todayInAktau() || !lesson.startTime || !lesson.endTime) return "";
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  if (now >= lesson.startTime && now < lesson.endTime) return "current";
  if (now < lesson.startTime) return "next";
  return "";
}

export function Timetable({ language }: TimetableProps) {
  const t = translations[language];
  const [data, setData] = useState<TimetableResponse | null>(null);
  const [classId, setClassId] = useState<string>();
  const [week, setWeek] = useState(todayInAktau());
  const [mode, setMode] = useState<"today" | "week">("today");
  const [day, setDay] = useState(todayInAktau());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (selected = classId, requestedWeek = week) => {
    setRefreshing(true); setError(false);
    try {
      const query = new URLSearchParams({ ...(selected ? { class: selected } : {}), week: requestedWeek });
      const response = await fetch(`/api/timetable?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("timetable");
      const next = await response.json() as TimetableResponse;
      setData(next);
      if (!selected && next.classes[0]) {
        const saved = (() => { try { return localStorage.getItem(CLASS_KEY); } catch { return null; } })();
        const valid = next.classes.some(item => item.id === saved);
        if (valid) setClassId(saved!);
      }
    } catch { setError(true); } finally { setLoading(false); setRefreshing(false); }
  }, [classId, week]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(undefined, week); }, 0); return () => window.clearTimeout(timer); }, [load, week]);
  useEffect(() => { if (classId) { const timer = window.setTimeout(() => { void load(classId, week); }, 0); return () => window.clearTimeout(timer); } }, [classId, load, week]);
  const days = useMemo(() => data?.days ?? [], [data]);
  const selectedDay = days.find(item => item.date === day) ?? days[0];
  const lessons = mode === "today" ? selectedDay?.lessons ?? [] : days.flatMap(item => item.lessons);
  const displayedDays = useMemo(() => days.filter(item => item.weekday < 5), [days]);

  function chooseClass(value: string) { setClassId(value); try { localStorage.setItem(CLASS_KEY, value); } catch { /* Preference storage is optional. */ } }
  function shiftWeek(amount: number) { const next = weekShift(week, amount); setWeek(next); setDay(next); }

  return <section className="panel-view timetable-view" aria-labelledby="timetable-title">
    <div className="timetable-heading"><div><p className="view-eyebrow">NIS ХБН Актау</p><h1 className="view-heading" id="timetable-title">{t.timetableTitle}</h1><p className="view-subtitle">{t.timetableSubtitle}</p></div><a className="external-link" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">{t.openEdupage} <ExternalLink size={14}/></a></div>
    <div className="timetable-toolbar"><div className="segmented-control" role="group" aria-label={t.timetableTitle}><button type="button" aria-pressed={mode === "today"} onClick={() => setMode("today")}>{t.today}</button><button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>{t.week}</button></div><div className="timetable-actions"><select aria-label={t.selectClass} value={classId || ""} onChange={event => chooseClass(event.target.value)} disabled={!data?.classes.length}><option value="" disabled>{t.selectClass}</option>{data?.classes.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="icon-button" type="button" aria-label={t.refresh} title={t.refresh} disabled={refreshing} onClick={() => void load(classId, week)}><RefreshCw size={16} className={refreshing ? "auth-spinner" : ""}/></button></div></div>
    {mode === "week" ? <div className="week-navigation"><button className="icon-button" type="button" aria-label={t.previousWeek} onClick={() => shiftWeek(-1)}><ChevronLeft size={17}/></button><span>{dateLabel(days[0]?.date || week, language)} – {dateLabel(days[4]?.date || week, language)}</span><button className="icon-button" type="button" aria-label={t.nextWeek} onClick={() => shiftWeek(1)}><ChevronRight size={17}/></button></div> : null}
    {loading ? <div className="timetable-skeleton" aria-label={t.authLoading}><i/><i/><i/></div> : error ? <div className="timetable-empty" role="alert"><p>{t.timetableError}</p><button className="secondary-button" type="button" onClick={() => void load(classId, week)}>{t.tryAgain}</button></div> : !classId ? <div className="timetable-empty"><CalendarDays size={24}/><p>{t.selectClass}</p><small>{data?.classes.length || 0} classes available from EduPage.</small></div> : mode === "today" ? <>
      <div className="day-tabs" role="tablist" aria-label={t.today}>{displayedDays.map(item => <button type="button" role="tab" aria-selected={day === item.date} aria-current={day === item.date ? "date" : undefined} onClick={() => setDay(item.date)} key={item.date}>{dateLabel(item.date, language)}</button>)}</div><LessonList lessons={lessons} language={language} noLessons={t.noLessons} currentLabel={t.currentLesson} nextLabel={t.nextLesson}/>
    </> : <div className="week-grid">{displayedDays.map(item => <section key={item.date} className="week-day"><h2>{dateLabel(item.date, language)}</h2><LessonList lessons={item.lessons} language={language} noLessons={t.noLessons} currentLabel={t.currentLesson} nextLabel={t.nextLesson}/></section>)}</div>}
    <footer className="timetable-source">{t.source}: EduPage · NIS ХБН Актау <span>{t.received}: {data ? new Intl.DateTimeFormat(language === "kk" ? "kk-KZ" : language, { hour: "2-digit", minute: "2-digit" }).format(new Date(data.retrievedAt)) : "—"}</span></footer>
  </section>;
}

function LessonList({ lessons, noLessons, currentLabel, nextLabel }: { lessons: TimetableResponse["days"][number]["lessons"]; language?: Language; noLessons: string; currentLabel: string; nextLabel: string }) {
  return lessons.length ? <div className="lesson-list">{lessons.map(lesson => { const state = currentState(lesson); return <article className={`lesson-row ${state}`} key={lesson.id}><div className="lesson-time">{lesson.startTime || `${lesson.period}`} {lesson.endTime ? <small>{lesson.endTime}</small> : null}</div><div className="lesson-main"><span className="lesson-period">{lesson.period}{state === "current" ? ` · ${currentLabel}` : state === "next" ? ` · ${nextLabel}` : ""}</span><strong>{lesson.subject}</strong><div className="lesson-meta">{lesson.room ? <span>{lesson.room}</span> : null}{lesson.teacher ? <span>{lesson.teacher}</span> : null}{lesson.group ? <span>{lesson.group}</span> : null}</div></div></article>; })}</div> : <div className="timetable-empty"><CalendarDays size={21}/><p>{noLessons}</p></div>;
}
