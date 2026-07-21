/**
 * Folder-aware pack source paths matching @foundryvtt/foundryvtt-cli extractPack({ folders: true }).
 */
import fs from "node:fs";
import path from "node:path";

/** @param {string} name */
export function getSafeFilename(name) {
  return name.replace(/[^a-zA-Z0-9А-я]/g, "_");
}

/** @param {{ name?: string, _id: string }} doc */
export function safeDirName(doc) {
  const safe = doc.name ? getSafeFilename(doc.name) : doc._id;
  return `${safe}_${doc._id}`;
}

/** @param {object} doc */
export function isFolderDoc(doc) {
  return typeof doc._key === "string" && doc._key.startsWith("!folders");
}

/**
 * @param {string | null | undefined} folderId
 * @param {Map<string, object>} foldersById
 * @returns {string}
 */
export function folderPath(folderId, foldersById) {
  if (!folderId) return "";
  const segments = [];
  const seen = new Set();
  let current = folderId;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const folder = foldersById.get(current);
    if (!folder) break;
    segments.unshift(safeDirName(folder));
    current = folder.folder ?? null;
  }
  return segments.join(path.sep);
}

/**
 * Relative path for a document under a pack source directory.
 * @param {object} doc
 * @param {Map<string, object>} foldersById
 * @returns {string}
 */
export function docSourcePath(doc, foldersById) {
  if (isFolderDoc(doc)) {
    const parent = folderPath(doc.folder, foldersById);
    const self = safeDirName(doc);
    return parent ? path.join(parent, self, "_Folder.json") : path.join(self, "_Folder.json");
  }
  const fileName = `${doc.name ? getSafeFilename(doc.name) : doc._id}_${doc._id}.json`;
  const parent = folderPath(doc.folder, foldersById);
  return parent ? path.join(parent, fileName) : fileName;
}

/** @param {Iterable<object>} docs */
export function buildFoldersById(docs) {
  const map = new Map();
  for (const doc of docs) {
    if (isFolderDoc(doc)) map.set(doc._id, doc);
  }
  return map;
}

/**
 * @param {string} dir
 * @returns {Generator<object>}
 */
export function* readSourceDocs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* readSourceDocs(p);
    else if (entry.name.endsWith(".json")) yield JSON.parse(fs.readFileSync(p, "utf8"));
  }
}

/**
 * @param {string} packDir
 * @param {object} doc
 * @param {Map<string, object>} foldersById
 */
export function writeSourceDoc(packDir, doc, foldersById) {
  const relPath = docSourcePath(doc, foldersById);
  const fullPath = path.join(packDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(doc, null, 2)}\n`);
}

/** Foundry document IDs are 16 chars from [A-Za-z0-9]. */
export function randomId(seed) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // Deterministic-ish from seed string so re-runs are stable when possible
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  for (let i = 0; i < 16; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out += chars[Math.abs(h) % chars.length];
  }
  return out;
}

/**
 * @param {string} name
 * @param {string} type  Document type the folder holds (Item, RollTable, Actor, …)
 * @param {string | null} parentId
 * @param {string} idSeed
 */
export function makeFolder(name, type, parentId, idSeed) {
  const _id = randomId(idSeed);
  return {
    name,
    sorting: "a",
    folder: parentId,
    type,
    _id,
    description: "",
    sort: 0,
    color: null,
    flags: {},
    _stats: {
      modifiedTime: null,
      lastModifiedBy: null,
      coreVersion: null,
      systemVersion: null,
    },
    _key: `!folders!${_id}`,
  };
}
