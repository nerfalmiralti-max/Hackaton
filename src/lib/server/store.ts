import "server-only";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { KnowledgeFile } from "../types";
export interface SessionState { vectorStoreId?: string; files: KnowledgeFile[] }
const directory = path.join(process.cwd(), ".data", "sessions");
const locks = new Map<string, Promise<unknown>>();
export async function readState(id: string): Promise<SessionState> {
  try { return JSON.parse(await readFile(path.join(directory, `${id}.json`), "utf8")) as SessionState; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { files: [] }; throw error; }
}
export async function withState<T>(id: string, operation: (state: SessionState) => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const state = await readState(id);
    const result = await operation(state);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${id}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify(state), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
    return result;
  });
  locks.set(id, next);
  try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
}
