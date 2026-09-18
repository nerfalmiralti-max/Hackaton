import { BookOpen, UserRound } from "lucide-react";
import type { AppStatus, Language, Profile } from "@/lib/types";
import { translations } from "@/lib/i18n";
export function ContextRail({ language, profile, status, onProfile, onKnowledge }: { language: Language; profile: Profile; status: AppStatus | null; onProfile: () => void; onKnowledge: () => void }) {
  const t = translations[language];
  const empty = { ru: "Контекст пока не добавлен", kk: "Контекст әлі қосылмаған", en: "No context added yet" };
  return <aside className="context-rail" aria-label={t.profile}>
    <div className="rail-heading"><span>{t.profile}</span><UserRound size={17}/></div>
    <div className="student-context">{profile.name || profile.school || profile.grade ? <><strong>{profile.name}</strong>{profile.school && <span>{profile.school}</span>}{profile.grade > 0 && <span>{t.grade} {profile.grade}</span>}</> : <p>{empty[language]}</p>}</div>
    <button className="rail-link" onClick={onProfile}><UserRound size={16}/>{t.viewContext}</button>
    <div className="rail-section"><h3><BookOpen size={16}/>{t.knowledge}</h3>{status?.files.length ? <ul className="context-files">{status.files.map(file => <li key={file.id}>{file.name}</li>)}</ul> : <p className="muted">{t.noMaterials}</p>}</div>
    <button className="rail-link" onClick={onKnowledge}>{t.addMaterials}</button>
  </aside>;
}
