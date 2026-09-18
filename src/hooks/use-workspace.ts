"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultProfile } from "@/lib/profile";
import { profileSchema } from "@/lib/validation";
import { readStream } from "@/lib/client";
import type { AppStatus, Attachment, Conversation, KnowledgeFile, Language, Message, Profile, TutorState } from "@/lib/types";
import type { ComposerOptions } from "@/components/composer";
const emptyConversation = (): Conversation => ({ id: crypto.randomUUID(), title: "", messages: [], updatedAt: Date.now() });
export function useWorkspace() {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [teach, setTeach] = useState(false);
  const [options, setOptions] = useState<ComposerOptions>({ trilingua: false, web: false, schoolOnly: false });
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile>();
  const [phase, setPhase] = useState("thinking");
  const [usage, setUsage] = useState({ input: 0, output: 0 });
  const [memory, setMemory] = useState<{ topic: string; misconception: string }[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const current = conversations.find(c => c.id === currentId);
  const language = profile.language;
  const refreshStatus = useCallback(async () => {
    try { const response = await fetch("/api/status", { cache: "no-store" }); if (response.ok) setStatus(await response.json()); } catch { /* Chat reports connection errors on send. */ }
  }, []);
  useEffect(() => {
    const refreshTimer = window.setTimeout(() => { void refreshStatus(); }, 0);
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem("nis-workspace") || "null");
        if (saved) {
          const p = profileSchema.safeParse(saved.profile);
          if (p.success) {
            const legacySeed = saved.profileVersion !== 2 && p.data.name === "Arman" && p.data.school === "NIS Aktau" && p.data.grade === 10;
            setProfile(legacySeed ? { ...defaultProfile, language: p.data.language } : p.data);
          }
          if (Array.isArray(saved.conversations)) {
            const valid = saved.conversations.filter((c: Conversation) => typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.messages)).slice(0, 15);
            setConversations(valid); setCurrentId(valid.some((c: Conversation) => c.id === saved.currentId) ? saved.currentId : valid[0]?.id || "");
          }
          if (Array.isArray(saved.memory)) setMemory(saved.memory.filter((m: { topic?: unknown; misconception?: unknown }) => typeof m.topic === "string" && typeof m.misconception === "string").slice(-8));
        }
      } catch { sessionStorage.removeItem("nis-workspace"); }
      setHydrated(true);
    });
    return () => { window.clearTimeout(refreshTimer); controllerRef.current?.abort(); };
  }, [refreshStatus]);
  useEffect(() => {
    if (!hydrated || busy) return;
    try {
      sessionStorage.setItem("nis-workspace", JSON.stringify({ profileVersion: 2, profile, currentId, memory, conversations: conversations.slice(0,15).map(c => ({ ...c, messages: c.messages.slice(-40).map(({ image, ...m }) => ({ ...m, ...(image ? { fileName: image.name } : {}) })) })) }));
    } catch { /* Storage restrictions must not block a conversation. */ }
  }, [profile, currentId, memory, conversations, hydrated, busy]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    if (!selectedFile || selectedFile.status !== "in_progress") return;
    const timer = setInterval(async () => {
      try { const response = await fetch("/api/knowledge"); if (response.ok) { const { files } = await response.json(); setStatus(previous => previous ? { ...previous, files } : previous); setSelectedFile(files.find((f: KnowledgeFile) => f.id === selectedFile.id)); } } catch { /* Manual library refresh is available. */ }
    }, 3500);
    return () => clearInterval(timer);
  }, [selectedFile]);
  function newChat() { if (inFlight.current) return; const c = emptyConversation(); setConversations(prev => [c, ...prev].slice(0,15)); setCurrentId(c.id); setSelectedFile(undefined); setTeach(false); }
  function selectChat(id: string) { if (inFlight.current) return; setCurrentId(id); setTeach(Boolean(conversations.find(c => c.id === id)?.tutor)); setSelectedFile(undefined); }
  function patchMessage(conversationId: string, id: string, patch: Partial<Message>) { setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: c.messages.map(m => m.id === id ? { ...m, ...patch } : m), ...(patch.tutor ? { tutor: patch.tutor } : {}) } : c)); }
  async function send(text: string, image?: Attachment, override?: { trilingua?: boolean; schoolOnly?: boolean; allowGeneral?: boolean; web?: boolean; retryId?: string; file?: KnowledgeFile; action?: "hint" | "show-answer" }) {
    if (inFlight.current || !text.trim()) return;
    inFlight.current = true;
    const conversation = current ?? emptyConversation();
    const base = override?.retryId ? conversation.messages.slice(0, conversation.messages.findIndex(m => m.id === override.retryId)) : conversation.messages;
    const retry = override?.retryId ? base.at(-1) : undefined;
    const user: Message = retry?.role === "user" ? retry : { id: crypto.randomUUID(), role: "user", content: text, image, fileName: (override?.file || selectedFile)?.name };
    const assistant: Message = { id: crypto.randomUUID(), role: "assistant", content: "", status: "streaming" };
    const messages = retry ? [...base, assistant] : [...base, user, assistant];
    const update: Conversation = { ...conversation, title: conversation.title || text.slice(0,55), messages, updatedAt: Date.now() };
    setConversations(prev => [update, ...prev.filter(c => c.id !== update.id)]); setCurrentId(update.id); setBusy(true); setPhase("thinking");
    const controller = new AbortController(); controllerRef.current = controller;
    const tutor: TutorState | undefined = teach ? conversation.tutor || { mode: "teach", stage: "explore", turn: 0, topic: "", misconceptions: [] } : undefined;
    try {
      const response = await fetch("/api/chat", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        messages: messages.filter(m => m.id !== assistant.id && m.status !== "error").slice(-10).map(m => ({ role: m.role, content: m.content.slice(0,6000) })),
        profile, language, trilingua: override?.trilingua ?? options.trilingua,
        web: override?.web ?? options.web, sourceMode: (override?.schoolOnly ?? options.schoolOnly) ? "school" : "auto",
        allowGeneral: override?.allowGeneral ?? false, image: image || user.image,
        fileId: (override?.file || selectedFile)?.id, tutor: tutor ? { ...tutor, misconceptions: [...new Set([...tutor.misconceptions, ...memory.filter(m => m.topic.toLowerCase() === tutor.topic.toLowerCase()).map(m => m.misconception)])].slice(-5) } : undefined,
        action: override?.action,
        learningMemory: memory,
      }) });
      let content = "";
      await readStream(response, event => {
        if (event.type === "phase") setPhase(event.phase);
        if (event.type === "delta") { content += event.text; patchMessage(update.id, assistant.id, { content }); }
        if (event.type === "error") patchMessage(update.id, assistant.id, { status: "error", errorCode: event.code });
        if (event.type === "done") {
          patchMessage(update.id, assistant.id, { status: "done", sources: event.sources, terms: event.terms, needsFallback: event.needsFallback, truncated: event.truncated, tutor: event.tutor });
          if (event.usage) setUsage(prev => ({ input: prev.input + event.usage!.input, output: prev.output + event.usage!.output }));
          if (event.tutor?.observedMistake && event.tutor.topic) setMemory(prev => [...prev.filter(m => m.topic !== event.tutor!.topic || m.misconception !== event.tutor!.observedMistake), { topic: event.tutor!.topic, misconception: event.tutor!.observedMistake! }].slice(-8));
        }
      });
    } catch (error) { patchMessage(update.id, assistant.id, controller.signal.aborted ? { status: "stopped" } : { status: "error", errorCode: (error as Error).message || "NETWORK_ERROR" }); }
    finally { setBusy(false); inFlight.current = false; controllerRef.current = null; setSelectedFile(undefined); }
  }
  function retry(id: string, web?: boolean) { const index = current?.messages.findIndex(m => m.id === id) ?? -1; const user = current?.messages[index - 1]; if (user?.role === "user") void send(user.content, user.image, { retryId: id, ...(web !== undefined ? { allowGeneral: true, web, schoolOnly: false } : {}) }); }
  function updateFiles(files: KnowledgeFile[]) { setStatus(prev => prev ? { ...prev, files } : prev); }
  return { profile, setProfile, language, changeLanguage: (lang: Language) => setProfile(p => ({ ...p, language: lang })), conversations, current, busy, status, teach, setTeach, options, setOptions, selectedFile, setSelectedFile, phase, usage, memory, clearMemory: () => setMemory([]), newChat, selectChat, send, retry, stop: () => controllerRef.current?.abort(), updateFiles, refreshStatus,
    clearHistory: () => { if (!busy) { setConversations([]); setCurrentId(""); setTeach(false); } },
  };
}
