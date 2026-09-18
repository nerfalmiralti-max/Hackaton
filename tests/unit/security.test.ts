import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertOrigin, rateLimit, readLimitedBody, sessionId } from "../../src/lib/server/security";

const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));

beforeEach(() => {
  jar.get.mockReset();
  jar.set.mockReset();
  vi.stubEnv("SESSION_SECRET", "unit-test-session-secret");
  vi.stubEnv("APP_ORIGIN", "https://school.example");
});
afterEach(() => vi.useRealTimers());

describe("signed session ownership", () => {
  const id = "ab".repeat(24);
  const signed = () => `${id}.${createHmac("sha256", "unit-test-session-secret").update(id).digest("hex")}`;

  it("reuses a valid signed session without rotating ownership", async () => {
    jar.get.mockReturnValue({ value: signed() });
    expect(await sessionId()).toBe(id);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it.each([undefined, "../another-session", `${id}.${"0".repeat(64)}`, `${id}.short`])("replaces an invalid session %s with a secure signed cookie", async value => {
    jar.get.mockReturnValue(value ? { value } : undefined);
    const created = await sessionId();
    expect(created).toMatch(/^[a-f0-9]{48}$/);
    expect(created).not.toBe(id);
    const expectedSignature = createHmac("sha256", "unit-test-session-secret").update(created).digest("hex");
    expect(jar.set).toHaveBeenCalledWith("nis-session", `${created}.${expectedSignature}`, expect.objectContaining({ httpOnly: true, secure: true, sameSite: "strict", path: "/" }));
  });

  it("does not accept a valid signature copied onto a different session ID", async () => {
    jar.get.mockReturnValue({ value: signed().replace(id, "cd".repeat(24)) });
    expect(await sessionId()).not.toBe("cd".repeat(24));
    expect(jar.set).toHaveBeenCalledOnce();
  });
});

describe("request origin", () => {
  it("accepts configured same-origin requests and local development", () => {
    expect(() => assertOrigin(new Request("https://school.example/api/chat", { headers: { origin: "https://school.example" } }))).not.toThrow();
    expect(() => assertOrigin(new Request("http://127.0.0.1:3000/api/chat"))).not.toThrow();
  });
  it("accepts the browser loopback host when Next uses an internal localhost URL", () => {
    expect(() => assertOrigin(new Request("http://localhost:3000/api/chat", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).not.toThrow();
    expect(() => assertOrigin(new Request("http://localhost:3000/api/chat", { headers: { host: "127.0.0.1:3000", origin: "https://evil.example" } }))).toThrow();
  });

  it.each([
    ["https://school.example/api/chat", { origin: "https://evil.example" }],
    ["https://evil.example/api/chat", { origin: "https://evil.example" }],
    ["https://school.example/api/chat", { "sec-fetch-site": "cross-site" }],
  ])("rejects foreign request origins: %s %o", (url, headers) => {
    expect(() => assertOrigin(new Request(url, { headers }))).toThrow(expect.objectContaining({ code: "FORBIDDEN", status: 403 }));
  });
});

describe("bounded request bodies", () => {
  it("rejects an advertised oversize body before consuming its stream", async () => {
    const request = new Request("http://localhost", { method: "POST", body: "short", headers: { "content-length": "100" } });
    await expect(readLimitedBody(request, 10)).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
    expect(request.bodyUsed).toBe(false);
  });

  it.each([undefined, "1"])("counts actual streamed bytes even with content-length %s", async length => {
    const cancel = vi.fn();
    const chunks = [new Uint8Array(4), new Uint8Array(4)];
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { const chunk = chunks.shift(); if (chunk) controller.enqueue(chunk); },
      cancel,
    });
    const init = { method: "POST", body, duplex: "half", headers: length ? { "content-length": length } : {} } as RequestInit;
    const request = new Request("http://localhost", init);
    await expect(readLimitedBody(request, 7)).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
    expect(request.body?.locked).toBe(false);
  });

  it("accepts exact byte limits and counts UTF-8 bytes rather than characters", async () => {
    const make = () => new Request("http://localhost", { method: "POST", body: "\u049a" });
    expect(await readLimitedBody(make(), 2)).toEqual(Buffer.from("\u049a"));
    await expect(readLimitedBody(make(), 1)).rejects.toMatchObject({ status: 413 });
    await expect(readLimitedBody(new Request("http://localhost"), 10)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

it("limits repeated requests per session and releases the budget after the window", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-18T00:00:00Z"));
  rateLimit("rate-test-a", 2, 1000);
  rateLimit("rate-test-a", 2, 1000);
  expect(() => rateLimit("rate-test-a", 2, 1000)).toThrow(expect.objectContaining({ code: "RATE_LIMITED", status: 429 }));
  expect(() => rateLimit("rate-test-b", 2, 1000)).not.toThrow();
  vi.advanceTimersByTime(1000);
  expect(() => rateLimit("rate-test-a", 2, 1000)).not.toThrow();
});
