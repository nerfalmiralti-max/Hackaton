import { getRecommendations } from "@/lib/server/recommendations";
import { requireApplicationAuth } from "@/lib/server/auth-guard";
import { publicError } from "@/lib/server/openai";
import { assertOrigin } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertOrigin(request);
    await requireApplicationAuth();
    return Response.json({ items: await getRecommendations() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const safe = publicError(error);
    return Response.json({ error: safe.code }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
