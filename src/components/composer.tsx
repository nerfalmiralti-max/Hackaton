"use client";
import { useRef, useState } from "react";
import { ArrowUp, Square, Paperclip, ImagePlus, Camera, Globe2, Languages, BookOpen, X, FileText, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { translations, errorLabel } from "@/lib/i18n";
import { prepareImage } from "@/lib/client";
import type { Attachment, KnowledgeFile, Language } from "@/lib/types";
export interface ComposerOptions { trilingua: boolean; web: boolean; schoolOnly: boolean }
export function Composer({ language, busy, options, onOptions, onSend, onStop, onFilesChange, selectedFile, onFile, imageRef }: {
  language: Language; busy: boolean; options: ComposerOptions; onOptions: (v: ComposerOptions) => void;
  onSend: (text: string, image?: Attachment) => void; onStop: () => void;
  onFilesChange: (file: KnowledgeFile) => void; selectedFile?: KnowledgeFile; onFile: (file?: KnowledgeFile) => void;
  imageRef: React.RefObject<HTMLInputElement | null>;
}) {
  const t = translations[language];
  const [text, setText] = useState("");
  const [image, setImage] = useState<Attachment>();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  async function attachImage(file?: File) {
    if (!file) return;
    setError("");
    try { setImage(await prepareImage(file)); } catch (e) { setError((e as Error).message === "FILE_TOO_LARGE" ? t.fileTooLarge : t.invalidImage); }
  }
  async function uploadDocument(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError(t.fileTooLarge); return; }
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/knowledge", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      onFilesChange(body.file); onFile(body.file);
    } catch (e) { setError(errorLabel((e as Error).message, t)); } finally { setUploading(false); }
  }
  function submit() {
    if (busy || uploading || (!text.trim() && !image) || selectedFile?.status === "in_progress") return;
    onSend(text.trim() || t.photoPrompt, image); setText(""); setImage(undefined); setError("");
  }
  return <div className="composer-wrap">
    {error && <div className="composer-error" role="alert">{error}<button className="icon-button" onClick={() => setError("")} aria-label={t.close}><X size={14}/></button></div>}
    <div className="composer" onPaste={event => { const file = [...event.clipboardData.items].find(item => item.type.startsWith("image/"))?.getAsFile(); if (file) { event.preventDefault(); void attachImage(file); } }}>
      {(image || selectedFile) && <div className="attachments">
        {image && <div className="attachment"><span className="attachment-preview"><Image unoptimized fill sizes="60px" src={image.dataUrl} alt={image.name}/></span><span>{image.name}</span><button onClick={() => setImage(undefined)} className="icon-button" aria-label={t.remove}><X size={14}/></button></div>}
        {selectedFile && <div className="attachment"><FileText size={20}/><span>{selectedFile.name}<small>{selectedFile.status === "in_progress" ? t.indexing : t.documentAttached}</small></span><button onClick={() => onFile(undefined)} className="icon-button" aria-label={t.remove}><X size={14}/></button></div>}
      </div>}
      <textarea aria-label={t.placeholder} placeholder={t.placeholder} value={text} maxLength={6000} rows={2} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} disabled={uploading}/>
      <div className="composer-bottom">
        <div className="attachment-tools">
          <button className="icon-button" title={t.attach} aria-label={t.attach} disabled={busy || uploading} onClick={() => docRef.current?.click()}>{uploading ? <LoaderCircle size={18} className="spin"/> : <Paperclip size={18}/>}</button>
          <button className="icon-button" title={t.image} aria-label={t.image} disabled={busy} onClick={() => imageRef.current?.click()}><ImagePlus size={18}/></button>
          <button className="icon-button camera-button" title={t.camera} aria-label={t.camera} disabled={busy} onClick={() => cameraRef.current?.click()}><Camera size={18}/></button>
          <span className="tool-divider"/>
          <button className={`mode-button ${options.trilingua ? "active" : ""}`} aria-pressed={options.trilingua} title={t.trilingua} onClick={() => onOptions({ ...options, trilingua: !options.trilingua })}><Languages size={16}/><span>TriLingua</span></button>
          <button className={`icon-button ${options.web ? "active" : ""}`} aria-pressed={options.web} aria-label={t.web} title={t.web} onClick={() => onOptions({ ...options, web: !options.web })}><Globe2 size={17}/></button>
          <button className={`icon-button ${options.schoolOnly ? "active" : ""}`} aria-pressed={options.schoolOnly} aria-label={t.schoolOnly} title={t.schoolOnly} onClick={() => onOptions({ ...options, schoolOnly: !options.schoolOnly })}><BookOpen size={17}/></button>
        </div>
        {busy ? <button className="send-button" onClick={onStop} aria-label={t.stop} title={t.stop}><Square size={17} fill="currentColor"/></button> : <button className="send-button" onClick={submit} disabled={uploading || (!text.trim() && !image) || selectedFile?.status === "in_progress"} aria-label={t.send} title={t.send}><ArrowUp size={20}/></button>}
      </div>
      <input type="file" hidden ref={imageRef} accept="image/png,image/jpeg,image/webp" onChange={e => { void attachImage(e.target.files?.[0]); e.target.value = ""; }}/>
      <input type="file" hidden ref={cameraRef} accept="image/*" capture="environment" onChange={e => { void attachImage(e.target.files?.[0]); e.target.value = ""; }}/>
      <input type="file" hidden ref={docRef} accept=".pdf,.docx,.txt,.md" onChange={e => { void uploadDocument(e.target.files?.[0]); e.target.value = ""; }}/>
    </div>
    <div className="composer-caption"><span>{options.web ? t.web : options.schoolOnly ? t.schoolOnly : t.inputNote}</span><span className="mini-brand">NIS AI</span></div>
  </div>;
}
