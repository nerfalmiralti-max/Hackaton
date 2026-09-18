import "server-only";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

export interface LocalCatalogEntry {
  id: string; name: string; subject: string; grade: number;
  language: string; pages: number; available: boolean;
  vectorIndexed: boolean;
  vectorIndexStatus: "not-indexed" | "completed" | "pending" | "failed" | "unknown";
}
interface Book extends Omit<LocalCatalogEntry, "available" | "vectorIndexed" | "vectorIndexStatus"> {
  textPath: string;
  extraction: { status: string; pagesWithText: number };
}
interface Chunk { book: Book; page: number; index: number; text: string; normalized: string; words: Set<string>; prefixes: Map<string, string[]> }
interface CachedBook { stamp: string; chunks: Chunk[]; available: boolean; sha256: string }
const root = process.cwd();
const privateRoot = resolve(root, ".data/knowledge");
const cache = new Map<string, CachedBook>();
let catalogStamp = "";
let catalog: Book[] = [];
let loading: Promise<{ books: Book[]; chunks: Chunk[]; available: Set<string> }> | undefined;
const normalize = (text: string) => text.normalize("NFKC").toLowerCase();
const words = (text: string) => normalize(text).match(/[\p{L}\p{N}]{2,}/gu) ?? [];
const stopwords = new Set(words([
  "a an the and or but of to in on at by for from with as is are was were be been being this that these those it its i me my we our you your he she they their what which who where when why how do does did can could would should please explain show tell help according material materials textbook textbooks book books question questions answer answers lesson lessons grade class school nis context about using use find give",
  "\u0438 \u0438\u043b\u0438 \u043d\u043e \u043d\u0435 \u043d\u0438 \u043d\u0430 \u0432 \u0432\u043e \u043f\u043e \u0438\u0437 \u0437\u0430 \u043e\u0442 \u0434\u043e \u0434\u043b\u044f \u0441\u043e \u0441 \u043a \u043a\u043e \u0443 \u043e \u043e\u0431 \u043f\u0440\u0438 \u043a\u0430\u043a \u0447\u0442\u043e \u044d\u0442\u043e \u044d\u0442\u043e\u0433\u043e \u044d\u0442\u043e\u0442 \u044d\u0442\u043e\u0439 \u044d\u0442\u0438 \u0442\u043e \u0442\u0430\u043a \u043c\u043d\u0435 \u043c\u0435\u043d\u044f \u043c\u043e\u0439 \u043c\u044b \u043d\u0430\u0448 \u0442\u044b \u0432\u044b \u0432\u0430\u0448 \u043e\u043d \u043e\u043d\u0430 \u043e\u043d\u0438 \u0438\u0445 \u0447\u0435\u043c \u0447\u0435\u0433\u043e \u043a\u0442\u043e \u0433\u0434\u0435 \u043a\u043e\u0433\u0434\u0430 \u043f\u043e\u0447\u0435\u043c\u0443 \u043a\u0430\u043a\u043e\u0439 \u043a\u0430\u043a\u0430\u044f \u043a\u0430\u043a\u0438\u0435 \u0435\u0441\u043b\u0438 \u043b\u0438 \u0436\u0435 \u0431\u044b \u0434\u0430 \u043d\u0435\u0442 \u0435\u0441\u0442\u044c \u0431\u044b\u043b \u0431\u044b\u043b\u0430 \u0431\u044b\u043b\u0438 \u0431\u044b\u0442\u044c \u043e\u0431\u044a\u044f\u0441\u043d\u0438 \u043e\u0431\u044a\u044f\u0441\u043d\u0438\u0442\u0435 \u043e\u0431\u044a\u044f\u0441\u043d\u0438\u0442\u044c \u043f\u043e\u043a\u0430\u0436\u0438 \u043f\u043e\u043a\u0430\u0436\u0438\u0442\u0435 \u0440\u0430\u0441\u0441\u043a\u0430\u0436\u0438 \u0440\u0430\u0441\u0441\u043a\u0430\u0436\u0438\u0442\u0435 \u043f\u043e\u043c\u043e\u0433\u0438 \u043f\u043e\u043c\u043e\u0433\u0438\u0442\u0435 \u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430 \u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0430\u0445 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0430\u043c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0443 \u0443\u0447\u0435\u0431\u043d\u0438\u043a \u0443\u0447\u0435\u0431\u043d\u0438\u043a\u0438 \u043a\u043d\u0438\u0433\u0435 \u043a\u043d\u0438\u0433\u0438 \u0432\u043e\u043f\u0440\u043e\u0441 \u0432\u043e\u043f\u0440\u043e\u0441\u044b \u043e\u0442\u0432\u0435\u0442 \u043e\u0442\u0432\u0435\u0442\u044b \u043a\u043b\u0430\u0441\u0441 \u043a\u043b\u0430\u0441\u0441\u0430 \u0448\u043a\u043e\u043b\u0430 \u043d\u0438\u0441 \u0442\u0435\u043c\u0443 \u0442\u0435\u043c\u044b",
  "\u0436\u04d9\u043d\u0435 \u043d\u0435\u043c\u0435\u0441\u0435 \u0431\u0456\u0440\u0430\u049b \u04af\u0448\u0456\u043d \u0442\u0443\u0440\u0430\u043b\u044b \u0431\u043e\u0439\u044b\u043d\u0448\u0430 \u0431\u04b1\u043b \u043e\u0441\u044b \u0441\u043e\u043b \u043e\u043b \u043e\u043b\u0430\u0440 \u043c\u0435\u043d \u0441\u0435\u043d \u0441\u0456\u0437 \u0431\u0456\u0437 \u043c\u0430\u0493\u0430\u043d \u043c\u0435\u043d\u0456\u04a3 \u0431\u0456\u0437\u0434\u0456\u04a3 \u049b\u0430\u043b\u0430\u0439 \u043d\u0435 \u043d\u0435\u043d\u0456 \u049b\u0430\u043d\u0434\u0430\u0439 \u043a\u0456\u043c \u049b\u0430\u0439 \u049b\u0430\u0439\u0434\u0430 \u049b\u0430\u0448\u0430\u043d \u043d\u0435\u0433\u0435 \u0442\u04af\u0441\u0456\u043d\u0434\u0456\u0440 \u0442\u04af\u0441\u0456\u043d\u0434\u0456\u0440\u0448\u0456 \u0442\u04af\u0441\u0456\u043d\u0434\u0456\u0440\u0456\u04a3\u0456\u0437 \u0442\u04af\u0441\u0456\u043d\u0434\u0456\u0440\u0443 \u043a\u04e9\u0440\u0441\u0435\u0442 \u043a\u04e9\u0440\u0441\u0435\u0442\u0448\u0456 \u043a\u04e9\u0440\u0441\u0435\u0442\u0456\u04a3\u0456\u0437 \u043a\u04e9\u043c\u0435\u043a\u0442\u0435\u0441 \u043a\u04e9\u043c\u0435\u043a\u0442\u0435\u0441\u0448\u0456 \u0431\u0435\u0440\u0448\u0456 \u0441\u04b1\u0440\u0430\u049b \u0441\u04b1\u0440\u0430\u049b\u0442\u0430\u0440 \u0436\u0430\u0443\u0430\u043f \u0436\u0430\u0443\u0430\u043f\u0442\u0430\u0440 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0434\u0430\u0440 \u043a\u0456\u0442\u0430\u043f \u043a\u0456\u0442\u0430\u043f\u0442\u0430\u0440 \u043e\u049b\u0443\u043b\u044b\u049b \u043e\u049b\u0443\u043b\u044b\u049b\u0442\u0430\u0440 \u0441\u044b\u043d\u044b\u043f \u043c\u0435\u043a\u0442\u0435\u043f \u043d\u0438\u0441",
].join(" ")));
const instructionRoots = /^(?:\u043e\u0431\u044a\u044f\u0441\u043d|\u043f\u043e\u043a\u0430\u0436|\u0440\u0430\u0441\u0441\u043a\u0430\u0436|\u043f\u043e\u043c\u043e\u0433|\u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b|\u0443\u0447\u0435\u0431\u043d\u0438\u043a|\u0432\u043e\u043f\u0440\u043e\u0441|\u0441\u043e\u0433\u043b\u0430\u0441\u043d|\u0442\u04af\u0441\u0456\u043d\u0434\u0456\u0440|\u043a\u04e9\u043c\u0435\u043a\u0442\u0435\u0441|\u043a\u04e9\u0440\u0441\u0435\u0442|\u0441\u04b1\u0440\u0430\u049b|\u043e\u049b\u0443\u043b\u044b\u049b)/u;

function prefixOf(word: string) {
  const kazakh = /[\u04d9\u0493\u049b\u04a3\u04e9\u04b1\u04af\u04bb\u0456]/u.test(word);
  const suffix = kazakh
    ? /(?:\u043b\u0430\u0440\u0434\u044b\u04a3|\u043b\u0435\u0440\u0434\u0456\u04a3|\u0434\u0430\u0440\u0434\u044b\u04a3|\u0434\u0435\u0440\u0434\u0456\u04a3|\u0442\u0430\u0440\u0434\u044b\u04a3|\u0442\u0435\u0440\u0434\u0456\u04a3|\u043b\u0430\u0440\u044b|\u043b\u0435\u0440\u0456|\u0434\u0430\u0440\u044b|\u0434\u0435\u0440\u0456|\u0442\u0430\u0440\u044b|\u0442\u0435\u0440\u0456|\u043b\u0430\u0440|\u043b\u0435\u0440|\u0434\u0430\u0440|\u0434\u0435\u0440|\u0442\u0430\u0440|\u0442\u0435\u0440|\u043d\u044b\u04a3|\u043d\u0456\u04a3|\u0434\u044b\u04a3|\u0434\u0456\u04a3|\u0442\u044b\u04a3|\u0442\u0456\u04a3|\u0442\u0430\u043d|\u0442\u0435\u043d|\u0434\u0430\u043d|\u0434\u0435\u043d|\u043d\u0430\u043d|\u043d\u0435\u043d|\u0493\u0430|\u0433\u0435|\u049b\u0430|\u043a\u0435|\u0434\u0430|\u0434\u0435|\u0442\u0430|\u0442\u0435|\u0434\u044b|\u0434\u0456|\u0442\u044b|\u0442\u0456|\u043d\u044b|\u043d\u0456|\u043c\u0435\u043d|\u0431\u0435\u043d|\u043f\u0435\u043d|\u0441\u044b|\u0441\u0456|\u044b\u043d|\u0456\u043d|\u044b|\u0456)$/u
    : /[\u0430-\u044f\u0451]/u.test(word)
      ? /(?:\u0438\u044f\u043c\u0438|\u044f\u043c\u0438|\u0430\u043c\u0438|\u043e\u0433\u043e|\u0435\u043c\u0443|\u043e\u043c\u0443|\u044b\u043c\u0438|\u0438\u043c\u0438|\u043e\u0432|\u0435\u0432|\u0430\u0445|\u044f\u0445|\u043e\u043c|\u0435\u043c|\u0438\u0439|\u044b\u0439|\u043e\u0439|\u0430\u044f|\u044f\u044f|\u043e\u0435|\u0435\u0435|\u0443\u044e|\u044e\u044e|\u044b\u0435|\u0438\u0435|\u0430\u043c|\u044f\u043c|\u0430|\u044f|\u044b|\u0438|\u0443|\u044e|\u0435|\u043e)$/u
      : /(?:ing|es|s)$/u;
  let stripped = word.replace(suffix, "");
  // Kazakh commonly combines plural and case endings; at most two removals.
  if (kazakh && stripped.length >= 5) {
    const base = stripped.replace(suffix, "");
    if (base.length >= 5) stripped = base;
  }
  return stripped.length >= 5 ? stripped : word;
}
const stopPrefixes = new Set([...stopwords].map(prefixOf));

function prefixBuckets(tokens: Set<string>) {
  const buckets = new Map<string, string[]>();
  for (const token of tokens) {
    if (token.length < 5) continue;
    const key = token.slice(0, 5);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(token); else buckets.set(key, [token]);
  }
  return buckets;
}

async function snapshot() {
  if (loading) return loading;
  loading = load();
  try { return await loading; } finally { loading = undefined; }
}

async function load() {
  const catalogPath = resolve(root, "knowledge/catalog.json");
  try {
    const info = await stat(catalogPath);
    const stamp = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
    if (stamp !== catalogStamp) {
      const parsed: unknown = JSON.parse(await readFile(catalogPath, "utf8"));
      if (!Array.isArray(parsed)) throw new Error("Invalid local catalog");
      catalog = parsed.filter((book): book is Book => Boolean(book &&
        typeof book.id === "string" && /^[a-z0-9-]+$/.test(book.id) &&
        typeof book.name === "string" && typeof book.subject === "string" &&
        Number.isInteger(book.grade) && Number.isInteger(book.pages) &&
        ["kk", "ru", "en"].includes(book.language) &&
        book.textPath === `.data/knowledge/${book.id}.txt` &&
        book.extraction && typeof book.extraction.status === "string"));
      catalogStamp = stamp;
      cache.clear();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    catalog = []; catalogStamp = ""; cache.clear();
  }
  const chunks: Chunk[] = [];
  const available = new Set<string>();
  for (const book of catalog) {
    if (book.extraction.status !== "extracted" || !book.extraction.pagesWithText) continue;
    try {
      const path = await realpath(resolve(privateRoot, `${book.id}.txt`));
      if (!path.startsWith(privateRoot + sep)) continue;
      const info = await stat(path);
      if (!info.isFile() || info.size > 32 * 1024 * 1024) continue;
      const stamp = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
      let cached = cache.get(book.id);
      if (!cached || cached.stamp !== stamp) {
        const bytes = await readFile(path);
        const text = bytes.toString("utf8");
        const parsed: Chunk[] = [];
        text.split("\f").slice(0, book.pages).forEach((page, pageIndex) => {
          const clean = page.replace(/\s+/gu, " ").trim();
          for (let offset = 0; offset < clean.length; offset += 1600) {
            const excerpt = clean.slice(offset, offset + 1800);
            const terms = words(excerpt);
            if (!terms.length) continue;
            const tokens = new Set(terms);
            parsed.push({ book, page: pageIndex + 1, index: offset, text: excerpt, normalized: normalize(excerpt), words: tokens, prefixes: prefixBuckets(tokens) });
          }
        });
        cached = { stamp, chunks: parsed, available: parsed.length > 0, sha256: createHash("sha256").update(bytes).digest("hex") };
        cache.set(book.id, cached);
      }
      if (cached.available) { available.add(book.id); chunks.push(...cached.chunks); }
    } catch (error) {
      if (!["ENOENT", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      cache.delete(book.id);
    }
  }
  return { books: catalog, chunks, available };
}

/** Local availability is independent of OpenAI upload/index status. No private paths leave this service. */
export async function getLocalCatalog(): Promise<LocalCatalogEntry[]> {
  const { books, available } = await snapshot();
  let records: Array<{ id: string; sha256: string; status: string }> = [];
  let unknown = false;
  try {
    const manifest = JSON.parse(await readFile(resolve(privateRoot, "index-manifest.json"), "utf8"));
    if (manifest.version !== 1 || !Array.isArray(manifest.files) || typeof manifest.vectorStoreId !== "string") unknown = true;
    else if (process.env.OPENAI_VECTOR_STORE_ID?.trim() && process.env.OPENAI_VECTOR_STORE_ID.trim() !== manifest.vectorStoreId) unknown = true;
    else records = manifest.files.filter((record: { id?: unknown; sha256?: unknown; status?: unknown }) =>
      record && typeof record.id === "string" && typeof record.sha256 === "string" && typeof record.status === "string");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") unknown = true;
  }
  return books.map(({ id, name, subject, grade, language, pages }) => {
    const record = records.find((record) => record.id === id && record.sha256 === cache.get(id)?.sha256 && available.has(id));
    const vectorIndexStatus: LocalCatalogEntry["vectorIndexStatus"] = unknown ? "unknown" : !record ? "not-indexed"
      : record.status === "completed" ? "completed"
        : ["failed", "cancelled"].includes(record.status) ? "failed" : "pending";
    return { id, name, subject, grade, language, pages, available: available.has(id), vectorIndexed: vectorIndexStatus === "completed", vectorIndexStatus };
  });
}

/** Unicode lexical matches with stopword filtering and bounded inflection prefixes; not semantic retrieval. */
export async function searchLocalKnowledge(query: string, options: { grade?: number; limit?: number } = {}): Promise<Array<{ id: string; title: string; text: string }>> {
  const terms = [...new Set(words(query.slice(0, 2000)))].filter(term =>
    !stopwords.has(term) && !instructionRoots.test(term) && !stopPrefixes.has(prefixOf(term))).slice(0, 24)
    .map(word => ({ word, prefix: prefixOf(word) }));
  const limit = Math.max(0, Math.min(4, Math.floor(options.limit ?? 4)));
  if (!terms.length || !limit || !Number.isFinite(limit)) return [];
  const { chunks } = await snapshot();
  const ranked = chunks.filter((chunk) => options.grade === undefined || chunk.book.grade === options.grade)
    .map(chunk => {
      const matches = terms.map(term => chunk.words.has(term.word) ? { word: term.word, weight: 3 }
        : term.prefix.length >= 5 ? { word: chunk.prefixes.get(term.prefix.slice(0, 5))?.find(word => word.startsWith(term.prefix)), weight: 1 }
          : { word: undefined, weight: 0 }).filter((match): match is { word: string; weight: number } => Boolean(match.word));
      return { chunk, matches, score: matches.reduce((score, match) => score + match.weight, 0) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.book.id.localeCompare(b.chunk.book.id) || a.chunk.page - b.chunk.page || a.chunk.index - b.chunk.index);
  const selected = new Set<string>();
  const excerpts: Array<{ id: string; title: string; text: string }> = [];
  for (const { chunk, matches } of ranked) {
    const id = `${chunk.book.id}:page:${chunk.page}`;
    if (selected.has(id)) continue;
    selected.add(id);
    const firstMatch = Math.min(...matches.map(match => chunk.normalized.indexOf(match.word)).filter(index => index >= 0));
    const start = Math.max(0, Math.min(chunk.text.length - 1200, firstMatch - 200));
    excerpts.push({ id, title: `${chunk.book.name} - p. ${chunk.page}`, text: chunk.text.slice(start, start + 1200) });
    if (excerpts.length === limit) break;
  }
  return excerpts;
}
