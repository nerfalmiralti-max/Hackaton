import { z } from "zod";

export const TIMETABLE_SOURCE_URL = "https://nisaktau.edupage.org/timetable/";
const SOURCE_ORIGIN = "https://nisaktau.edupage.org";
const TIME_ZONE = "Asia/Aqtau";
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { expires: number; value: TimetableResponse }>();
const pending = new Map<string, Promise<TimetableResponse>>();

const classSchema = z.object({ id: z.string().regex(/^-?\d+$/), name: z.string().min(1).max(120), short: z.string().optional() });
const tableSchema = z.object({ id: z.string(), data_rows: z.array(z.record(z.string(), z.unknown())).optional() });
const dbResponseSchema = z.object({ r: z.object({ tables: z.array(tableSchema) }) });
const viewerResponseSchema = z.object({ r: z.object({ regular: z.object({ default_num: z.string().optional(), timetables: z.array(z.object({ tt_num: z.string(), year: z.number(), text: z.string(), datefrom: z.string(), hidden: z.boolean().optional() })) }), current: z.object({ allow: z.boolean() }).optional() }) });
const lessonSchema = z.object({ type: z.literal("card"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), uniperiod: z.string().regex(/^\d+$/), starttime: z.string().regex(/^\d{2}:\d{2}$/).optional(), endtime: z.string().regex(/^\d{2}:\d{2}$/).optional(), subjectid: z.string(), classids: z.array(z.string()), groupnames: z.array(z.string()).optional(), teacherids: z.array(z.string()).optional(), classroomids: z.array(z.string()).optional(), durationperiods: z.number().optional() });
const currentResponseSchema = z.object({ r: z.object({ ttitems: z.array(lessonSchema) }) });

export type TimetableLesson = {
  id: string;
  date: string;
  period: number;
  startTime?: string;
  endTime?: string;
  subject: string;
  teacher?: string;
  room?: string;
  group?: string;
  status: "normal";
};
export type TimetableDay = { date: string; weekday: number; lessons: TimetableLesson[] };
export type TimetableClass = { id: string; name: string };
export type TimetableResponse = {
  source: "edupage";
  sourceUrl: string;
  school: "NIS ХБН Актау";
  retrievedAt: string;
  timezone: typeof TIME_ZONE;
  mode: "current";
  regularTimetables: { id: string; label: string; dateFrom: string; hidden: boolean }[];
  selectedClass?: TimetableClass;
  classes: TimetableClass[];
  weekStart: string;
  days: TimetableDay[];
};

function rpcUrl(path: string, func: string) { return `${SOURCE_ORIGIN}${path}?__func=${func}`; }

async function rpc<T>(path: string, func: string, args: unknown[], schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(rpcUrl(path, func), {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ __args: args, __gsh: "00000000" }),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok || response.headers.get("location")) throw new Error("EduPage request failed");
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("EduPage response changed");
  return parsed.data;
}

function rowMap(rows: Record<string, unknown>[] | undefined) {
  return new Map((rows ?? []).map(row => [String(row.id ?? ""), row]));
}
function text(row: Record<string, unknown> | undefined) {
  const value = row?.name ?? row?.short;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function dateParts(date: Date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}
function localDate() {
  const parts = dateParts(new Date());
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function monday(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}
function plusDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function load(classId: string, requestedWeek?: string): Promise<TimetableResponse> {
  const weekStart = monday(requestedWeek && validDate(requestedWeek) ? requestedWeek : localDate());
  const year = Number(weekStart.slice(0, 4));
  const key = `${classId}:${weekStart}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const viewer = await rpc("/timetable/server/ttviewer.js", "getTTViewerData", [null, year], viewerResponseSchema);
    const filter = { vt_filter: { datefrom: weekStart, dateto: plusDays(weekStart, 6) } };
    const access = { op: "fetch", needed_part: { classes: ["short", "name"], subjects: ["short", "name"], teachers: ["short", "name"], classrooms: ["short", "name"], periods: ["short", "name", "period", "starttime", "endtime"], dates: ["tt_num", "tt_day"] }, needed_combos: {} };
    const database = await rpc("/rpr/server/maindbi.js", "mainDBIAccessor", [null, year, filter, access], dbResponseSchema);
    const tables = new Map(database.r.tables.map(table => [table.id, rowMap(table.data_rows)]));
    const classes = [...(tables.get("classes")?.values() ?? [])].map(row => classSchema.safeParse({ id: row.id, name: row.name, short: row.short })).filter(result => result.success).map(result => ({ id: result.data.id, name: result.data.name })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const selectedClass = classes.find(item => item.id === classId);
    if (classId && !selectedClass) throw new Error("Class is not available");
    const current = classId ? await rpc("/timetable/server/currenttt.js", "curentttGetData", [null, { year, datefrom: weekStart, dateto: plusDays(weekStart, 6), table: "classes", id: classId, showColors: true, showIgroupsInClasses: false, showOrig: true, log_module: "NISAI" }], currentResponseSchema) : { r: { ttitems: [] } };
    const subjects = tables.get("subjects");
    const teachers = tables.get("teachers");
    const classrooms = tables.get("classrooms");
    const lessonsByDate = new Map<string, TimetableLesson[]>();
    for (const item of current.r.ttitems) {
      const subject = text(subjects?.get(item.subjectid));
      if (!subject) continue;
      const lesson: TimetableLesson = { id: `${item.date}:${item.uniperiod}:${item.subjectid}`, date: item.date, period: Number(item.uniperiod), ...(item.starttime ? { startTime: item.starttime } : {}), ...(item.endtime ? { endTime: item.endtime } : {}), subject, ...(text(teachers?.get(item.teacherids?.[0] ?? "")) ? { teacher: text(teachers?.get(item.teacherids?.[0] ?? "")) } : {}), ...(text(classrooms?.get(item.classroomids?.[0] ?? "")) ? { room: text(classrooms?.get(item.classroomids?.[0] ?? "")) } : {}), ...(item.groupnames?.[0] ? { group: item.groupnames[0] } : {}), status: "normal" };
      lessonsByDate.set(item.date, [...(lessonsByDate.get(item.date) ?? []), lesson]);
    }
    const days = Array.from({ length: 7 }, (_, index) => { const date = plusDays(weekStart, index); return { date, weekday: index, lessons: (lessonsByDate.get(date) ?? []).sort((a, b) => a.period - b.period) }; });
    const regularTimetables = viewer.r.regular.timetables.map(item => ({ id: item.tt_num, label: item.text, dateFrom: item.datefrom, hidden: item.hidden ?? false }));
    const value: TimetableResponse = { source: "edupage", sourceUrl: TIMETABLE_SOURCE_URL, school: "NIS ХБН Актау", retrievedAt: new Date().toISOString(), timezone: TIME_ZONE, mode: "current", regularTimetables, ...(selectedClass ? { selectedClass } : {}), classes, weekStart, days };
    cache.set(key, { expires: Date.now() + CACHE_TTL, value });
    return value;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

export async function getTimetable(classId: string | undefined, week?: string) {
  if (classId && !/^-?\d+$/.test(classId)) throw new Error("Invalid class");
  return load(classId || "", week);
}

export { localDate, monday, plusDays };
