/**
 * Validate packs/source folder trees do not exceed Foundry's pack max depth (3).
 */
import fs from "node:fs";
import path from "node:path";
import { isFolderDoc, readSourceDocs } from "./pack-folder-paths.mjs";

const MAX_DEPTH = 3;
const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "packs", "source");
const SYSTEM = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));

/**
 * @param {string} folderId
 * @param {Map<string, object>} folders
 */
function folderDepth(folderId, folders) {
  let depth = 0;
  let current = folderId;
  const seen = new Set();
  while (current) {
    if (seen.has(current)) return Infinity;
    seen.add(current);
    depth += 1;
    const folder = folders.get(current);
    if (!folder) break;
    current = folder.folder ?? null;
  }
  return depth;
}

/**
 * @param {string} name
 */
function lintPack(name) {
  const dir = path.join(SOURCE, name);
  if (!fs.existsSync(dir)) return [];
  const docs = [...readSourceDocs(dir)];
  const folders = new Map(docs.filter(isFolderDoc).map((d) => [d._id, d]));
  const errors = [];
  for (const [id, folder] of folders) {
    const depth = folderDepth(id, folders);
    if (depth > MAX_DEPTH) {
      errors.push(`${name}: folder "${folder.name}" (${id}) depth ${depth} > ${MAX_DEPTH}`);
    }
  }
  // Documents must point at a real folder (or null)
  for (const doc of docs) {
    if (isFolderDoc(doc)) continue;
    if (doc.folder && !folders.has(doc.folder)) {
      errors.push(`${name}: ${doc.name ?? doc._id} references missing folder ${doc.folder}`);
    }
  }
  return errors;
}

const packs = SYSTEM.packs.map((p) => p.name);
const errors = packs.flatMap(lintPack);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Pack folders OK (max depth ${MAX_DEPTH}) across ${packs.length} packs.`);
