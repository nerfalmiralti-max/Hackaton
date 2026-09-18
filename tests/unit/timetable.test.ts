import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTimetable, TIMETABLE_SOURCE_URL } from "../../src/lib/server/timetable";

function response(body: unknown) { return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }); }
const viewer = { r: { current: { allow: true }, regular: { default_num: "135", timetables: [{ tt_num: "135", year: 2026, text: "Current week", datefrom: "2026-09-13", hidden: false }] } } };
const database = { r: { type: "maindbi", dbid: "2026", tables: [
  { id: "classes", data_rows: [{ id: "-120", name: "8A", short: "8A" }] },
  { id: "subjects", data_rows: [{ id: "*5", name: "Physics" }] },
  { id: "teachers", data_rows: [{ id: "*117", name: "Teacher A" }] },
  { id: "classrooms", data_rows: [{ id: "*52", name: "305" }] },
  { id: "periods", data_rows: [{ id: "1", period: "1", starttime: "08:30", endtime: "09:10" }] },
  { id: "dates", data_rows: [] },
] } };
const lessons = { r: { ttitems: [{ type: "card", date: "2026-09-14", uniperiod: "1", starttime: "08:30", endtime: "09:10", subjectid: "*5", classids: ["-120"], groupnames: [""], teacherids: ["*117"], classroomids: ["*52"] }] } };

beforeEach(() => vi.stubGlobal("fetch", vi.fn()
  .mockResolvedValueOnce(response(viewer))
  .mockResolvedValueOnce(response(database))
  .mockResolvedValueOnce(response(lessons))));

describe("public EduPage timetable adapter", () => {
  it("normalizes the observed public RPC responses", async () => {
    const result = await getTimetable("-120", "2026-09-14");
    expect(result.sourceUrl).toBe(TIMETABLE_SOURCE_URL);
    expect(result.selectedClass).toEqual({ id: "-120", name: "8A" });
    expect(result.days[0].lessons[0]).toMatchObject({ subject: "Physics", teacher: "Teacher A", room: "305", startTime: "08:30", endTime: "09:10", status: "normal" });
    expect(result.timezone).toBe("Asia/Aqtau");
    expect(vi.mocked(fetch).mock.calls.map(call => String(call[0]))).toEqual([
      "https://nisaktau.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData",
      "https://nisaktau.edupage.org/rpr/server/maindbi.js?__func=mainDBIAccessor",
      "https://nisaktau.edupage.org/timetable/server/currenttt.js?__func=curentttGetData",
    ]);
  });

  it("discovers only classes from the trusted source without inventing lessons", async () => {
    const result = await getTimetable(undefined, "2026-09-21");
    expect(result.classes).toEqual([{ id: "-120", name: "8A" }]);
    expect(result.selectedClass).toBeUndefined();
    expect(result.days.every(day => day.lessons.length === 0)).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("rejects arbitrary class input before fetching EduPage", async () => {
    await expect(getTimetable("https://evil.example", "2026-09-28")).rejects.toThrow("Invalid class");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("fails closed when EduPage changes its response shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ unexpected: true })));
    await expect(getTimetable("-120", "2026-10-05")).rejects.toThrow("EduPage response changed");
  });
});
