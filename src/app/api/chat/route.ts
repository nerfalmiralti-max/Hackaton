import { chatSchema, validateImage } from "@/lib/validation";
import { generateAnswer } from "@/lib/server/ai";
import { getOpenAI, publicError } from "@/lib/server/openai";
import { AppError, assertOrigin, rateLimit, readLimitedBody, sessionId } from "@/lib/server/security";
import { requireApplicationAuth } from "@/lib/server/auth-guard";
export const runtime = "nodejs";
export const maxDuration = 120;
const active = new Set<string>();
export async function POST(request: Request) {
  let session: string | undefined;
  try {
    assertOrigin(request);
    await requireApplicationAuth();
    session = await sessionId();
    rateLimit(`chat:${session}`, 12);
    rateLimit("chat:global:day", 150, 86_400_000);
    if (active.has(session)) throw new AppError("RATE_LIMITED", 429);
    getOpenAI();
    const bytes = await readLimitedBody(request, 5_700_000);
    let body: unknown;
    try { body = JSON.parse(bytes.toString("utf8")); } catch { throw new AppError("INVALID_REQUEST"); }
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success || (parsed.data.image && !validateImage(parsed.data.image.dataUrl))) throw new AppError("INVALID_REQUEST");
    active.add(session);
    const id = session;
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) controller.abort();
    const timeout = setTimeout(abort, 100_000);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(sink) {
        try {
          for await (const event of generateAnswer(parsed.data, id, controller.signal)) {
            if (controller.signal.aborted) break;
            sink.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          }
        } catch (error) {
          if (!controller.signal.aborted) sink.enqueue(encoder.encode(`${JSON.stringify({ type: "error", code: publicError(error).code })}\n`));
        } finally {
          clearTimeout(timeout);
          active.delete(id);
          request.signal.removeEventListener("abort", abort);
          try { sink.close(); } catch { /* The browser may have cancelled its reader. */ }
        }
      },
      cancel() { controller.abort(); active.delete(id); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch (error) {
    const safe = publicError(error);
    return Response.json({ error: safe.code }, { status: safe.status });
  }
}
