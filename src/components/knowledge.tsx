"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, FileText, LoaderCircle, MessageSquare, RefreshCw, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { errorLabel, translations } from "@/lib/i18n";
import type { AppStatus, KnowledgeFile, Language } from "@/lib/types";
import { MAX_FILE_BYTES } from "@/lib/validation";
import { TextbookLibrary } from "./textbook-library";

function isKnowledgeFile(value: unknown): value is KnowledgeFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<KnowledgeFile>;
  return typeof file.id === "string" && typeof file.name === "string" &&
    typeof file.bytes === "number" && Number.isFinite(file.bytes) && file.bytes >= 0 &&
    typeof file.createdAt === "number" && Number.isFinite(file.createdAt) &&
    ["in_progress", "completed", "failed"].includes(file.status ?? "");
}

function responseCode(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("error" in body) || typeof body.error !== "string") return fallback;
  return body.error === "TOO_MANY_FILES" ? "FILE_LIMIT" : body.error;
}

export function Knowledge({ language, status, onFilesChange, onAsk, onAskText }: {
  language: Language;
  status: AppStatus | null;
  onFilesChange: (files: KnowledgeFile[]) => void;
  onAsk: (file: KnowledgeFile) => void;
  onAskText: (text: string) => void;
}) {
  const t = translations[language];
  const [files, setFiles] = useState<KnowledgeFile[]>(status?.files ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const filesRef = useRef(files);
  const callbackRef = useRef(onFilesChange);
  const activeRequest = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const configured = status?.configured === true;
  const pending = files.some((file) => file.status === "in_progress");

  useEffect(() => { callbackRef.current = onFilesChange; }, [onFilesChange]);

  const publish = useCallback((next: KnowledgeFile[]) => {
    filesRef.current = next;
    setFiles(next);
    callbackRef.current(next);
  }, []);

  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    try {
      const response = await fetch("/api/knowledge", { cache: "no-store", signal: controller.signal });
      const body: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) { setError(responseCode(body, "KNOWLEDGE_ERROR")); return; }
      if (!body || typeof body !== "object" || !("files" in body) || !Array.isArray(body.files) ||
          !body.files.every(isKnowledgeFile)) { setError("KNOWLEDGE_ERROR"); return; }
      publish(body.files);
      setError(null);
    } catch {
      if (!controller.signal.aborted) setError("NETWORK_ERROR");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [publish]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => {
      window.clearTimeout(timer);
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [pending, refresh]);

  async function mutate(method: "POST" | "DELETE", file?: File, fileId?: string) {
    if (activeRequest.current || !configured) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      const response = await fetch(method === "POST" ? "/api/knowledge" : `/api/knowledge/${encodeURIComponent(fileId!)}`, {
        method, body: method === "POST" ? form : undefined, signal: controller.signal,
      });
      const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) { setError(responseCode(body, method === "POST" ? "UPLOAD_ERROR" : "KNOWLEDGE_ERROR")); return; }
      if (method === "POST") {
        if (!body || typeof body !== "object" || !("file" in body) || !isKnowledgeFile(body.file)) {
          setError("KNOWLEDGE_ERROR"); return;
        }
        const uploaded = body.file;
        publish([...filesRef.current.filter((item) => item.id !== uploaded.id), uploaded]);
      } else {
        publish(filesRef.current.filter((item) => item.id !== fileId));
        setConfirmId(null);
      }
    } catch {
      if (!controller.signal.aborted) setError("NETWORK_ERROR");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (!controller.signal.aborted) {
          setLoading(false);
          window.requestAnimationFrame(() => refreshRef.current?.focus());
        }
      }
    }
  }

  function upload(file: File | undefined) {
    if (!file || !configured || activeRequest.current) return;
    if (file.size > MAX_FILE_BYTES) { setError("FILE_TOO_LARGE"); return; }
    if (!file.size || !/\.(pdf|docx|txt|md)$/i.test(file.name)) { setError("INVALID_FILE"); return; }
    if (filesRef.current.length >= 12) { setError("FILE_LIMIT"); return; }
    void mutate("POST", file);
  }

  function cancelDelete() {
    setConfirmId(null);
    deleteTrigger.current?.focus();
  }

  const query = search.trim().toLocaleLowerCase(language);
  const visible = files.filter((file) => file.name.toLocaleLowerCase(language).includes(query) &&
    (filter === "all" || filter === file.status));
  const statusLabel = (file: KnowledgeFile) => file.status === "completed" ? t.ready : file.status === "failed" ? t.failed : t.indexing;
  const sizeLabel = (bytes: number) => new Intl.NumberFormat(language, {
    style: "unit", unit: bytes >= 1_000_000 ? "megabyte" : "kilobyte", maximumFractionDigits: 1,
  }).format(bytes / (bytes >= 1_000_000 ? 1_000_000 : 1000));
  const canUpload = configured && !loading && files.length < 12;

  return (
    <section className="panel-view" lang={language} aria-labelledby={`${id}-title`}>
      <p className="view-eyebrow">{t.knowledge}</p>
      <h1 className="view-heading" id={`${id}-title`}>{t.libraryTitle}</h1>
      <p className="view-subtitle">{t.librarySub}</p>

      {status && !configured ? <p className="context-notice" role="status">{t.setupNote}</p> : null}
      <div className="library-toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchLibrary} aria-label={t.searchLibrary} />
        </label>
        <select aria-label={t.files} value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">{t.uploaded}</option>
          <option value="completed">{t.ready}</option>
          <option value="in_progress">{t.indexing}</option>
          <option value="failed">{t.failed}</option>
        </select>
        <button className="icon-button" type="button" ref={refreshRef} onClick={() => void refresh()}
          disabled={loading} title={t.refresh} aria-label={t.refresh}>
          {loading ? <LoaderCircle size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
        </button>
      </div>

      <div className="upload-zone">
        <Upload size={24} aria-hidden="true" />
        <p id={`${id}-upload-hint`}>{t.uploadHint}</p>
        <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,.md" hidden disabled={!canUpload}
          aria-label={t.upload} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            upload(file);
          }} />
        <button type="button" className="primary-button" disabled={!canUpload}
          aria-describedby={`${id}-upload-hint`} onClick={() => inputRef.current?.click()}>
          <Upload size={16} aria-hidden="true" />{t.upload}
        </button>
        {files.length >= 12 ? <p className="muted">{t.limitFiles}</p> : null}
      </div>

      {error ? <p className="error-banner" role="alert">{error === "NETWORK_ERROR" ? t.networkError : errorLabel(error, t)}</p> : null}
      <div className="section-heading">
        <h2>{t.uploaded}</h2>
        <span className="muted">{new Intl.NumberFormat(language).format(files.length)} {t.files}</span>
      </div>
      <p className="muted" role="status">{loading ? t.searching : pending ? t.indexing : ""}</p>
      <div aria-busy={loading}>
        {visible.length ? (
          <ul className="file-list">
            {visible.map((file) => (
              <li className="file-row" key={file.id}>
                <FileText className="file-icon" size={24} aria-hidden="true" />
                <div className="file-meta">
                  <strong title={file.name}>{file.name}</strong>
                  <span className="muted">{sizeLabel(file.bytes)} · {new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(file.createdAt)}</span>
                </div>
                <span className="file-status" data-status={file.status}>
                  <span className="status-dot" data-status={file.status} aria-hidden="true" />{statusLabel(file)}
                </span>
                <div className="file-actions">
                  <button type="button" className="icon-button" disabled={loading || !configured || file.status !== "completed"}
                    title={file.status === "in_progress" ? t.pendingFile : t.askFile} aria-label={`${t.askFile}: ${file.name}`} onClick={() => onAsk(file)}>
                    <MessageSquare size={17} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-button" disabled={loading || !configured}
                    title={t.deleteFile} aria-label={`${t.deleteFile}: ${file.name}`} aria-expanded={confirmId === file.id}
                    onClick={(event) => { deleteTrigger.current = event.currentTarget; setConfirmId(file.id); }}>
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
                {confirmId === file.id ? (
                  <div className="inline-confirm" role="group" aria-label={`${t.confirmDelete} ${file.name}`}
                    onKeyDown={(event) => { if (event.key === "Escape" && !loading) cancelDelete(); }}>
                    <span>{t.confirmDelete}</span>
                    <button type="button" className="secondary-button" disabled={loading || !configured}
                      onClick={() => void mutate("DELETE", undefined, file.id)}><Trash2 size={16} aria-hidden="true" />{t.delete}</button>
                    <button type="button" className="secondary-button" disabled={loading} onClick={cancelDelete}>
                      <X size={16} aria-hidden="true" />{t.cancel}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : !loading ? (
          <div className="library-empty">
            <BookOpen size={30} aria-hidden="true" />
            <h3>{files.length ? t.noResults : t.emptyLibrary}</h3>
            {!files.length ? <p>{t.emptyLibrarySub}</p> : null}
          </div>
        ) : null}
      </div>

      <TextbookLibrary language={language} onAsk={onAskText}/>
      <section className="school-collection" aria-labelledby={`${id}-school`}>
        <ShieldCheck size={22} aria-hidden="true" />
        <h2 id={`${id}-school`}>{t.schoolLibrary}</h2>
        <p>{t.schoolLibrarySub}</p>
        <p className="file-status"><span className="status-dot" data-status={configured && status?.schoolConnected ? "completed" : "failed"} aria-hidden="true" />
          {!status ? t.searching : configured && status.schoolConnected ? t.connected : t.noMaterials}
        </p>
      </section>
    </section>
  );
}
