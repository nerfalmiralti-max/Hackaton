import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
const ephemeralSecret = randomBytes(32).toString("hex");
export class AppError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
function signature(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || process.env.OPENAI_API_KEY || ephemeralSecret).update(value).digest("hex");
}
export async function sessionId() {
  const jar = await cookies();
  const existing = jar.get("nis-session")?.value ?? "";
  const [id, sig] = existing.split(".");
  if (/^[a-f0-9]{48}$/.test(id ?? "") && /^[a-f0-9]{64}$/.test(sig ?? "") && timingSafeEqual(Buffer.from(sig), Buffer.from(signature(id)))) return id;
  const created = randomBytes(24).toString("hex");
  jar.set("nis-session", `${created}.${signature(created)}`, { httpOnly: true, sameSite: "strict", secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false, path: "/", maxAge: 60 * 60 * 24 * 7 });
  return created;
}
export function assertOrigin(request: Request) {
  const url = new URL(request.url);
  // Next's internal request URL can use localhost even when the browser uses 127.0.0.1.
  const host = request.headers.get("host");
  const publicUrl = host ? new URL(`${url.protocol}//${host}`) : url;
  const origin = request.headers.get("origin");
  const allowed = process.env.APP_ORIGIN;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(publicUrl.hostname);
  if (!local && (!allowed || publicUrl.origin !== allowed)) throw new AppError("FORBIDDEN", 403);
  if (origin && origin !== publicUrl.origin && origin !== allowed) throw new AppError("FORBIDDEN", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new AppError("FORBIDDEN", 403);
}
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(id: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key);
  const bucket = buckets.get(id) ?? { count: 0, reset: now + windowMs };
  if (bucket.count >= limit) throw new AppError("RATE_LIMITED", 429);
  bucket.count += 1;
  buckets.set(id, bucket);
}
export async function readLimitedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new AppError("FILE_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_REQUEST");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AppError("FILE_TOO_LARGE", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
