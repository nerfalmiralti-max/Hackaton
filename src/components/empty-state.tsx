import { Sparkles } from "lucide-react";
import type { Language } from "@/lib/types";
const headings = { ru: "Что хочешь изучить?", kk: "Нені үйренгің келеді?", en: "What do you want to learn?" };
export function EmptyState({ language }: { language: Language }) {
  return <section className="empty-state">
    <div className="welcome-brand"><div className="welcome-mark"><Sparkles size={30} strokeWidth={1.4}/></div><span>NIS <b>AI</b></span></div>
    <h1>{headings[language]}</h1>
  </section>;
}
