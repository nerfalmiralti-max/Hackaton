import { refreshKnowledge, uploadKnowledge } from "@/lib/server/knowledge";
import { publicError } from "@/lib/server/openai";
import { AppError, assertOrigin, rateLimit, readLimitedBody, sessionId } from "@/lib/server/security";
import { MAX_FILE_BYTES } from "@/lib/validation";
import { requireApplicationAuth } from "@/lib/server/auth-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const { code, status } = publicError(error);
  return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    assertOrigin(request);
    await requireApplicationAuth();
    const id = await sessionId();
    rateLimit(`knowledge:read:${id}`, 30);
    rateLimit("knowledge:read:global", 240);
    return Response.json({ files: await refreshKnowledge(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await requireApplicationAuth();
    const id = await sessionId();
    rateLimit(`knowledge:upload:${id}`, 6);
    rateLimit("knowledge:upload:global:day", 60, 24 * 60 * 60 * 1000);
    const contentType = request.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new AppError("INVALID_REQUEST");
    const bytes = await readLimitedBody(request, MAX_FILE_BYTES + 64 * 1024);
    let form: FormData;
    try {
      form = await new Request(request.url, {
        method: "POST", headers: { "content-type": contentType }, body: new Uint8Array(bytes),
      }).formData();
    } catch { throw new AppError("INVALID_REQUEST"); }
    const input = form.get("file");
    if (!(input instanceof File) || form.getAll("file").length !== 1 ||
        [...form.keys()].some((key) => key !== "file")) throw new AppError("INVALID_REQUEST");
    if (input.size > MAX_FILE_BYTES) throw new AppError("FILE_TOO_LARGE", 413);
    return Response.json({ file: await uploadKnowledge(id, input) }, {
      status: 201, headers: { "Cache-Control": "no-store" },
    });
  } catch (error) { return failure(error); }
}
