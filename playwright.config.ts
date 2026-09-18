import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"];
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"];
const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || (edge.some(existsSync) ? "msedge" : chrome.some(existsSync) ? "chrome" : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/unit/**",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: ".artifacts/playwright",
  reporter: [["list"], ["html", { outputFolder: ".artifacts/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    channel,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "laptop1280", use: { viewport: { width: 1280, height: 800 } } },
    { name: "desktop1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  ...(process.env.E2E_START_SERVER === "1" ? {
    webServer: { command: "npm run dev -- --port 3000", url: "http://127.0.0.1:3000", reuseExistingServer: true, timeout: 120_000 },
  } : {}),
});
