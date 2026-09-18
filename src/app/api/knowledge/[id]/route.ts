import { deleteKnowledge } from "@/lib/server/knowledge";
import { publicError } from "@/lib/server/openai";
import { AppError, assertOrigin, rateLimit, sessionId } from "@/lib/server/security";
import { requireApplicationAuth } from "@/lib/server/auth-guard";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertOrigin(request);
    await requireApplicationAuth();
    const owner = await sessionId();
    rateLimit(`knowledge:delete:${owner}`, 20);
    rateLimit("knowledge:delete:global", 120);
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new AppError("NOT_FOUND", 404);
    await deleteKnowledge(owner, id);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const { code, status } = publicError(error);
    return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
