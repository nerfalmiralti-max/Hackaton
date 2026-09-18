import "server-only";
import OpenAI from "openai";
import { AppError } from "./security";
export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new AppError("NOT_CONFIGURED", 503);
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 90_000 });
}
export function modelName() { return process.env.OPENAI_MODEL || "gpt-5.6-luna"; }
export function publicError(error: unknown): { code: string; status: number } {
  if (error instanceof AppError) return { code: error.code, status: error.status };
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return { code: "UNAUTHORIZED", status: 502 };
    if (error.status === 429) return { code: "RATE_LIMITED", status: 429 };
    if (error.code === "model_not_found") return { code: "MODEL_UNAVAILABLE", status: 502 };
  }
  return { code: "UPSTREAM_ERROR", status: 502 };
}
