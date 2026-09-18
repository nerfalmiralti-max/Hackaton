"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BookOpen, CalendarDays, ChevronDown, Image as ImageIcon, Layers, Menu, MessageSquare, Moon, PanelRight, Plus, ShieldCheck, Sparkles, Sun, UserRound, Zap } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { translations } from "@/lib/i18n";
import { tutorLabels } from "@/lib/tutor-labels";
import type { KnowledgeFile, View } from "@/lib/types";
import type { AuthIdentity } from "@/lib/types";
import { Answer } from "./answer";
import { Composer } from "./composer";
import { ContextRail } from "./context-rail";
import { EmptyState } from "./empty-state";
import { Knowledge } from "./knowledge";
import { ProfileView } from "./profile-view";
import { Timetable } from "./timetable";
import { Identity } from "./auth-gate";
const emptyMessages: import("@/lib/types").Message[] = [];
export function Workspace({ identity, onSignOut }: { identity?: AuthIdentity; onSignOut?: () => void }) {
  const app = useWorkspace();
  const [view, setView] = useState<View>("chat");
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const t = translations[app.language];
  const tt = tutorLabels[app.language];
  const messages = app.current?.messages ?? emptyMessages;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "instant", block: "end" }); }, [messages]);
  useEffect(() => { const handle = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); }; window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, []);
  function navigate(next: View) { setView(next); setMenu(false); }
  function askFile(file: KnowledgeFile) { app.setSelectedFile(file); navigate("chat"); void app.send(`${t.filePrompt} «${file.name}».`, undefined, { file }); }
  return <div className={`site-shell ${dark ? "dark" : ""}`}>
    {menu && <button className="nav-overlay" aria-label={t.close} onClick={() => setMenu(false)}/>}
    <aside className={`sidebar ${menu ? "open" : ""}`} aria-label={t.menu}>
      <button className="brand" onClick={() => navigate("chat")} aria-label="NIS AI"><span className="brand-symbol"><Layers size={24} strokeWidth={1.7}/></span><span>NIS <b>AI</b></span></button>
      <button className="new-chat" onClick={() => { app.newChat(); navigate("chat"); }} disabled={app.busy}><Plus size={18}/>{t.newChat}</button>
      <nav>{([{ key: "chat", icon: MessageSquare }, { key: "knowledge", icon: BookOpen }, { key: "timetable", icon: CalendarDays }, { key: "profile", icon: UserRound }] as const).map(item => <button key={item.key} data-view={item.key} className={`nav-item ${view === item.key ? "selected" : ""}`} onClick={() => navigate(item.key)} aria-current={view === item.key ? "page" : undefined}><item.icon size={18}/><span>{t[item.key]}</span>{item.key === "knowledge" && app.status?.files.length ? <small>{app.status.files.length}</small> : null}</button>)}</nav>
      <div className="conversation-nav"><h2>{t.recent}</h2>{app.conversations.filter(c => c.title).length ? app.conversations.filter(c => c.title).map(c => <button key={c.id} className={`history-item ${app.current?.id === c.id ? "current" : ""}`} disabled={app.busy} onClick={() => { app.selectChat(c.id); navigate("chat"); }}><MessageSquare size={14}/><span>{c.title}</span></button>) : <p>{t.noHistory}</p>}</div>
      <div className="sidebar-bottom"><button className="user-switch" onClick={() => navigate("profile")}><span className="avatar">{identity ? Array.from(identity.name?.trim() || identity.email)[0]?.toLocaleUpperCase(app.language) : app.profile.name ? app.profile.name.slice(0,1) : <UserRound size={18}/>}</span><span><strong>{identity?.name || app.profile.name || t.profile}</strong><small>{identity?.email || app.profile.school || t.privacy}{app.profile.grade > 0 ? ` · ${t.grade} ${app.profile.grade}` : ""}</small></span><ChevronDown size={14}/></button></div>
    </aside>
    <div className="site-main">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label={t.menu} onClick={() => setMenu(!menu)}><Menu size={20}/></button><span className="breadcrumb">NIS AI <span>/</span> <strong>{t[view]}</strong></span></div><div className="topbar-actions"><div className="language-control" aria-label={t.language}>{([{ key: "kk", label: "ҚАЗ" },{ key: "ru", label: "РУС" },{ key: "en", label: "ENG" }] as const).map(lang => <button key={lang.key} aria-pressed={app.language === lang.key} onClick={() => app.changeLanguage(lang.key)}>{lang.label}</button>)}</div><button className="icon-button theme-toggle" title={t.theme} aria-label={t.theme} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="icon-button context-toggle" title={t.viewContext} aria-label={t.viewContext} aria-expanded={contextOpen} onClick={() => setContextOpen(!contextOpen)}><PanelRight size={18}/></button>{identity ? <Identity identity={identity} onSignOut={onSignOut || (() => undefined)} labels={{ account: t.authAccount, settings: t.authSettings, signOut: t.authSignOut, schoolAccount: t.authSchoolAccount }}/> : null}</div></header>
      <div className={`workspace-layout ${contextOpen ? "with-context" : ""}`}><main className={`workspace-main ${view !== "chat" ? "scroll-view" : ""} view-${view} ${!messages.length && view === "chat" ? "new-conversation" : ""}`}>
        {view === "timetable" ? <Timetable language={app.language}/> : null}
        {view === "chat" ? <>
          <div className="chat-scroll">{!messages.length ? <EmptyState language={app.language}/> : <div className="message-list">{messages.map(message => message.role === "user" ? <article className="user-message" key={message.id}><div className="message-avatar">{app.profile.name ? app.profile.name.slice(0,1) : <UserRound size={17}/>}</div><div><span className="message-label">{t.you}</span><p>{message.content}</p>{message.image && <Image className="message-image" unoptimized src={message.image.dataUrl} alt={message.image.name} width={280} height={180} style={{ width: "auto", height: "auto" }}/>} {message.fileName && <small className="muted">{message.fileName}</small>}</div></article> : <Answer key={message.id} message={message} language={app.language} onRetry={() => app.retry(message.id)} onFallback={web => app.retry(message.id,web)}/>)}{app.busy && <span className="stream-phase" role="status">{app.phase === "searching" ? t.searching : t.thinking}</span>}<div ref={endRef}/></div>}</div>
          <div className="chat-footer">{app.status && !app.status.configured && <div className="setup-notice"><ShieldCheck size={15}/><span>{t.setupNote}</span></div>}
            <div className="tutor-toolbar"><button className={`teach-toggle ${app.teach ? "active" : ""}`} aria-pressed={app.teach} disabled={app.busy} onClick={() => app.setTeach(!app.teach)}><Zap size={15}/>{tt.teach}<span>{app.teach ? app.current?.tutor?.stage === "complete" ? tt.complete : tt.active : ""}</span></button>{app.teach && messages.length > 0 && <div className="tutor-actions"><button disabled={app.busy} onClick={() => void app.send(tt.hintPrompt, undefined, { action: "hint" })}>{tt.hint}</button><button disabled={app.busy} onClick={() => void app.send(tt.answerPrompt, undefined, { action: "show-answer" })}>{tt.answer}</button></div>}</div>
            <Composer language={app.language} busy={app.busy} options={app.options} onOptions={app.setOptions} onSend={(text,image) => void app.send(text,image)} onStop={app.stop} selectedFile={app.selectedFile} onFile={app.setSelectedFile} imageRef={imageRef} onFilesChange={file => app.updateFiles([...(app.status?.files || []).filter(f => f.id !== file.id),file])}/>
            {!messages.length && <div className="starter-actions"><button onClick={() => navigate("knowledge")}><BookOpen size={16}/>{t.knowledge}</button><button onClick={() => imageRef.current?.click()}><ImageIcon size={16}/>{t.scan}</button></div>}
            {app.status?.development && app.usage.input > 0 && <div className="usage-label">{t.sessionUsage}: {app.usage.input} {t.input} · {app.usage.output} {t.output}</div>}
          </div>
        </> : view === "knowledge" ? <Knowledge language={app.language} status={app.status} onFilesChange={app.updateFiles} onAsk={askFile} onAskText={text => { navigate("chat"); void app.send(text, undefined, { schoolOnly: true }); }}/> : <><ProfileView language={app.language} profile={app.profile} identity={identity} onSignOut={onSignOut} onSave={app.setProfile} onClearHistory={app.clearHistory}/><section className="learning-memory"><h2><Sparkles size={17}/>{tt.memory}</h2>{app.memory.length ? <><ul>{app.memory.map((m,i) => <li key={i}><strong>{m.topic}</strong><span>{m.misconception}</span></li>)}</ul><button className="secondary-button" onClick={app.clearMemory}>{tt.clear}</button></> : <p>{tt.empty}</p>}</section><footer className="creator-credit">Толеш Альтаир, NIS ХБН Актау <span>© NIS AI · 2026</span></footer></>}
      </main>{contextOpen && <ContextRail language={app.language} profile={app.profile} status={app.status} onProfile={() => navigate("profile")} onKnowledge={() => navigate("knowledge")}/>}</div>
    </div>
  </div>;
}
