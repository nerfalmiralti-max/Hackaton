"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Check, RotateCcw, Save, Trash2, X } from "lucide-react";
import { translations } from "@/lib/i18n";
import { defaultProfile } from "@/lib/profile";
import type { AuthIdentity, Language, Profile } from "@/lib/types";
import { profileSchema } from "@/lib/validation";

export function ProfileView({ language, profile, identity, onSignOut, onSave, onClearHistory }: {
  language: Language;
  profile: Profile;
  identity?: AuthIdentity;
  onSignOut?: () => void;
  onSave: (profile: Profile) => void;
  onClearHistory: () => void;
}) {
  const t = translations[language];
  const id = useId();
  const [edits, setEdits] = useState<Partial<Profile>>({});
  const [saved, setSaved] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const clearRef = useRef<HTMLButtonElement>(null);
  const draft = { ...profile, ...edits };
  const languageNames = new Intl.DisplayNames([language], { type: "language" });

  function change<K extends keyof Profile>(key: K, value: Profile[K]) {
    setEdits((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    setInvalidFields((previous) => previous.filter((field) => field !== key));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = profileSchema.safeParse(draft);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => String(issue.path[0]));
      setInvalidFields(fields);
      const field = event.currentTarget.elements.namedItem(fields[0]);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    onSave(result.data);
    setEdits({});
    setInvalidFields([]);
    setSaved(true);
  }

  function reset() {
    const defaults = profileSchema.parse(defaultProfile);
    onSave(defaults);
    setEdits({});
    setInvalidFields([]);
    setSaved(true);
  }

  function closeConfirmation() {
    setConfirmClear(false);
    clearRef.current?.focus();
  }

  return (
    <section className="panel-view" lang={language} aria-labelledby={`${id}-title`}>
      <p className="view-eyebrow">{t.profile}</p>
      <h1 className="view-heading" id={`${id}-title`}>{t.profileTitle}</h1>
      <p className="view-subtitle">{t.profileSub}</p>

      {identity ? <section className="account-settings" aria-labelledby={`${id}-account`}>
        <div><p className="view-eyebrow">{t.authAccount}</p><h2 id={`${id}-account`}>{t.authSchoolAccount}</h2><p>{identity.email}</p><small>{t.authConnected} · NIS AI</small></div>
        <button type="button" className="secondary-button" onClick={onSignOut}>{t.authSignOut}</button>
      </section> : null}

      <div className="profile-banner">
        <span className="avatar" aria-hidden="true">{Array.from(profile.name.trim())[0]?.toLocaleUpperCase(language)}</span>
        <div>
          <h2>{profile.name || t.aboutYou}</h2>
          <p>{profile.school}{profile.grade > 0 ? ` · ${t.grade} ${new Intl.NumberFormat(language).format(profile.grade)}` : ""}</p>
        </div>
      </div>

      <form className="profile-form" onSubmit={save} aria-labelledby={`${id}-about`}>
        <h2 id={`${id}-about`}>{t.aboutYou}</h2>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${id}-name`}>{t.name}</label>
            <input id={`${id}-name`} name="name" autoComplete="given-name" value={draft.name}
              maxLength={50} aria-invalid={invalidFields.includes("name") || undefined}
              onChange={(event) => change("name", event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-school`}>{t.school}</label>
            <input id={`${id}-school`} name="school" autoComplete="organization" value={draft.school}
              maxLength={100} aria-invalid={invalidFields.includes("school") || undefined}
              onChange={(event) => change("school", event.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${id}-grade`}>{t.grade}</label>
            <select id={`${id}-grade`} name="grade" value={draft.grade} required
              aria-invalid={invalidFields.includes("grade") || undefined}
              onChange={(event) => change("grade", Number(event.target.value))}>
              <option value={0}>—</option>
              {[7, 8, 9, 10, 11, 12].map((grade) => <option value={grade} key={grade}>{new Intl.NumberFormat(language).format(grade)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-language`}>{t.preferred}</label>
            <select id={`${id}-language`} name="language" value={draft.language} required
              aria-invalid={invalidFields.includes("language") || undefined}
              onChange={(event) => change("language", event.target.value as Language)}>
              {(["kk", "ru", "en"] as const).map((locale) => <option value={locale} key={locale}>{languageNames.of(locale)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-button"><Save size={17} aria-hidden="true" />{t.save}</button>
          <button type="button" className="secondary-button" onClick={reset}><RotateCcw size={17} aria-hidden="true" />{t.reset}</button>
          <span className="saved-label" role="status">{saved ? <><Check size={16} aria-hidden="true" />{t.saved}</> : null}</span>
        </div>
      </form>

      <div className="form-actions">
        <button type="button" className="danger-button" ref={clearRef} aria-expanded={confirmClear}
          onClick={() => setConfirmClear(true)}><Trash2 size={17} aria-hidden="true" />{t.clearHistory}</button>
        {confirmClear ? (
          <div className="inline-confirm" role="group" aria-label={t.confirmClear}
            onKeyDown={(event) => { if (event.key === "Escape") closeConfirmation(); }}>
            <p>{t.confirmClear}</p>
            <button type="button" className="danger-button" onClick={() => { onClearHistory(); closeConfirmation(); }}>
              <Trash2 size={17} aria-hidden="true" />{t.delete}
            </button>
            <button type="button" className="secondary-button" onClick={closeConfirmation}><X size={17} aria-hidden="true" />{t.cancel}</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
