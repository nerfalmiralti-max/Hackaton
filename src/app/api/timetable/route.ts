import { getTimetable } from "@/lib/server/timetable";
import { requireApplicationAuth } from "@/lib/server/auth-guard";
import { publicError } from "@/lib/server/openai";
import { AppError, assertOrigin, rateLimit, sessionId } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertOrigin(request);
    await requireApplicationAuth();
    const session = await sessionId();
    rateLimit(`timetable:${session}`, 12, 60_000);
    const params = new URL(request.url).searchParams;
    const classId = params.get("class") || undefined;
    const week = params.get("week") ?? undefined;
    if ((classId && !/^-?\d+$/.test(classId)) || (week && !/^\d{4}-\d{2}-\d{2}$/.test(week))) throw new AppError("INVALID_REQUEST");
    return Response.json(await getTimetable(classId, week), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = publicError(error);
    const status = safe.code === "UPSTREAM_ERROR" ? 503 : safe.status;
    return Response.json({ error: safe.code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
