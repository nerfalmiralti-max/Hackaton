import OpenAI, { toFile } from "openai";

async function main() {
  if (!process.argv.includes("--run-live")) {
    console.log("Skipped: pass --run-live to explicitly authorize three bounded Responses calls and temporary File Search resources. API usage may incur charges.");
    return;
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY is missing. Configure it privately before opting in.");
    process.exitCode = 1;
    return;
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim(), maxRetries: 0, timeout: 60_000 });
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
  const signal = AbortSignal.timeout(180_000);
  const settings = { model, store: false, max_output_tokens: 400, reasoning: { effort: "low" } };
  const requireAnswer = (response, label) => {
    if (response.status !== "completed" || !response.output_text?.trim()) throw new Error(`${label}: no completed text answer returned`);
    console.log(`${label}: passed (input ${response.usage?.input_tokens ?? "unknown"}, output ${response.usage?.output_tokens ?? "unknown"} tokens)`);
  };
  let storeId;
  let fileId;
  try {
    const text = await client.responses.create({ ...settings,
      input: "What is 2 + 2? Answer in one short sentence.",
    }, { signal });
    requireAnswer(text, "Text response");

    // Valid 1x1 PNG exercises native image input, not OCR or vision quality.
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=";
    const vision = await client.responses.create({ ...settings, input: [{ role: "user", content: [
      { type: "input_text", text: "What color is this tiny image? Answer briefly, and say if it is too small to identify." },
      { type: "input_image", image_url: `data:image/png;base64,${png}`, detail: "low" },
    ] }] }, { signal });
    requireAnswer(vision, "Native image response");

    const file = await client.files.create({
      file: await toFile(Buffer.from("Test-only imaginary school club: the tutoring club meets in Room 314 on Thursday. This is not a real school schedule."), "nis-ai-smoke.txt"),
      purpose: "assistants",
    }, { signal });
    fileId = file.id;
    const store = await client.vectorStores.create({ name: "NIS AI temporary smoke test", expires_after: { anchor: "last_active_at", days: 1 } }, { signal });
    storeId = store.id;
    const indexed = await client.vectorStores.files.createAndPoll(storeId, { file_id: fileId }, { signal, pollIntervalMs: 500 });
    if (indexed.status !== "completed") throw new Error("Temporary file indexing did not complete");
    const retrieval = await client.responses.create({ ...settings,
      instructions: "Answer only from the supplied test file, in one sentence, and include its native file citation. The data is fictional.",
      input: "In which room does the imaginary tutoring club meet?",
      tools: [{ type: "file_search", vector_store_ids: [storeId], max_num_results: 2 }],
      tool_choice: { type: "file_search" }, include: ["file_search_call.results"],
    }, { signal });
    const cited = retrieval.output.some(item => item.type === "message" && item.content.some(part =>
      part.type === "output_text" && part.annotations.some(annotation => annotation.type === "file_citation" && annotation.file_id === fileId)));
    if (!cited) throw new Error("File Search response did not cite the temporary owned file");
    requireAnswer(retrieval, "Native File Search response");
  } finally {
    // Attempt both cleanups independently, even after a failed generation or indexing.
    for (const [label, remove] of [
      ["temporary vector store", storeId ? () => client.vectorStores.delete(storeId, { signal: AbortSignal.timeout(20_000) }) : undefined],
      ["temporary uploaded file", fileId ? () => client.files.delete(fileId, { signal: AbortSignal.timeout(20_000) }) : undefined],
    ]) {
      if (!remove) continue;
      try { await remove(); console.log(`Deleted ${label}.`); }
      catch (error) {
        if (error.status === 404) continue;
        console.error(`Could not delete ${label}; inspect the account's temporary smoke-test resources.`);
        process.exitCode = 1;
      }
    }
  }
}

main().catch(error => {
  console.error(error instanceof OpenAI.APIError ? `Live smoke failed (HTTP ${error.status ?? "unknown"}). Check model access and account configuration.`
    : error instanceof Error && !error.name.includes("API") ? "Live smoke failed before all protocol checks completed. No response bodies or credentials are logged." : "Live smoke failed.");
  process.exitCode = 1;
});
