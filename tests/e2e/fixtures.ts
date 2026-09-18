import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test as base, expect, type Page, type Route, type TestInfo } from "@playwright/test";
import type { StreamEvent } from "../../src/lib/types";

export const test = base.extend<{ chatSafety: void; browserHealth: void }>({
  chatSafety: [async ({ page }, use) => {
    await page.route("https://api.openai.com/**", route => route.abort());
    await page.route("**/api/chat", route => route.fulfill({ status: 503, json: { error: "NOT_CONFIGURED" } }));
    await use();
  }, { auto: true }],
  browserHealth: [async ({ page }, use, info) => {
    const errors: { kind: string; message: string }[] = [];
    page.on("pageerror", error => errors.push({ kind: "pageerror", message: error.message }));
    page.on("console", message => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Failed to load resource.*\b503\b/.test(text) && /\/api\/chat(?:\?|$)/.test(message.location().url)) return;
      errors.push({ kind: "console", message: text });
    });
    await use();
    await info.attach("browser-errors", { body: JSON.stringify(errors, null, 2), contentType: "application/json" });
    expect(errors, "Unexpected browser runtime or console errors").toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function openEnglish(page: Page) {
  await page.route("**/api/status", route => route.fulfill({ json: {
    configured: true, schoolConnected: false, files: [], model: "gpt-5.6-luna", development: true,
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: "ENG", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

export function answerEvents(text = "**Force** changes motion.\n\n$F=ma$\n\nWhat happens if mass doubles?"): StreamEvent[] {
  return [
    { type: "phase", phase: "thinking" },
    { type: "delta", text: text.slice(0, 12) },
    { type: "delta", text: text.slice(12) },
    { type: "done", sources: [
      { id: "fixture-textbook", kind: "file", title: "Physics textbook (test fixture)", excerpt: "Force equals mass times acceleration." },
      { id: "fixture-general", kind: "general", title: "General explanation (test fixture)" },
    ], terms: [{ en: "Force", ru: "\u0421\u0438\u043b\u0430", kk: "\u041a\u04af\u0448" }],
    tutor: { mode: "teach", stage: "practice", turn: 1, topic: "Forces", misconceptions: [] },
    needsFallback: false, truncated: false, usage: { input: 42, output: 24 } },
  ];
}

export async function fulfillStream(route: Route, events: StreamEvent[]) {
  await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8",
    body: events.map(event => JSON.stringify(event)).join("\n") + "\n" });
}

export async function send(page: Page, text: string) {
  await page.getByRole("textbox").fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}

export async function navigate(page: Page, name: "My context" | "Knowledge" | "Timetable" | "Workspace") {
  // Reload restores the saved language asynchronously; wait before checking navigation.
  await expect(page.locator(".site-shell")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const menu = page.locator(".mobile-menu");
  if ((page.viewportSize()?.width ?? 1440) < 768) await expect(menu).toBeVisible();
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.locator(".sidebar")).toHaveClass(/\bopen\b/);
  }
  await page.locator(".sidebar nav").getByRole("button", { name, exact: true }).click();
}

export async function screenshot(page: Page, info: TestInfo, name: string) {
  const directory = resolve(".artifacts/screenshots");
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${info.project.name}-${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

export async function noOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    main: [...document.querySelectorAll<HTMLElement>(".site-main, .workspace-main, .composer, .answer-body")]
      .map(element => ({ width: element.clientWidth, scroll: element.scrollWidth })),
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport + 1);
  for (const element of sizes.main) expect(element.scroll).toBeLessThanOrEqual(element.width + 1);
}
