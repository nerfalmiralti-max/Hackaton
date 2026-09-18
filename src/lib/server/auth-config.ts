import { AppError } from "./security";

export const DEFAULT_ALLOWED_EMAIL_DOMAIN = "akt.nis.edu.kz";

export function authEnabled() {
  return process.env.NIS_AUTH_ENABLED?.trim().toLowerCase() === "true";
}

export function authConfigured() {
  return Boolean(
    process.env.AUTH_SECRET?.trim() &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim(),
  );
}

export function allowedEmailDomain() {
  return (process.env.NIS_ALLOWED_EMAIL_DOMAIN || DEFAULT_ALLOWED_EMAIL_DOMAIN).trim().toLowerCase();
}

export function isAllowedSchoolEmail(value: unknown) {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  const match = /^[^@\s]+@([^@\s]+)$/.exec(email);
  return Boolean(match && match[1] === allowedEmailDomain());
}

export function isAllowedTenant(value: unknown) {
  const configured = process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID?.trim().toLowerCase();
  return !configured || (typeof value === "string" && value.trim().toLowerCase() === configured);
}

export function requireAuthConfiguration() {
  if (!authConfigured()) throw new AppError("AUTH_NOT_CONFIGURED", 503);
}
