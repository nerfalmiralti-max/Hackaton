import "server-only";
import OpenAI, { toFile } from "openai";
import type { KnowledgeFile } from "../types";
import { MAX_FILE_BYTES, validateDocument } from "../validation";
import { getOpenAI } from "./openai";
import { AppError } from "./security";
import { readState, withState, type SessionState } from "./store";

const MAX_FILES = 12;

function isMissing(error: unknown) {
  return error instanceof OpenAI.APIError && error.status === 404;
}

function isSharedStore(id: string | undefined) {
  return Boolean(id && id === process.env.OPENAI_VECTOR_STORE_ID?.trim());
}

function assertPersonalStore(state: SessionState) {
  if (isSharedStore(state.vectorStoreId)) throw new AppError("FORBIDDEN", 403);
}

function invalidateStore(state: SessionState) {
  delete state.vectorStoreId;
  // Keep owned IDs so the underlying Files API objects can still be deleted.
  for (const file of state.files) file.status = "failed";
}

async function refreshStore(client: OpenAI, state: SessionState) {
  if (!state.vectorStoreId) return;
  assertPersonalStore(state);
  try {
    const store = await client.vectorStores.retrieve(state.vectorStoreId);
    if (store.status === "expired") invalidateStore(state);
  } catch (error) {
    if (!isMissing(error)) throw error;
    invalidateStore(state);
  }
}

function safeFilename(name: string) {
  const normalized = name.normalize("NFC");
  if (!normalized || normalized !== normalized.trim() || normalized.startsWith(".") ||
      Buffer.byteLength(normalized, "utf8") > 240 ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/u.test(normalized) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(normalized)) {
    throw new AppError("INVALID_FILE");
  }
  return normalized;
}

/** A local snapshot for chat; no OpenAI requests or indexing polls. */
export async function getKnowledge(id: string): Promise<{ files: KnowledgeFile[]; vectorStoreId?: string }> {
  const state = await readState(id);
  if (isSharedStore(state.vectorStoreId)) return { files: [] };
  return { files: state.files, vectorStoreId: state.vectorStoreId };
}

export async function refreshKnowledge(id: string): Promise<KnowledgeFile[]> {
  return withState(id, async (state) => {
    assertPersonalStore(state);
    if (!state.vectorStoreId) return state.files;
    const client = getOpenAI();
    await refreshStore(client, state);
    if (!state.vectorStoreId) return state.files;
    for (const file of state.files) {
      if (file.status === "failed") continue;
      try {
        const indexed = await client.vectorStores.files.retrieve(file.id, { vector_store_id: state.vectorStoreId });
        file.status = indexed.status === "completed" ? "completed"
          : indexed.status === "in_progress" ? "in_progress" : "failed";
      } catch (error) {
        if (!isMissing(error)) throw error;
        file.status = "failed";
      }
    }
    return state.files;
  });
}

export async function uploadKnowledge(id: string, input: File): Promise<KnowledgeFile> {
  const name = safeFilename(input.name);
  if (input.size > MAX_FILE_BYTES) throw new AppError("FILE_TOO_LARGE", 413);
  const bytes = Buffer.from(await input.arrayBuffer());
  const invalid = validateDocument(name, bytes);
  if (invalid) throw new AppError(invalid, invalid === "FILE_TOO_LARGE" ? 413 : 400);
  const client = getOpenAI();
  let uploadedId: string | undefined;
  try {
    // Returning an error lets withState persist expiry and cleanup metadata first.
    const result = await withState(id, async (state) => {
      try {
        assertPersonalStore(state);
        await refreshStore(client, state);
        if (state.files.length >= MAX_FILES) throw new AppError("TOO_MANY_FILES", 409);
        if (!state.vectorStoreId) {
          const store = await client.vectorStores.create({
            name: "Personal learning documents",
            expires_after: { anchor: "last_active_at", days: 7 },
          });
          state.vectorStoreId = store.id;
        }
        const uploaded = await client.files.create({ file: await toFile(bytes, name), purpose: "assistants" });
        uploadedId = uploaded.id;
        const file: KnowledgeFile = {
          id: uploaded.id, name, bytes: bytes.length, status: "in_progress", createdAt: Date.now(),
        };
        // No createAndPoll: indexing continues asynchronously after this request.
        await client.vectorStores.files.create(state.vectorStoreId, { file_id: uploaded.id });
        state.files.push(file);
        return { file };
      } catch (error) {
        if (uploadedId) {
          const failedId = uploadedId;
          try {
            // Deleting the underlying file also removes any vector association.
            await client.files.delete(failedId);
            uploadedId = undefined;
          } catch (cleanupError) {
            if (isMissing(cleanupError)) uploadedId = undefined;
            else {
              state.files.push({ id: failedId, name, bytes: bytes.length, status: "failed", createdAt: Date.now() });
              // Preserve the owned ID for an explicit DELETE retry.
              uploadedId = undefined;
            }
          }
        }
        return { error };
      }
    });
    if ("error" in result) throw result.error;
    return result.file;
  } catch (error) {
    // Also compensate if persisting a successful upload failed.
    if (uploadedId) {
      try { await client.files.delete(uploadedId); }
      catch { /* The primary error is returned without exposing upstream details. */ }
    }
    throw error;
  }
}

export async function deleteKnowledge(id: string, fileId: string): Promise<void> {
  await withState(id, async (state) => {
    assertPersonalStore(state);
    if (!state.files.some((file) => file.id === fileId)) throw new AppError("NOT_FOUND", 404);
    const client = getOpenAI();
    await refreshStore(client, state);
    if (state.vectorStoreId) {
      try { await client.vectorStores.files.delete(fileId, { vector_store_id: state.vectorStoreId }); }
      catch (error) { if (!isMissing(error)) throw error; }
    }
    try { await client.files.delete(fileId); }
    catch (error) { if (!isMissing(error)) throw error; }
    state.files = state.files.filter((file) => file.id !== fileId);
  });
}
