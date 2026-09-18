import { auth } from "@/auth";
import { authConfigured, authEnabled, requireAuthConfiguration } from "./auth-config";
import { AppError } from "./security";

export async function requireApplicationAuth() {
  if (!authEnabled()) return null;
  requireAuthConfiguration();
  const session = await auth();
  if (!session?.user?.email) throw new AppError("AUTH_REQUIRED", 401);
  return session;
}

export function authStatus() {
  return { enabled: authEnabled(), configured: !authEnabled() || authConfigured() };
}
