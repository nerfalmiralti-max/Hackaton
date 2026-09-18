import { z } from "zod";
import { tutorActionSchema, tutorRequestSchema } from "./tutoring";
export const profileSchema = z.object({
  name: z.string().trim().max(50), school: z.string().trim().max(100),
  grade: z.union([z.literal(0), z.number().int().min(7).max(12)]), language: z.enum(["ru", "kk", "en"]),
});
export const chatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).min(1).max(12),
  profile: profileSchema,
  language: z.enum(["ru", "kk", "en"]), trilingua: z.boolean().default(false),
  web: z.boolean().default(false), sourceMode: z.enum(["auto", "school"]).default("auto"),
  allowGeneral: z.boolean().default(false),
  image: z.object({ name: z.string().max(160), dataUrl: z.string().max(5_600_000) }).optional(),
  fileId: z.string().max(100).optional(),
  tutor: tutorRequestSchema.optional(),
  action: tutorActionSchema.optional(),
  learningMemory: z.array(z.object({ topic: z.string().trim().min(1).max(160), misconception: z.string().trim().min(1).max(160) })).max(8).optional(),
}).refine(v => v.messages.at(-1)?.role === "user", "Last message must be from the user")
  .refine(v => Boolean(v.messages.at(-1)?.content.trim() || v.image), "A message or image is required");
export type ChatRequest = z.infer<typeof chatSchema>;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export function validateImage(dataUrl: string): boolean {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return false;
  if (match[1] === "png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (match[1] === "jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}
export function validateDocument(name: string, bytes: Buffer): string | null {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return "FILE_TOO_LARGE";
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (!extension || !["pdf", "txt", "md", "docx"].includes(extension)) return "UNSUPPORTED_FILE";
  if (extension === "pdf" && bytes.toString("ascii", 0, 5) !== "%PDF-") return "INVALID_FILE";
  if (extension === "docx" && !(bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4)) return "INVALID_FILE";
  if (["txt", "md"].includes(extension)) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return "INVALID_FILE"; }
    if (bytes.includes(0)) return "INVALID_FILE";
  }
  return null;
}
