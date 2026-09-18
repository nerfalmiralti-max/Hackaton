import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function schoolStoreId(): Promise<string | undefined> {
  const configured = process.env.OPENAI_VECTOR_STORE_ID?.trim();
  if (configured) return configured;
  try {
    const manifest = JSON.parse(await readFile(path.join(process.cwd(), ".data/knowledge/index-manifest.json"), "utf8"));
    if (manifest.version === 1 && typeof manifest.vectorStoreId === "string" && /^vs_[a-zA-Z0-9]+$/.test(manifest.vectorStoreId)
      && Array.isArray(manifest.files) && manifest.files.some((f: { status?: string }) => f.status === "completed")) return manifest.vectorStoreId;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.warn("[nis-ai] Textbook index manifest unavailable"); }
  return undefined;
}
