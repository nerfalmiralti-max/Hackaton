"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export function AuthSessionProvider({ children, session, enabled }: { children: React.ReactNode; session: Session | null; enabled: boolean }) {
  return enabled ? <SessionProvider session={session}>{children}</SessionProvider> : <>{children}</>;
}
