import type { Attachment, StreamEvent } from "./types";
export async function readStream(response: Response, receive: (event: StreamEvent) => void) {
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "NETWORK_ERROR"); }
  if (!response.body) throw new Error("NETWORK_ERROR");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  function consume(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    if (event.type === "done" || event.type === "error") finished = true;
    receive(event);
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buffer += decoder.decode(); break; }
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
    }
    consume(buffer);
    if (!finished) throw new Error("NETWORK_ERROR");
  } finally { reader.releaseLock(); }
}
export async function prepareImage(file: File): Promise<Attachment> {
  if (file.size > 4 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("INVALID_IMAGE");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("INVALID_IMAGE"); });
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("INVALID_IMAGE");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("INVALID_IMAGE");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { name: file.name.slice(0, 160), dataUrl: canvas.toDataURL("image/jpeg", .88) };
  } finally { bitmap.close(); }
}
