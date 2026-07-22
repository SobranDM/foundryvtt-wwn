/**
 * Auto-grant companion powers when a classEdge is added to an actor.
 * Manifest maps classEdge display name → companion power names in system packs.
 */

/** @type {Record<string, string[]>} */
export const CLASS_EDGE_COMPANIONS = {
  "Full Warrior": ["Veteran's Luck"],
  "Full Expert": ["Masterful Expertise"],
  "Full Elementalist": ["Elemental Sparks"],
  "Partial Elementalist": ["Elemental Sparks"],
  "Duelist": ["Favored Weapon"],
  "Healer": ["Healing Touch"],
  "Vowed": ["Martial Style"],
};

/**
 * @param {string} classEdgeName
 * @returns {string[]}
 */
export function companionsForClassEdge(classEdgeName) {
  const key = String(classEdgeName ?? "").trim();
  return CLASS_EDGE_COMPANIONS[key] ? [...CLASS_EDGE_COMPANIONS[key]] : [];
}

/**
 * Names the actor already owns (any item type), lowercased trim.
 * @param {Actor} actor
 * @returns {Set<string>}
 */
export function ownedItemNameSet(actor) {
  const set = new Set();
  for (const item of actor.items ?? []) {
    const n = String(item.name ?? "").trim().toLowerCase();
    if (n) set.add(n);
  }
  return set;
}

/**
 * Which companion names still need to be granted.
 * @param {string} classEdgeName
 * @param {Iterable<string>|Set<string>} ownedNamesLower
 * @returns {string[]}
 */
export function missingCompanions(classEdgeName, ownedNamesLower) {
  const owned = ownedNamesLower instanceof Set
    ? ownedNamesLower
    : new Set([...ownedNamesLower].map((n) => String(n).trim().toLowerCase()));
  return companionsForClassEdge(classEdgeName).filter(
    (name) => !owned.has(name.trim().toLowerCase())
  );
}

/**
 * Find a system Item pack document by name (case-insensitive).
 * @param {string} name
 * @returns {Promise<object|null>} Item document or null
 */
export async function findSystemPackItemByName(name) {
  const want = String(name ?? "").trim().toLowerCase();
  if (!want) return null;
  for (const pack of game.packs) {
    if (pack.metadata?.packageType !== "system") continue;
    if (pack.documentName !== "Item") continue;
    const index = pack.index?.size ? pack.index : await pack.getIndex({ fields: ["name", "type"] });
    const entry = [...index].find((e) => String(e.name ?? "").trim().toLowerCase() === want);
    if (!entry) continue;
    return pack.getDocument(entry._id);
  }
  return null;
}

/**
 * Create missing companion powers on the actor from system packs.
 * @param {Actor} actor
 * @param {Item} classEdgeItem
 * @param {object} [options]
 * @param {boolean} [options.wwnGranting] internal recursion guard via create options
 */
export async function grantClassEdgeCompanions(actor, classEdgeItem, options = {}) {
  if (!actor || classEdgeItem?.type !== "classEdge") return [];
  if (options.wwnGranting) return [];

  const missing = missingCompanions(classEdgeItem.name, ownedItemNameSet(actor));
  if (!missing.length) return [];

  const toCreate = [];
  for (const name of missing) {
    const doc = await findSystemPackItemByName(name);
    if (!doc) {
      console.warn(`WWN | Companion power not found in system packs: ${name}`);
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
    toCreate.push(data);
  }

  if (!toCreate.length) return [];
  return actor.createEmbeddedDocuments("Item", toCreate, { wwnGranting: true });
}
