import { getLocalCatalog, searchLocalKnowledge } from "@/lib/server/local-knowledge";
import { assertOrigin, rateLimit, sessionId } from "@/lib/server/security";
import { publicError } from "@/lib/server/openai";
import { requireApplicationAuth } from "@/lib/server/auth-guard";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    assertOrigin(request);
    await requireApplicationAuth();
    rateLimit(`materials:${await sessionId()}`, 40);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 500);
    const files = await getLocalCatalog();
    const results = query ? await searchLocalKnowledge(query, { limit: 3 }) : [];
    return Response.json({ files, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { const safe = publicError(error); return Response.json({ error: safe.code }, { status: safe.status }); }
}
