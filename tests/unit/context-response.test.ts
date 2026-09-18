import { describe, expect, it } from "vitest";
import { buildContext, isPlanningQuery, isSchoolQuery } from "../../src/lib/context";
import { safeWebUrl, splitAnswer } from "../../src/lib/response";
import { chat } from "./fixtures";
import { defaultProfile } from "../../src/lib/profile";

describe("truthful user context", () => {
  it("starts with no invented profile, learning or schedule", () => {
    expect(defaultProfile).toEqual({ name: "", school: "", grade: 0, language: "ru" });
    const context = buildContext(chat({ profile: defaultProfile }));
    expect(context.student).toEqual({});
    expect(context).not.toHaveProperty("learning");
    expect(context).not.toHaveProperty("events");
  });
  it.each([
    "What should I study tomorrow?",
    "\u041a\u0430\u043a \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u044c\u0441\u044f \u043a \u0437\u0430\u0432\u0442\u0440\u0430?",
    "\u0415\u0440\u0442\u0435\u04a3 \u049b\u0430\u043b\u0430\u0439 \u0434\u0430\u0439\u044b\u043d\u0434\u0430\u043b\u0430\u043c\u044b\u043d?",
  ])("includes events for planning in %s", content => {
    expect(isPlanningQuery(content)).toBe(true);
    const context = buildContext(chat({ messages: [{ role: "user", content }] }));
    expect(context.simulated).toBe(false);
    expect(context.events).toEqual([]);
    expect(context).not.toHaveProperty("learning");
  });

  it.each([
    ["Explain electromagnetic induction", "Physics"],
    ["\u041e\u0431\u044a\u044f\u0441\u043d\u0438 \u043f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u043d\u0443\u044e", "Mathematics"],
    ["\u0422\u0443\u044b\u043d\u0434\u044b \u0434\u0435\u0433\u0435\u043d \u043d\u0435?", "Mathematics"],
  ])("does not invent subject learning for %s", (content) => {
    const context = buildContext(chat({ messages: [{ role: "user", content }] }));
    expect(context).not.toHaveProperty("events");
    expect(context).not.toHaveProperty("learning");
  });

  it("does not carry planning context from old history into an unrelated query", () => {
    const context = buildContext(chat({ messages: [{ role: "user", content: "Plan my study schedule" }, { role: "assistant", content: "Physics tomorrow" }, { role: "user", content: "Write a birthday greeting" }] }));
    expect(context).not.toHaveProperty("events");
    expect(context).not.toHaveProperty("learning");
  });
  it("reuses only observed memory matching the current topic", () => {
    const memory = [{ topic: "Quadratic equations", misconception: "Sign changed during substitution" }];
    const matching = buildContext(chat({ messages: [{ role: "user", content: "Teach me quadratic equations" }], learningMemory: memory }));
    expect(matching.observedLearningMemory).toEqual(memory);
    const unrelated = buildContext(chat({ messages: [{ role: "user", content: "Explain biology" }], learningMemory: memory }));
    expect(unrelated).not.toHaveProperty("observedLearningMemory");
  });

  it.each(["NIS uniform", "\u041f\u0440\u0430\u0432\u0438\u043b\u0430 \u0448\u043a\u043e\u043b\u044b", "\u041c\u0435\u043a\u0442\u0435\u043f \u0435\u0440\u0435\u0436\u0435\u0441\u0456"]) ("recognizes school-source questions in %s", query => {
    expect(isSchoolQuery(query)).toBe(true);
  });
});

describe("term bridge output boundary", () => {
  const term = { en: "Force", ru: "\u0421\u0438\u043b\u0430", kk: "\u041a\u04af\u0448" };
  it("extracts validated terms without exposing the fence or JSON", () => {
    expect(splitAnswer(`Explanation.\n\n\`\`\`term-bridge\n${JSON.stringify([term])}\n\`\`\``)).toEqual({ text: "Explanation.", terms: [term] });
  });
  it.each(["{broken", '[{"en":"Force"}]', '[{"en":42,"ru":"x","kk":"y"}]', JSON.stringify(Array(6).fill(term)), '[{"en":"","ru":"x","kk":"y"}]']) ("hides malformed glossary data %s", json => {
    expect(splitAnswer(`Explanation.\n\`\`\`term-bridge\n${json}\n\`\`\``)).toEqual({ text: "Explanation.", terms: [] });
  });
  it("hides unfinished glossary output while preserving ordinary code fences", () => {
    expect(splitAnswer('Answer\n```term-bridge\n[{"en":')).toEqual({ text: "Answer", terms: [] });
    const normal = 'Example:\n```json\n{"value":1}\n```';
    expect(splitAnswer(normal)).toEqual({ text: normal, terms: [] });
  });
});

describe("web citation URLs", () => {
  it.each(["javascript:alert(1)", "data:text/html,hello", "file:///etc/passwd", "ftp://example.com", "//example.com", "/relative", "not a URL"]) ("rejects unsafe or nonabsolute URL %s", url => {
    expect(safeWebUrl(url)).toBeUndefined();
  });
  it.each(["https://example.com/article", "http://example.com/article"]) ("preserves safe citation URL %s", url => {
    expect(safeWebUrl(url)).toBe(url);
  });
});
