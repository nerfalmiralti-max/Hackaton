export type Language = "ru" | "kk" | "en";
export type View = "chat" | "knowledge" | "profile";
export type SourceKind = "nis" | "file" | "image" | "general" | "web" | "context";
export interface Source { id: string; kind: SourceKind; title: string; url?: string; excerpt?: string }
export interface Term { en: string; ru: string; kk: string }
export interface TutorState { mode: "teach"; stage: "explore" | "practice" | "check" | "complete"; turn: number; topic: string; misconceptions: string[]; observedMistake?: string }
export interface Profile { name: string; school: string; grade: number; language: Language }
export interface Attachment { name: string; dataUrl: string }
export interface Message {
  id: string; role: "user" | "assistant"; content: string;
  image?: Attachment; fileName?: string; sources?: Source[]; terms?: Term[];
  status?: "streaming" | "done" | "error" | "stopped";
  errorCode?: string; needsFallback?: boolean; truncated?: boolean;
  tutor?: TutorState;
}
export interface Conversation { id: string; title: string; messages: Message[]; updatedAt: number; tutor?: TutorState }
export interface KnowledgeFile { id: string; name: string; bytes: number; status: "in_progress" | "completed" | "failed"; createdAt: number }
export interface AppStatus { configured: boolean; schoolConnected: boolean; files: KnowledgeFile[]; model: string; development: boolean }
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "phase"; phase: "searching" | "thinking" }
  | { type: "done"; sources: Source[]; terms: Term[]; needsFallback: boolean; truncated: boolean; tutor?: TutorState; usage?: { input: number; output: number } }
  | { type: "error"; code: string };
