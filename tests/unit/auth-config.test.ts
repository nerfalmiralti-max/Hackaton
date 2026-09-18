import { beforeEach, describe, expect, it } from "vitest";
import { allowedEmailDomain, authConfigured, authEnabled, isAllowedSchoolEmail, isAllowedTenant } from "../../src/lib/server/auth-config";

describe("Microsoft school account policy", () => {
  beforeEach(() => {
    process.env.NIS_AUTH_ENABLED = "true";
    process.env.AUTH_SECRET = "test-secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client-id";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "client-secret";
    process.env.NIS_ALLOWED_EMAIL_DOMAIN = "akt.nis.edu.kz";
    delete process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID;
  });

  it("is disabled unless explicitly enabled", () => {
    expect(authEnabled()).toBe(true);
    process.env.NIS_AUTH_ENABLED = "false";
    expect(authEnabled()).toBe(false);
  });

  it("requires all server credentials when enabled", () => {
    expect(authConfigured()).toBe(true);
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
    expect(authConfigured()).toBe(false);
  });

  it.each(["student@akt.nis.edu.kz", "STUDENT@AKT.NIS.EDU.KZ"]) ("allows the exact configured school domain: %s", email => {
    expect(isAllowedSchoolEmail(email)).toBe(true);
  });

  it.each(["student@gmail.com", "student@evilakt.nis.edu.kz", "student@akt.nis.edu.kz.evil.com", "student@evil.akt.nis.edu.kz", "student@akt.nis.edu.kz@evil.com"]) ("rejects non-exact school identifiers: %s", email => {
    expect(isAllowedSchoolEmail(email)).toBe(false);
  });

  it("requires a configured tenant claim when one is supplied", () => {
    expect(allowedEmailDomain()).toBe("akt.nis.edu.kz");
    expect(isAllowedTenant("tenant-a")).toBe(true);
    process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID = "tenant-a";
    expect(isAllowedTenant("TENANT-A")).toBe(true);
    expect(isAllowedTenant("tenant-b")).toBe(false);
  });
});
