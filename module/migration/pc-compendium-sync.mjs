import { isPc } from "../helpers/actor-types.mjs";
/**
 * PC focus/classEdge sync against system compendium definitions.
 * Pure fingerprint helpers are safe to import from Node unit tests.
 */

const SYNC_TYPES = new Set(["focus", "classEdge"]);

/**
 * @param {{ type?: string, name?: string }} item
 * @returns {string|null}
 */
export function itemSyncKey(item) {
  if (!item || !SYNC_TYPES.has(item.type)) return null;
  const name = String(item.name ?? "").trim().toLowerCase();
  if (!name) return null;
  return `${item.type}::${name}`;
}

/**
 * @param {object} item  plain item data or document-like { effects, system }
 * @returns {string}
 */
export function effectsFingerprint(item) {
  const effects = item?.effects ?? [];
  const parts = [];
  for (const effect of effects) {
    const changes = effect?.system?.changes ?? effect?.changes ?? [];
    for (const ch of changes) {
      const key = ch?.key ?? "";
      const type = ch?.type ?? ch?.mode ?? "";
      const value = ch?.value ?? "";
      const phase = ch?.phase ?? "";
      parts.push(`${key}|${type}|${value}|${phase}`);
    }
  }
  parts.sort();
  return parts.join(";");
}

/**
 * @param {object} system  classEdge system data
 * @returns {string}
 */
export function classEdgeGrantsFingerprint(system) {
  const s = system ?? {};
  const payload = {
    attackProgression: s.attackProgression ?? "none",
    poolGrant: {
      name: s.poolGrant?.name ?? "",
      formula: s.poolGrant?.formula ?? "",
      progression: s.poolGrant?.progression ?? [],
    },
    slotGrant: {
      enabled: !!s.slotGrant?.enabled,
      progression: s.slotGrant?.progression ?? [],
      leveledProgression: s.slotGrant?.leveledProgression ?? [],
    },
    hdGrant: {
      die: s.hdGrant?.die ?? "",
      perLevelMod: Number(s.hdGrant?.perLevelMod) || 0,
    },
    preparedGrant: {
      progression: s.preparedGrant?.progression ?? [],
    },
  };
  return JSON.stringify(payload);
}

/**
 * @param {object} item
 * @returns {string}
 */
export function itemShapeFingerprint(item) {
  const effects = effectsFingerprint(item);
  if (item?.type === "classEdge") {
    return `${effects}::${classEdgeGrantsFingerprint(item.system)}`;
  }
  return effects;
}

/**
 * @param {object} item  plain or document-like
 * @returns {object|null} system patch to reapply after swap
 */
export function extractPreservedFields(item) {
  if (!item || !SYNC_TYPES.has(item.type)) return null;
  const s = item.system ?? {};
  if (item.type === "focus") {
    const out = {
      ownedLevel: Number(s.ownedLevel) || 1,
      bonusSkillsChosen: Array.isArray(s.bonusSkillsChosen) ? [...s.bonusSkillsChosen] : [],
      internalResource: {
        value: Number(s.internalResource?.value) || 0,
        max: Number(s.internalResource?.max) || 0,
      },
    };
    if (s.bonusDice != null && s.bonusDice !== "") {
      out.bonusDice = Number(s.bonusDice);
    }
    return out;
  }
  return {
    poolGrant: {
      value: Number(s.poolGrant?.value) || 0,
    },
  };
}

/**
 * Build embedded create data from a pack item object + preserved progress.
 * @param {object} packItemObject  toObject()-like from system pack
 * @param {object|null} preserved  from extractPreservedFields
 * @returns {object}
 */
export function buildReplacementData(packItemObject, preserved) {
  const data = foundry.utils.deepClone(packItemObject);
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
  if (preserved && data.system) {
    if (data.type === "focus") {
      data.system.ownedLevel = preserved.ownedLevel ?? data.system.ownedLevel;
      data.system.bonusSkillsChosen = preserved.bonusSkillsChosen ?? [];
      if (preserved.internalResource) {
        data.system.internalResource = {
          ...(data.system.internalResource ?? {}),
          ...preserved.internalResource,
        };
      }
      if (preserved.bonusDice != null) data.system.bonusDice = preserved.bonusDice;
    } else if (data.type === "classEdge" && preserved.poolGrant) {
      data.system.poolGrant = {
        ...(data.system.poolGrant ?? {}),
        value: preserved.poolGrant.value,
      };
    }
  }
  return data;
}

/**
 * Whether two items differ in sync-relevant shape.
 * @param {object} owned
 * @param {object} pack
 * @returns {boolean}
 */
export function needsCompendiumSwap(owned, pack) {
  if (!owned || !pack) return false;
  if (itemSyncKey(owned) !== itemSyncKey(pack)) return false;
  return itemShapeFingerprint(owned) !== itemShapeFingerprint(pack);
}

const NS = "wwn";
const SETTING_DONE = "pcCompendiumItemSyncDone";

/**
 * Build lookup map type::name → plain item data from system Item packs.
 * @returns {Promise<Map<string, object>>}
 */
export async function buildSystemItemIndex() {
  const index = new Map();
  for (const pack of game.packs) {
    if (pack.metadata.packageType !== "system") continue;
    if (pack.documentName !== "Item") continue;
    // This system's packs are collections like "wwn.abilities-wwn"
    if (!String(pack.collection).startsWith(`${NS}.`)) continue;

    const docs = await pack.getDocuments();
    for (const doc of docs) {
      if (!SYNC_TYPES.has(doc.type)) continue;
      const key = itemSyncKey(doc);
      if (!key) continue;
      if (index.has(key)) {
        console.warn(`WWN | Duplicate system pack item for sync key ${key}; keeping first.`);
        continue;
      }
      index.set(key, doc.toObject());
    }
  }
  return index;
}

/**
 * @yields {Actor}
 */
function* iterWorldPcs() {
  for (const actor of game.actors) {
    if (isPc(actor)) yield actor;
  }
}

/**
 * @returns {Promise<Actor[]>}
 */
async function loadWorldPackPcs() {
  const out = [];
  for (const pack of game.packs) {
    if (pack.metadata.packageType !== "world") continue;
    if (pack.documentName !== "Actor") continue;
    if (pack.locked) continue;
    await pack.getDocuments();
    for (const actor of pack.contents) {
      if (isPc(actor)) out.push(actor);
    }
  }
  return out;
}

/**
 * @param {string} actorName
 * @returns {Promise<Folder>}
 */
async function ensureBackupFolder(actorName) {
  const base = `Migration Backup — ${actorName}`;
  const existing = game.folders.find(
    (f) => f.type === "Item" && f.name === base && !f.folder
  );
  if (existing) return existing;

  let name = base;
  let n = 2;
  while (game.folders.some((f) => f.type === "Item" && f.name === name)) {
    name = `${base} (${n++})`;
  }
  return Folder.create({ name, type: "Item", folder: null });
}

/**
 * Archive an owned item into the world Items backup folder, then delete it from the actor.
 * @param {Actor} actor
 * @param {Item} ownedItem
 */
export async function archiveAndDeleteOwnedItem(actor, ownedItem) {
  const oldData = ownedItem.toObject();
  const folder = await ensureBackupFolder(actor.name);
  const archive = foundry.utils.deepClone(oldData);
  delete archive._id;
  delete archive._key;
  archive.name = `[backup] ${archive.name}`;
  archive.folder = folder.id;
  await Item.createDocuments([archive]);
  await actor.deleteEmbeddedDocuments("Item", [ownedItem.id], { wwnMigrating: true });
  console.info(
    `WWN | Archived "${ownedItem.name}" from ${actor.name} → Items → ${folder.name}`
  );
}

/**
 * Archive old embedded item as a world Item, then replace on the actor.
 * @param {Actor} actor
 * @param {Item} ownedItem
 * @param {object} packObject
 * @returns {Promise<boolean>} true if swapped
 */
async function swapOwnedItem(actor, ownedItem, packObject) {
  const preserved = extractPreservedFields(ownedItem);
  await archiveAndDeleteOwnedItem(actor, ownedItem);
  const createData = buildReplacementData(packObject, preserved);
  const [created] = await actor.createEmbeddedDocuments("Item", [createData], {
    wwnMigrating: true,
  });

  if (created?.type === "focus") {
    const { syncFocusTransferEffects } = await import("../helpers/focus-effects.mjs");
    await syncFocusTransferEffects(created);
  }

  console.info(
    `WWN | Synced ${ownedItem.type} "${ownedItem.name}" on ${actor.name} from system compendium.`
  );
  return true;
}

/**
 * One-shot sync of PC focus/classEdge items against system packs.
 * @returns {Promise<{ swapped: number, actors: number }>}
 */
export async function syncPcCompendiumItems() {
  if (game.settings.get(NS, SETTING_DONE)) {
    return { swapped: 0, actors: 0 };
  }

  const index = await buildSystemItemIndex();
  const actors = [...iterWorldPcs(), ...(await loadWorldPackPcs())];
  let swapped = 0;
  const touched = new Set();

  for (const actor of actors) {
    const stale = [];
    for (const item of actor.items) {
      if (!SYNC_TYPES.has(item.type)) continue;
      const key = itemSyncKey(item);
      if (!key) continue;
      const packObject = index.get(key);
      if (!packObject) continue;
      if (needsCompendiumSwap(item, packObject)) stale.push({ item, packObject });
    }
    for (const { item, packObject } of stale) {
      // Re-fetch in case prior swap mutated the collection mid-loop
      const current = actor.items.get(item.id);
      if (!current) continue;
      if (!needsCompendiumSwap(current, packObject)) continue;
      await swapOwnedItem(actor, current, packObject);
      swapped++;
      touched.add(actor.id);
    }
  }

  await game.settings.set(NS, SETTING_DONE, true);

  if (swapped > 0) {
    ui.notifications.info(
      game.i18n.format("WWN.Migration.ItemSyncComplete", {
        count: swapped,
        actors: touched.size,
      }),
      { permanent: true }
    );
  } else {
    console.info("WWN | PC compendium item sync: no stale focus/classEdge items found.");
  }

  return { swapped, actors: touched.size };
}

/**
 * Run sync once if the one-shot flag is unset (GM only).
 */
export async function maybeSyncPcCompendiumItems() {
  if (!game.user?.isGM) return;
  if (game.settings.get(NS, SETTING_DONE)) return;
  try {
    await syncPcCompendiumItems();
  } catch (err) {
    console.error("WWN | PC compendium item sync failed:", err);
    ui.notifications.error(game.i18n.localize("WWN.Migration.ItemSyncFailed"));
  }
}
