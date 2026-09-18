import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("node scripts/prepare-knowledge.mjs [--source-dir DIRECTORY] [--python EXECUTABLE]\nOffline PDF extraction. Defaults to your Downloads folder. Never calls OpenAI.");
  process.exit(0);
}
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name} value`);
  return args[index + 1];
}
for (let i = 0; i < args.length; i += 2) {
  if (!["--source-dir", "--python"].includes(args[i])) throw new Error(`Unknown option: ${args[i]}`);
}
const bundled = resolve(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe");
const candidates = [option("--python", process.env.KNOWLEDGE_PYTHON), bundled, "python", "python3"].filter(Boolean);
const python = candidates.find((executable) => spawnSync(executable, ["-c", "import pypdf"], { stdio: "ignore", timeout: 10000 }).status === 0);
if (!python) throw new Error("No Python with pypdf found. Set KNOWLEDGE_PYTHON or use --python. Install pypdf in that Python if necessary.");
const child = spawn(python, [resolve(root, "scripts/prepare-knowledge.py"), "--root", root, "--source-dir", resolve(option("--source-dir", resolve(homedir(), "Downloads")))], {
  stdio: "inherit", shell: false, env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
