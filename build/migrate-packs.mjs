/**
 * Migrate packs/source JSON from legacy WWN shapes to TypeDataModel shapes.
 *
 * Usage: node build/migrate-packs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import "./foundry-shim.mjs";
import { migrateActorData, migrateItemData } from "../module/migration/transforms.mjs";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "packs", "source");

const stats = {
  files: 0,
  written: 0,
  actors: 0,
  items: 0,
  skipped: 0,
  errors: 0,
};

const META_KEYS = new Set(["_id", "_key", "folder", "sort", "flags", "ownership", "_stats"]);

/**
 * Ensure embedded documents have Foundry pack `_id`/`_key` values.
 * Without them, compileClassicLevel throws LEVEL_INVALID_KEY.
 * @param {object} doc
 * @returns {boolean} whether anything changed
 */
function ensureEmbeddedKeys(doc) {
  if (!doc?._id) return false;
  const parentKey = typeof doc._key === "string" ? doc._key : "";
  let parentCollection = "items";
  if (parentKey.startsWith("!actors") || ["character", "monster", "pc", "npc", "faction"].includes(doc.type)) {
    parentCollection = "actors";
  } else if (parentKey.startsWith("!items")) {
    parentCollection = "items";
  }

  let changed = false;

  const fixEffect = (effect, ownerId, ownerCollection) => {
    if (!effect || typeof effect !== "object") return;
    if (!effect._id) {
      effect._id = foundry.utils.randomID();
      changed = true;
    }
    if (!effect.type) {
      effect.type = "base";
      changed = true;
    }
    const expectedKey = `!${ownerCollection}.effects!${ownerId}.${effect._id}`;
    if (effect._key !== expectedKey) {
      effect._key = expectedKey;
      changed = true;
    }
  };

  if (Array.isArray(doc.effects)) {
    for (const effect of doc.effects) fixEffect(effect, doc._id, parentCollection);
  }

  if (Array.isArray(doc.items) && parentCollection === "actors") {
    for (const item of doc.items) {
      if (!item || typeof item !== "object") continue;
      if (!item._id) {
        item._id = foundry.utils.randomID();
        changed = true;
      }
      const expectedItemKey = `!actors.items!${doc._id}.${item._id}`;
      if (item._key !== expectedItemKey) {
        item._key = expectedItemKey;
        changed = true;
      }
      if (Array.isArray(item.effects)) {
        for (const effect of item.effects) fixEffect(effect, item._id, "items");
      }
    }
  }

  return changed;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

/**
 * @param {object} doc
 * @param {object} migrated
 * @returns {boolean}
 */
function applyMigration(doc, migrated) {
  if (!migrated) return false;
  let changed = false;
  for (const [key, value] of Object.entries(migrated)) {
    if (META_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    const before = JSON.stringify(doc[key]);
    const after = JSON.stringify(value);
    if (before !== after) {
      doc[key] = value;
      changed = true;
    }
  }
  return changed;
}

function migrateFile(filePath) {
  stats.files++;
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`Parse fail ${filePath}:`, err.message);
    stats.errors++;
    return;
  }

  // Foundry v9-era packs: `data` → `system`, `permission` → `ownership`
  let normalizedLegacy = false;
  if (doc.data && typeof doc.data === "object") {
    // Prefer legacy `data` values over empty/default `system` from a prior bad pass
    doc.system = { ...(doc.system ?? {}), ...(doc.data ?? {}) };
    delete doc.data;
    normalizedLegacy = true;
  }
  if (doc.permission && !doc.ownership) {
    doc.ownership = doc.permission;
    delete doc.permission;
    normalizedLegacy = true;
  }

  // Skip non-actors/items (folders, tables, etc.) after ownership normalize
  if (!doc.type || !doc._id) {
    if (normalizedLegacy) {
      fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`);
      stats.written++;
    } else {
      stats.skipped++;
    }
    return;
  }

  const isActor = typeof doc._key === "string" && doc._key.startsWith("!actors");
  const isItem =
    (typeof doc._key === "string" && doc._key.startsWith("!items")) ||
    (!isActor && ["art", "spell", "ability", "weapon", "armor", "item", "focus", "skill", "asset", "power", "classEdge", "currency"].includes(doc.type));

  let migrated = null;
  try {
    if (isActor || ["character", "monster", "pc", "npc", "faction"].includes(doc.type)) {
      if (doc.type === "faction") {
        // still fix effect keys below
      } else {
        migrated = migrateActorData(doc);
        if (migrated) stats.actors++;
      }
    } else if (isItem) {
      migrated = migrateItemData(doc);
      if (migrated) stats.items++;
    }
  } catch (err) {
    console.error(`Transform fail ${filePath}:`, err);
    stats.errors++;
    return;
  }

  const migratedChanged = applyMigration(doc, migrated);
  const keysChanged = ensureEmbeddedKeys(doc);

  if (!migratedChanged && !normalizedLegacy && !keysChanged) {
    stats.skipped++;
    return;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`);
  stats.written++;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing ${SOURCE}`);
    process.exit(1);
  }
  for (const file of walkJson(SOURCE)) migrateFile(file);
  console.log("Pack migration complete:", stats);
}

main();
