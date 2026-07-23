/**
 * Auto-grant companion powers/foci when a classEdge is added to an actor.
 * Manifest maps classEdge display name → companion names in system packs.
 * Items may also set system.companions to override the static map (e.g. SWN Full Expert).
 */

/**
 * @typedef {{ name: string, ownedLevel?: number }} CompanionSpec
 */

/** @type {Record<string, Array<string|CompanionSpec>>} */
export const CLASS_EDGE_COMPANIONS = {
  "Full Warrior": ["Veteran's Luck"],
  "Full Expert": ["Masterful Expertise"],
  "Full Elementalist": ["Elemental Sparks"],
  "Partial Elementalist": ["Elemental Sparks"],
  Duelist: ["Favored Weapon"],
  Healer: ["Healing Touch"],
  Vowed: ["Martial Style"],
  // AWN / CWN Edges (shared names; companions live in each pack)
  "Masterful Expertise": ["Masterful Expertise"],
  "Veteran's Luck": ["Veteran's Luck"],
  Ghost: ["Ghost Scene Reroll", "Ghost Unseen Move"],
  Comrade: ["Comrade Ally Reroll"],
  "Survivor's Fortune": ["Survivor's Fortune"],
  "Operator's Fortune": ["Operator's Fortune"],
  "Beacon of Hope": ["Beacon of Hope"],
  Face: ["Face Temporary Contact"],
  Faceless: [{ name: "Gray Man", ownedLevel: 2 }, "Faceless Sneak Reroll"],
  "Systemic Immunity": [{ name: "Natural Immunity", ownedLevel: 2 }],
  "Voice of the People": [{ name: "Pop Idol", ownedLevel: 2 }],
};

/**
 * @param {string|CompanionSpec} entry
 * @returns {CompanionSpec}
 */
export function normalizeCompanionEntry(entry) {
  if (entry && typeof entry === "object" && entry.name) {
    return {
      name: String(entry.name).trim(),
      ownedLevel: entry.ownedLevel != null ? Number(entry.ownedLevel) : undefined,
    };
  }
  return { name: String(entry ?? "").trim() };
}

/**
 * @param {string} classEdgeName
 * @param {string[]} [itemCompanions]  system.companions override
 * @returns {CompanionSpec[]}
 */
export function companionsForClassEdge(classEdgeName, itemCompanions = []) {
  const fromItem = (itemCompanions ?? []).map((n) => String(n).trim()).filter(Boolean);
  if (fromItem.length) return fromItem.map((name) => ({ name }));
  const key = String(classEdgeName ?? "").trim();
  const list = CLASS_EDGE_COMPANIONS[key] ?? [];
  return list.map(normalizeCompanionEntry).filter((c) => c.name);
}

/**
 * Names of owned power/focus items (companions), lowercased trim.
 * Excludes classEdge so an Edge can share a display name with its companion power.
 * @param {Actor} actor
 * @returns {Set<string>}
 */
export function ownedItemNameSet(actor) {
  const set = new Set();
  for (const item of actor.items ?? []) {
    if (item.type !== "power" && item.type !== "focus") continue;
    const n = String(item.name ?? "").trim().toLowerCase();
    if (n) set.add(n);
  }
  return set;
}

/**
 * Which companion specs still need to be granted.
 * @param {string} classEdgeName
 * @param {Iterable<string>|Set<string>} ownedNamesLower
 * @param {string[]} [itemCompanions]
 * @returns {CompanionSpec[]}
 */
export function missingCompanions(classEdgeName, ownedNamesLower, itemCompanions = []) {
  const owned = ownedNamesLower instanceof Set
    ? ownedNamesLower
    : new Set([...ownedNamesLower].map((n) => String(n).trim().toLowerCase()));
  return companionsForClassEdge(classEdgeName, itemCompanions).filter(
    (c) => !owned.has(c.name.trim().toLowerCase()),
  );
}

/**
 * Find a system Item pack document by name (case-insensitive).
 * Prefer packs whose collection id contains `preferPackHint` when provided.
 * @param {string} name
 * @param {string} [preferPackHint]
 * @returns {Promise<object|null>} Item document or null
 */
export async function findSystemPackItemByName(name, preferPackHint = "") {
  const want = String(name ?? "").trim().toLowerCase();
  if (!want) return null;
  const hint = String(preferPackHint ?? "").toLowerCase();
  /** @type {object[]} */
  const matches = [];
  for (const pack of game.packs) {
    if (pack.metadata?.packageType !== "system") continue;
    if (pack.documentName !== "Item") continue;
    const index = pack.index?.size ? pack.index : await pack.getIndex({ fields: ["name", "type"] });
    const entry = [...index].find((e) => String(e.name ?? "").trim().toLowerCase() === want);
    if (!entry) continue;
    const doc = await pack.getDocument(entry._id);
    if (doc) matches.push({ doc, packId: pack.collection });
  }
  if (!matches.length) return null;
  if (hint) {
    const preferred = matches.find((m) => m.packId.toLowerCase().includes(hint));
    if (preferred) return preferred.doc;
  }
  return matches[0].doc;
}

/**
 * Infer pack hint from classEdge source flags or edgeType context.
 * @param {Item} classEdgeItem
 * @returns {string}
 */
function packHintFor(classEdgeItem) {
  const src = classEdgeItem?.flags?.core?.sourceId ?? classEdgeItem?.flags?.wwn?.pack ?? "";
  const s = String(src).toLowerCase();
  if (s.includes("abilities-swn")) return "abilities-swn";
  if (s.includes("abilities-awn")) return "abilities-awn";
  if (s.includes("abilities-cwn")) return "abilities-cwn";
  if (s.includes("abilities-wwn")) return "abilities-wwn";
  return "";
}

/**
 * Create missing companion items on the actor from system packs.
 * @param {Actor} actor
 * @param {Item} classEdgeItem
 * @param {object} [options]
 * @param {boolean} [options.wwnGranting] internal recursion guard via create options
 */
export async function grantClassEdgeCompanions(actor, classEdgeItem, options = {}) {
  if (!actor || classEdgeItem?.type !== "classEdge") return [];
  if (options.wwnGranting) return [];

  const missing = missingCompanions(
    classEdgeItem.name,
    ownedItemNameSet(actor),
    classEdgeItem.system?.companions ?? [],
  );
  if (!missing.length) return [];

  const hint = packHintFor(classEdgeItem);
  const toCreate = [];
  for (const spec of missing) {
    const doc = await findSystemPackItemByName(spec.name, hint);
    if (!doc) {
      console.warn(`WWN | Companion item not found in system packs: ${spec.name}`);
      continue;
    }
    const data = doc.toObject();
    delete data._id;
    delete data._key;
    delete data.folder;
    delete data.sort;
    delete data.ownership;
    if (Array.isArray(data.effects)) {
      data.effects = data.effects.map((e) => {
        const effect = foundry.utils.deepClone(e);
        delete effect._id;
        delete effect._key;
        return effect;
      });
    }
    if (spec.ownedLevel != null && data.system) {
      data.system.ownedLevel = spec.ownedLevel;
    }
    toCreate.push(data);
  }

  if (!toCreate.length) return [];
  return actor.createEmbeddedDocuments("Item", toCreate, { wwnGranting: true });
}
