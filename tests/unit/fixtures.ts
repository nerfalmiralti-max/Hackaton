import type { ChatRequest } from "../../src/lib/validation";

export function chat(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: "user", content: "Explain photosynthesis." }],
    profile: { name: "Student", school: "Demo school", grade: 10, language: "en" },
    language: "en", trilingua: false, web: false, sourceMode: "auto", allowGeneral: false,
    ...overrides,
  };
}

// A valid 1x1 PNG; used as native image input without disk or network access.
export const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=", "base64");
export const imageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
