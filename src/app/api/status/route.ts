import { modelName, publicError } from "@/lib/server/openai";
import { assertOrigin, sessionId } from "@/lib/server/security";
import { readState } from "@/lib/server/store";
import { schoolStoreId } from "@/lib/server/school-knowledge";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    assertOrigin(request);
    const state = await readState(await sessionId());
    return Response.json({ configured: Boolean(process.env.OPENAI_API_KEY?.trim()), schoolConnected: Boolean(await schoolStoreId()), model: modelName(), files: state.files, development: process.env.NODE_ENV === "development" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { const safe = publicError(error); return Response.json({ error: safe.code }, { status: safe.status }); }
}
