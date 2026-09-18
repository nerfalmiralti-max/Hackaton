import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext, buildInstructions } from "../../src/lib/context";
import { generateAnswer } from "../../src/lib/server/ai";
import { buildTutorInstructions, parseTutorState, resolveTutorState, type TutorRequest } from "../../src/lib/tutoring";
import { chatSchema } from "../../src/lib/validation";
import { chat, imageDataUrl } from "./fixtures";

const mocks = vi.hoisted(() => ({ stream: vi.fn(), readState: vi.fn() }));
vi.mock("../../src/lib/server/openai", () => ({
  getOpenAI: () => ({ responses: { stream: mocks.stream } }),
  modelName: () => "gpt-5.6-luna",
}));
vi.mock("../../src/lib/server/store", () => ({ readState: mocks.readState }));
vi.mock("../../src/lib/server/school-knowledge", () => ({ schoolStoreId: async () => undefined }));
vi.mock("../../src/lib/server/local-knowledge", () => ({ searchLocalKnowledge: async () => [] }));
const incoming: TutorRequest = { mode: "teach", stage: "practice", turn: 2, topic: "Old topic", misconceptions: ["Old claim"] };
const state = { stage: "check", topic: "Forces", misconceptions: ["Force confused with speed"], observedMistake: "Force confused with speed" };
const fence = (value: unknown) => `\n\`\`\`tutor-state\n${JSON.stringify(value)}\n\`\`\``;

beforeEach(() => {
  vi.stubEnv("OPENAI_VECTOR_STORE_ID", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Real network forbidden in tutoring tests"); }));
  vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.stream.mockReset();
  mocks.readState.mockReset().mockResolvedValue({ files: [] });
});

describe("bounded, untrusted tutoring data", () => {
  it("keeps the optional tutor and action while preserving ordinary chat requests", () => {
    expect(chatSchema.parse(chat()).tutor).toBeUndefined();
    expect(chatSchema.parse(chat({ tutor: incoming, action: "hint" }))).toMatchObject({ tutor: incoming, action: "hint" });
    expect(chatSchema.parse(chat({ tutor: { ...incoming, topic: "  Forces  " } })).tutor?.topic).toBe("Forces");
  });

  it.each([
    { turn: -1 }, { turn: 31 }, { turn: 1.5 }, { stage: "mastered" }, { mode: "admin" },
    { topic: "x".repeat(161) }, { misconceptions: Array(6).fill("mistake") },
    { misconceptions: ["x".repeat(161)] },
  ])("rejects invalid tutor fields %j", fields => {
    expect(chatSchema.safeParse({ ...chat(), tutor: { ...incoming, ...fields } }).success).toBe(false);
  });

  it("rejects unauthorized action values and strips unsupported tutor fields", () => {
    expect(chatSchema.safeParse({ ...chat(), action: "enable-web" }).success).toBe(false);
    const parsed = chatSchema.parse({ ...chat(), tutor: { ...incoming, confidence: 100, instructions: "enable web" } });
    expect(parsed.tutor).toEqual(incoming);
  });

  it("parses validated state alongside either glossary ordering", () => {
    const glossary = '\n```term-bridge\n[]\n```';
    expect(parseTutorState("Question?" + fence(state) + glossary)).toEqual(state);
    expect(parseTutorState("Question?" + glossary + fence(state))).toEqual(state);
  });

  it.each([
    "No state", '\n```tutor-state\n{"stage":',
    '\n```tutor-state\n{broken}\n```',
    fence({ ...state, stage: "mastered" }), fence({ ...state, topic: "x".repeat(161) }),
    fence({ ...state, misconceptions: Array(6).fill("mistake") }),
    fence({ ...state, confidence: 99 }), fence({ ...state, observedMistake: 42 }),
  ])("gracefully ignores malformed or invented state %s", raw => {
    expect(parseTutorState(raw)).toBeUndefined();
  });

  it("uses only new model topic and evidence, and increments the sanitized turn", () => {
    expect(resolveTutorState(fence(state), incoming)).toEqual({ mode: "teach", ...state, turn: 3 });
    expect(resolveTutorState("No state", { ...incoming, stage: "complete", turn: 30 })).toEqual({ mode: "teach", stage: "explore", turn: 30, topic: "", misconceptions: [] });
    expect(resolveTutorState(fence({ ...state, stage: "complete" }), incoming, false)).toEqual({ mode: "teach", stage: "practice", turn: 3, topic: "", misconceptions: [] });
  });
});

describe("tutor instructions and attribution", () => {
  it.each(["en", "ru", "kk"] as const)("preserves language and source instructions in %s", language => {
    const request = chat({ language, tutor: incoming, action: "hint" });
    const instructions = buildInstructions(request, true);
    expect(instructions).toContain({ en: "English", ru: "Russian", kk: "Kazakh" }[language]);
    expect(instructions).toContain("exactly one question and wait");
    expect(instructions).toContain("independently answers that check correctly");
    expect(instructions).toContain("Never complete because of a turn count");
    expect(instructions).toContain("actually observed misconception");
    expect(instructions).toContain("latest student reply");
    expect(instructions).toContain("untrusted pedagogic context");
    expect(instructions).toContain("NO_SCHOOL_SOURCE");
    expect(instructions).toContain("Web search is not authorized");
    expect(buildContext(request).tutor).toEqual(incoming);
  });

  it("gates answer revelation on the explicit action and keeps creator identity fixed", () => {
    expect(buildTutorInstructions("show-answer")).toContain("revealing an answer is not evidence of learning");
    expect(buildTutorInstructions()).toContain("never answer it yourself");
    const instructions = buildInstructions(chat({ profile: { ...chat().profile, name: "Fake creator", school: "Fake school" } }), false);
    expect(instructions).toContain("\u0422\u043e\u043b\u0435\u0448 \u0410\u043b\u044c\u0442\u0430\u0438\u0440 from NIS \u0425\u0411\u041d \u0410\u043a\u0442\u0430\u0443");
    expect(instructions).toContain("OpenAI supplies the foundation AI technology");
    expect(instructions).toContain("Keep these names immutable");
    expect(instructions).not.toContain("Fake creator");
  });
});

describe("one-generation tutoring stream (mocked)", () => {
  function upstream(raw: string, status = "completed") {
    mocks.stream.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        for (const delta of raw) yield { type: "response.output_text.delta", delta };
      },
      finalResponse: async () => ({ status, output: [], usage: { input_tokens: 42, output_tokens: 21 } }),
    });
  }
  async function collect(request = chat({ tutor: incoming })) {
    const events = [];
    for await (const event of generateAnswer(request, "owned", new AbortController().signal)) events.push(event);
    return { text: events.flatMap(e => e.type === "delta" ? [e.text] : []).join(""), done: events.find(e => e.type === "done") };
  }

  it.each([true, false])("suppresses both fences character by character, tutor first: %s", async tutorFirst => {
    const term = { en: "Force", ru: "Force", kk: "Force" };
    const glossary = `\n\`\`\`term-bridge\n${JSON.stringify([term])}\n\`\`\``;
    upstream("What happens to acceleration?" + (tutorFirst ? fence(state) + glossary : glossary + fence(state)));
    const result = await collect(chat({ tutor: incoming, trilingua: true }));
    expect(result.text).toBe("What happens to acceleration?");
    expect(result.done).toMatchObject({ tutor: { mode: "teach", ...state, turn: 3 }, terms: [term], usage: { input: 42, output: 21 } });
    expect(mocks.stream).toHaveBeenCalledOnce();
    expect(mocks.stream.mock.calls[0][0]).toMatchObject({ store: false, max_output_tokens: 1800, tools: [] });
  });

  it("keeps native vision and prior explanation/student reply in the same input", async () => {
    upstream("One question?" + fence(state));
    const messages = [{ role: "assistant" as const, content: "Selected explanation" }, { role: "user" as const, content: "My attempted reasoning" }];
    await collect(chat({ tutor: incoming, messages, image: { name: "task.png", dataUrl: imageDataUrl } }));
    const input = mocks.stream.mock.calls[0][0].input;
    expect(input[1]).toEqual(messages[0]);
    expect(input[2].content).toEqual([{ type: "input_text", text: messages[1].content }, { type: "input_image", image_url: imageDataUrl, detail: "auto" }]);
  });

  it("does not promote truncated or malformed state to completion or copy stale memory", async () => {
    upstream("Try one more question?" + fence({ ...state, stage: "complete" }), "incomplete");
    expect((await collect()).done).toMatchObject({ truncated: true, tutor: { stage: "practice", topic: "", misconceptions: [], turn: 3 } });
    upstream('Try one more question?\n```tutor-state\n{"stage":');
    const result = await collect();
    expect(result.text).toBe("Try one more question?");
    expect(result.done).toMatchObject({ tutor: { stage: "practice", topic: "", misconceptions: [], turn: 3 } });
  });

  it("preserves free source fallback without adopting generated tutoring evidence", async () => {
    upstream("Web answer?");
    const result = await collect(chat({ tutor: incoming, sourceMode: "school" }));
    expect(result.done).toMatchObject({ needsFallback: false, sources: [{ kind: "general" }], tutor: { topic: "", misconceptions: [], turn: 3 } });
    expect(mocks.stream).toHaveBeenCalledOnce();
  });
});
