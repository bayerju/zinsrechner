import { readdir, rm, access } from "node:fs/promises";
import { join } from "node:path";

const root = ".next/standalone";
await access(join(root, "server.js"));
// Next may copy local env files into standalone output. Never ship them.
async function clean(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (
      entry.name.startsWith(".env") ||
      entry.name === ".git" ||
      entry.name.endsWith(".tsbuildinfo") ||
      (entry.name === "cache" && directory.endsWith("/.next"))
    ) {
      await rm(path, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      await clean(path);
    }
  }
}
await clean(root);
console.log("Standalone runtime prepared without env files or build cache.");
