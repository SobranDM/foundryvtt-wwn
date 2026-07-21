import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";
import {
  buildFoldersById,
  isFolderDoc,
  readSourceDocs,
  writeSourceDoc,
} from "./pack-folder-paths.mjs";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "packs", "source");
const PACKS_ROOT = path.join(ROOT, "packs");
const SYSTEM = JSON.parse(await fs.readFile(path.join(ROOT, "system.json"), "utf8"));

/**
 * Normalize volatile metadata so extracted JSON stays stable in git.
 * @param {object} entry
 */
async function transformEntry(entry) {
  if (entry._stats) {
    Object.assign(entry._stats, {
      modifiedTime: null,
      lastModifiedBy: null,
      coreVersion: null,
      systemVersion: null,
    });
  }

  if (entry.ownership) {
    entry.ownership = { default: entry.ownership.default ?? 0 };
  }

  for (const collection of ["items", "effects", "pages", "results"]) {
    if (!entry[collection]) continue;
    for (const embedded of entry[collection]) {
      if (embedded._stats) {
        Object.assign(embedded._stats, {
          modifiedTime: null,
          lastModifiedBy: null,
          coreVersion: null,
          systemVersion: null,
        });
      }
      if (embedded.effects) {
        for (const effect of embedded.effects) {
          if (effect._stats) {
            Object.assign(effect._stats, { lastModifiedBy: null });
          }
        }
      }
    }
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-layout extracted files into folder directories after CLI extract.
 * @param {string} destPath
 */
async function normalizeFolderPaths(destPath) {
  const docs = [...readSourceDocs(destPath)];
  const foldersById = buildFoldersById(docs);
  await fs.rm(destPath, { recursive: true, force: true });
  await fs.mkdir(destPath, { recursive: true });
  for (const doc of docs) writeSourceDoc(destPath, doc, foldersById);
  const folderCount = docs.filter(isFolderDoc).length;
  console.log(`  Normalized paths (${docs.length} docs, ${folderCount} folders)`);
}

for (const pack of SYSTEM.packs) {
  const name = pack.name;
  const packPath = path.join(PACKS_ROOT, name);
  const destPath = path.join(SOURCE_ROOT, name);
  if (!(await pathExists(path.join(packPath, "CURRENT")))) {
    console.warn(`Skipping ${name}: no LevelDB pack at ${packPath}`);
    continue;
  }
  console.log(`Extracting ${name} → packs/source/${name}`);
  await extractPack(packPath, destPath, {
    omitVolatile: true,
    transformEntry,
    log: true,
    clean: true,
    folders: true,
  });
  await normalizeFolderPaths(destPath);
}
