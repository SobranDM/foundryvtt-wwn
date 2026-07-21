import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "packs", "source");
const PACKS_ROOT = path.join(ROOT, "packs");
const SYSTEM = JSON.parse(await fs.readFile(path.join(ROOT, "system.json"), "utf8"));
const PACK_NAMES = new Set(SYSTEM.packs.map((p) => p.name));

const sourceDirs = (await fs.readdir(SOURCE_ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => PACK_NAMES.has(name));

for (const name of sourceDirs) {
  const src = path.join(SOURCE_ROOT, name);
  const dest = path.join(PACKS_ROOT, name);
  console.log(`Packing ${name}`);
  await fs.rm(dest, { recursive: true, force: true });
  await compilePack(src, dest, { log: true, recursive: true });
}
