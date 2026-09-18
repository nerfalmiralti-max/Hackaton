import { resolve } from "node:path";
import { answerEvents, expect, fulfillStream, navigate, noOverflow, openEnglish, screenshot, send, test } from "./fixtures";

test("fresh workspace has truthful empty states and user-configured context only", async ({ page }, info) => {
  await openEnglish(page);
  await expect(page.getByRole("heading", { name: "What do you want to learn?" })).toBeVisible();
  await expect(page.locator(".context-rail")).toHaveCount(0);
  await expect(page.locator(".recommendation, .event-row, .focus-row")).toHaveCount(0);
  await expect(page.locator(".history-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Change color theme", exact: true }).click();
  await expect(page.locator(".site-shell")).toHaveClass(/\bdark\b/);
  await expect(page.locator(".welcome-brand > span")).toHaveCSS("color", "rgb(233, 238, 247)");
  if ((page.viewportSize()?.width ?? 0) > 1050) {
    await page.locator(".context-toggle").click();
    await expect(page.locator(".context-rail")).toContainText("No context added yet");
    await noOverflow(page);
    await screenshot(page, info, "dark-context");
    await page.locator(".context-toggle").click();
  }
  await navigate(page, "My context");
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("School", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Grade", { exact: true })).toHaveValue("0");
  await expect(page.locator(".profile-subsections")).toHaveCount(0);
  await expect(page.getByText("Arman", { exact: true })).toHaveCount(0);
  await noOverflow(page);
  await screenshot(page, info, "truthful-context");
});

test("RU to KK to EN changes the interface without generating answers", async ({ page }, info) => {
  let calls = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/chat") calls++; });
  await page.goto("/");
  await page.getByRole("button", { name: "\u0420\u0423\u0421", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("textbox")).toHaveAttribute("placeholder", /\u0421\u043f\u0440\u043e\u0441\u0438|\u0417\u0430\u0434\u0430\u0439/);
  await page.getByRole("button", { name: "\u049a\u0410\u0417", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.getByRole("button", { name: "\u049a\u0410\u0417", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "ENG", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("textbox")).toHaveAttribute("placeholder", /Ask a question/);
  expect(calls).toBe(0);
  await noOverflow(page);
  await screenshot(page, info, "workspace");
});

test("real missing-key response is localized and recoverable", async ({ page }) => {
  const response = await page.request.get("/api/status");
  expect(response.ok()).toBe(true);
  const status = await response.json();
  test.skip(status.configured !== false, "A key is configured; sending a real question would incur API usage.");
  await page.unroute("**/api/chat");
  await page.goto("/");
  await page.getByRole("button", { name: "ENG", exact: true }).click();
  const chatResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/chat");
  await send(page, "What is a force?");
  const result = await chatResponse;
  expect(result.status()).toBe(503);
  expect(await result.json()).toEqual({ error: "NOT_CONFIGURED" });
  await expect(page.locator("article.answer").getByRole("alert")).toContainText("AI is not configured");
  await expect(page.getByRole("button", { name: "Retry answer" })).toBeEnabled();
});

test("native image attachment previews without an AI request", async ({ page }, info) => {
  let calls = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/chat") calls++; });
  await openEnglish(page);
  await page.locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]').setInputFiles(resolve("public/science-lab.jpg"));
  const image = page.locator(".attachment").getByRole("img", { name: "science-lab.jpg" });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await image.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
  expect(calls).toBe(0);
  await noOverflow(page);
  await screenshot(page, info, "image-preview");
  await page.getByRole("button", { name: "Remove attachment", exact: true }).click();
  await expect(image).toHaveCount(0);
});

test("mocked stream renders Markdown, math, provenance chips and terms", async ({ page }, info) => {
  let calls = 0;
  await page.route("**/api/chat", async route => { calls++; await fulfillStream(route, answerEvents()); });
  await openEnglish(page);
  await page.getByRole("button", { name: "TriLingua", exact: true }).click();
  await send(page, "Explain forces in three languages.");
  const answer = page.locator("article.answer");
  await expect(answer.locator("strong")).toHaveText("Force");
  await expect(answer.locator(".katex")).toHaveCount(1);
  await expect(answer.locator('[data-kind="file"]')).toHaveText("Uploaded file");
  await expect(answer.locator('[data-kind="general"]')).toHaveText("General knowledge");
  await expect(answer.locator('.term-card dd[lang="kk"]')).toHaveText("\u041a\u04af\u0448");
  await expect(answer.getByRole("button", { name: "Retry answer" })).toBeEnabled();
  await answer.getByText("Physics textbook (test fixture)", { exact: true }).click();
  await expect(answer.getByText("Force equals mass times acceleration.", { exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await expect(answer).not.toContainText("tutor-state");
  await expect(answer).not.toContainText("term-bridge");
  await noOverflow(page);
  await screenshot(page, info, "answer");
});

test("Teach Me sends one call per turn, adapts to observed mistakes and retains memory", async ({ page }) => {
  const requests: { tutor?: { turn: number; topic: string }; action?: string; learningMemory?: { topic: string; misconception: string }[] }[] = [];
  await page.route("**/api/chat", async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const events = answerEvents(requests.length === 1 ? "What happens to acceleration if mass doubles?" : "Compare the same force on a light and heavy cart. Which accelerates more?");
    const done = events.find(event => event.type === "done")!;
    if (done.type === "done" && requests.length > 1) done.tutor = {
      mode: "teach", stage: "practice", turn: requests.length, topic: "Forces",
      misconceptions: ["Acceleration confused with mass"], observedMistake: "Acceleration confused with mass",
    };
    await fulfillStream(route, events);
  });
  await openEnglish(page);
  await page.getByRole("button", { name: /Teach Me/ }).click();
  await expect(page.getByRole("button", { name: /Teach Me/ })).toHaveAttribute("aria-pressed", "true");
  expect(requests).toHaveLength(0);
  await send(page, "Teach me Newton's second law.");
  await expect(page.getByRole("button", { name: "Give a hint", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(1);
  expect(requests[0].tutor).toMatchObject({ turn: 0 });
  await send(page, "Acceleration doubles because the mass doubles.");
  await expect(page.locator("article.answer")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Give a hint", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(2);
  await page.getByRole("button", { name: "Give a hint", exact: true }).click();
  await expect(page.locator("article.answer")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Give a hint", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(3);
  expect(requests[2]).toMatchObject({ action: "hint", tutor: { turn: 2, topic: "Forces" } });
  await expect(page.locator("article.answer").last()).toContainText("Which accelerates more?");
  await expect(page.locator("article.answer").last().locator('[data-kind="file"]')).toBeVisible();
  await navigate(page, "My context");
  await expect(page.locator(".learning-memory")).toContainText("Acceleration confused with mass");
  await page.reload();
  await navigate(page, "My context");
  await expect(page.locator(".learning-memory li")).toHaveCount(1);
  await navigate(page, "Workspace");
  const menu = page.locator(".mobile-menu");
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.locator(".sidebar")).toHaveClass(/\bopen\b/);
  }
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await send(page, "Explain forces in a new task.");
  await expect(page.locator("article.answer").getByRole("button", { name: "Retry answer" })).toBeEnabled();
  expect(requests).toHaveLength(4);
  expect(requests[3].learningMemory).toContainEqual({ topic: "Forces", misconception: "Acceleration confused with mass" });
});

test("stopping a pending mocked generation allows one retry", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/chat", async route => {
    calls++;
    if (calls === 1) {
      await gate;
      await route.abort().catch(() => {});
    } else await fulfillStream(route, answerEvents("Retry completed."));
  });
  await openEnglish(page);
  try {
    await send(page, "Explain force.");
    await expect.poll(() => calls).toBe(1);
    await page.getByRole("button", { name: "Stop generation", exact: true }).click();
    await expect(page.locator("article.answer")).toContainText("Generation stopped.");
    release();
    await page.getByRole("button", { name: "Retry answer", exact: true }).click();
    await expect(page.locator("article.answer")).toContainText("Retry completed.");
    expect(calls).toBe(2);
  } finally { release(); }
});

test("navigation and profile save persist without any generation", async ({ page }, info) => {
  let calls = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/chat") calls++; });
  await openEnglish(page);
  await navigate(page, "My context");
  await page.getByRole("textbox", { name: "First name", exact: true }).fill("Test Student");
  await page.getByLabel("Grade", { exact: true }).selectOption("11");
  await page.getByRole("button", { name: "Save context", exact: true }).click();
  await expect(page.locator(".saved-label")).toHaveText("Context saved");
  await expect(page.locator(".profile-banner")).toContainText("Test Student");
  await expect(page.locator(".creator-credit")).toContainText("\u0422\u043e\u043b\u0435\u0448 \u0410\u043b\u044c\u0442\u0430\u0438\u0440, NIS \u0425\u0411\u041d \u0410\u043a\u0442\u0430\u0443");
  await noOverflow(page);
  await screenshot(page, info, "profile");
  await page.reload();
  await navigate(page, "My context");
  await expect(page.getByRole("textbox", { name: "First name", exact: true })).toHaveValue("Test Student");
  await expect(page.getByLabel("Grade", { exact: true })).toHaveValue("11");
  await navigate(page, "Knowledge");
  await expect(page.locator(".breadcrumb")).toContainText("Knowledge");
  await noOverflow(page);
  await screenshot(page, info, "knowledge");
  await navigate(page, "Workspace");
  await expect(page.getByRole("textbox")).toBeVisible();
  expect(calls).toBe(0);
});

test("real local catalog and RU/KK search preserve textbook page provenance", async ({ page }) => {
  const catalogResponse = await page.request.get("/api/materials");
  expect(catalogResponse.ok()).toBe(true);
  const catalog = await catalogResponse.json();
  expect(catalog.files).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "g8-mathematics-p2-kk", available: true, pages: 256 }),
    expect.objectContaining({ id: "g8-chemistry-kk", available: true, pages: 160 }),
    expect.objectContaining({ id: "g8-mathematics-p1-ru", available: true, pages: 192 }),
    expect.objectContaining({ id: "g7-biology-kk", available: false, vectorIndexed: false, pages: 0 }),
  ]));
  for (const file of catalog.files) {
    expect(file).not.toHaveProperty("textPath");
    expect(file).not.toHaveProperty("originalFilename");
  }
  for (const query of ["\u043a\u0432\u0430\u0434\u0440\u0430\u0442", "\u0442\u0435\u04a3\u0434\u0435\u0443"]) {
    const response = await page.request.get("/api/materials", { params: { q: query } });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.length).toBeLessThanOrEqual(3);
    for (const result of body.results) {
      expect(result.id).toMatch(/^[a-z0-9-]+:page:[1-9]\d*$/);
      expect(result.title).toMatch(/ - p\. [1-9]\d*$/);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.text.length).toBeLessThanOrEqual(1200);
      const book = catalog.files.find((file: { id: string }) => result.id.startsWith(file.id + ":page:"));
      expect(book?.available).toBe(true);
    }
  }
});
