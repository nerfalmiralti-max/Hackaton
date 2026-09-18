import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("../../src/auth", () => ({ auth: authMock.auth }));

import { requireApplicationAuth } from "../../src/lib/server/auth-guard";

beforeEach(() => {
  vi.stubEnv("NIS_AUTH_ENABLED", "false");
  vi.stubEnv("AUTH_SECRET", "secret");
  vi.stubEnv("AUTH_MICROSOFT_ENTRA_ID_ID", "client");
  vi.stubEnv("AUTH_MICROSOFT_ENTRA_ID_SECRET", "secret");
  authMock.auth.mockReset();
});

describe("application auth guard", () => {
  it("preserves the existing route behavior when the feature is disabled", async () => {
    await expect(requireApplicationAuth()).resolves.toBeNull();
    expect(authMock.auth).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request when enabled", async () => {
    vi.stubEnv("NIS_AUTH_ENABLED", "true");
    authMock.auth.mockResolvedValue(null);
    await expect(requireApplicationAuth()).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
  });

  it("returns a safe setup error when enabled without credentials", async () => {
    vi.stubEnv("NIS_AUTH_ENABLED", "true");
    vi.stubEnv("AUTH_SECRET", "");
    await expect(requireApplicationAuth()).rejects.toMatchObject({ code: "AUTH_NOT_CONFIGURED", status: 503 });
    expect(authMock.auth).not.toHaveBeenCalled();
  });

  it("accepts an authenticated school session", async () => {
    vi.stubEnv("NIS_AUTH_ENABLED", "true");
    authMock.auth.mockResolvedValue({ user: { email: "student@akt.nis.edu.kz" } });
    await expect(requireApplicationAuth()).resolves.toMatchObject({ user: { email: "student@akt.nis.edu.kz" } });
  });
});
