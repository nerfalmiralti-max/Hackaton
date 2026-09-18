"use client";

import { cloneElement, useEffect, useState, type ReactElement } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Layers, LoaderCircle, ShieldCheck } from "lucide-react";
import { translations } from "@/lib/i18n";
import type { AuthIdentity, Language } from "@/lib/types";

const introKey = "nis-ai-intro-seen-v1";

function MicrosoftMark() {
  return <span className="microsoft-mark" aria-hidden="true"><i/><i/><i/><i/></span>;
}

function Identity({ identity, onSignOut, labels }: { identity: AuthIdentity; onSignOut: () => void; labels: { account: string; settings: string; signOut: string; schoolAccount: string } }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (identity) {
      try { localStorage.setItem(introKey, "1"); } catch { /* UX preference storage is optional. */ }
    }
  }, [identity]);
  useEffect(() => {
    const close = () => setOpen(false);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", escape); };
  }, []);
  const initials = Array.from(identity.name?.trim() || identity.email).find(char => /[\p{L}\p{N}]/u.test(char))?.toLocaleUpperCase() || "N";
  return <div className="account-control" onClick={event => event.stopPropagation()}>
    <button className="account-trigger" type="button" aria-label={`${identity.email} account`} aria-expanded={open} title={identity.email} onClick={() => setOpen(value => !value)}>
      <span className="avatar account-avatar">{identity.image ? <span className="account-photo" role="img" aria-label="" style={{ backgroundImage: `url(${identity.image})` }}/> : initials}</span>
      <span className="account-email">{identity.email}</span>
      <span className="account-chevron">⌄</span>
    </button>
    {open ? <div className="account-popover" role="menu">
      <strong>{identity.name || identity.email}</strong>
      <span>{identity.email}</span>
      <small>{labels.schoolAccount}</small>
      <div className="account-divider"/>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); document.querySelector<HTMLButtonElement>(".nav-item[data-view='profile']")?.click(); }}>{labels.settings}</button>
      <button type="button" role="menuitem" onClick={onSignOut}>{labels.signOut}</button>
    </div> : null}
  </div>;
}

function AuthButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button className="microsoft-button" type="button" disabled={disabled} onClick={onClick}><MicrosoftMark/><span>{label}</span></button>;
}

function EnabledAuthGate({ configured, initialSession, children }: { configured: boolean; initialSession: AuthIdentity | null; children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [language, setLanguage] = useState<Language>("ru");
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const identity = session?.user?.email ? { name: session.user.name, email: session.user.email, image: session.user.image } : initialSession;
  const t = translations[language];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const workspace = JSON.parse(sessionStorage.getItem("nis-workspace") || "null") as { profile?: { language?: Language } } | null;
        if (workspace?.profile?.language && ["ru", "kk", "en"].includes(workspace.profile.language)) setLanguage(workspace.profile.language);
        setIntroSeen(localStorage.getItem(introKey) === "1");
      } catch { setIntroSeen(false); }
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("authError");
      if (authError) {
        setError(authError === "school-domain" ? "domain" : "generic");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function login() {
    if (!configured) return;
    setError("");
    void signIn("microsoft-entra-id", { callbackUrl: window.location.origin });
  }
  function logout() { void signOut({ callbackUrl: window.location.origin }); }
  if (status === "loading" || introSeen === null) return <div className="auth-resolving" aria-live="polite"><span className="welcome-mark"><Layers size={25}/></span><LoaderCircle className="auth-spinner" size={17}/><span>{t.authLoading}</span></div>;
  if (identity) return cloneElement(children as ReactElement<{ identity?: AuthIdentity; onSignOut?: () => void }>, { identity, onSignOut: logout });
  return <main className={`auth-screen ${introSeen ? "returning" : "first-run"}`}>
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-brand"><span className="welcome-mark"><Layers size={25}/></span><strong>NIS <b>AI</b></strong></div>
      <p className="auth-eyebrow">{introSeen ? t.authWelcome : "NIS AI"}</p>
      <h1 id="auth-title">{introSeen ? t.authWelcome : t.authIntroTitle}</h1>
      {!introSeen ? <p className="auth-copy">{t.authIntroBody}</p> : null}
      <AuthButton label={t.authSignIn} onClick={login} disabled={!configured}/>
      <p className="auth-domain"><span className="auth-dot"/> {t.authAvailable}</p>
      {!introSeen ? <p className="auth-privacy"><ShieldCheck size={15}/>{t.authPrivacy}</p> : null}
      {!configured ? <p className="auth-message" role="alert">{t.authSetup}</p> : null}
      {error ? <p className="auth-message" role="alert">{error === "domain" ? t.authDomainError : t.authError}</p> : null}
    </section>
  </main>;
}

export function AuthGate({ enabled, configured, initialSession, children }: { enabled: boolean; configured: boolean; initialSession: AuthIdentity | null; children: React.ReactNode }) {
  if (!enabled) return <>{children}</>;
  if (!configured) return <main className="auth-screen returning"><section className="auth-panel" aria-labelledby="auth-setup-title"><div className="auth-brand"><span className="welcome-mark"><Layers size={25}/></span><strong>NIS <b>AI</b></strong></div><p className="auth-eyebrow">NIS AI</p><h1 id="auth-setup-title">{translations.ru.authWelcome}</h1><p className="auth-message" role="alert">{translations.ru.authSetup}</p></section></main>;
  return <EnabledAuthGate configured initialSession={initialSession}>{children}</EnabledAuthGate>;
}

export { Identity };
