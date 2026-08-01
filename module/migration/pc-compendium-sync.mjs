import { isPc } from "../helpers/actor-types.mjs";
/**
 * PC focus/classEdge/power sync against system compendium definitions.
 * Pure fingerprint helpers are safe to import from Node unit tests.
 */

const NS = "wwn";
const SYNC_TYPES = new Set(["focus", "classEdge", "power"]);

/** Bump when sync scope or fingerprints change so alpha worlds re-run. */
export const PC_COMPENDIUM_SYNC_GENERATION = 3;

/** Sole system Item pack used as the sync source of truth. */
const SYNC_PACK_COLLECTION = `${NS}.abilities-wwn`;

/**
 * @param {{ type?: string, name?: string, system?: { subType?: string } }} item
 * @returns {string|null}
 */
export function itemSyncKey(item) {
  if (!item || !SYNC_TYPES.has(item.type)) return null;
  const name = String(item.name ?? "").trim().toLowerCase();
  if (!name) return null;
  if (item.type === "power") {
    const subType = String(item.system?.subType ?? "").trim().toLowerCase() || "power";
    return `power::${subType}::${name}`;
  }
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
    bonusSkills: s.bonusSkills ?? [],
    bonusSkillsPick: Number(s.bonusSkillsPick) || 0,
    bonusSkillsMode: s.bonusSkillsMode ?? "",
    attributeGrant: {
      mode: s.attributeGrant?.mode ?? "",
      exclude: s.attributeGrant?.exclude ?? [],
    },
  };
  return JSON.stringify(payload);
}

/**
 * Sync-relevant power shape (excludes live spend / prepared state).
 * @param {object} system
 * @returns {string}
 */
export function powerShapeFingerprint(system) {
  const s = system ?? {};
  const activation = s.activation ?? {};
  const payload = {
    subType: s.subType ?? "",
    damageRoll: s.damageRoll ?? "",
    healing: !!s.healing,
    activation: {
      roll: activation.roll ?? "",
      rollType: activation.rollType ?? "",
      rollTarget: activation.rollTarget ?? 0,
      save: activation.save ?? "",
      range: activation.range ?? "",
      duration: activation.duration ?? "",
    },
    commitmentOptions: s.commitmentOptions ?? [],
    resourceName: s.resourceName ?? "",
    source: s.source ?? "",
    description: s.description ?? "",
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
  if (item?.type === "power") {
    return `${effects}::${powerShapeFingerprint(item.system)}`;
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
  if (item.type === "power") {
    return {
      poolCommitted: {
        none: Number(s.poolCommitted?.none) || 0,
        active: Number(s.poolCommitted?.active) || 0,
        scene: Number(s.poolCommitted?.scene) || 0,
        day: Number(s.poolCommitted?.day) || 0,
      },
      prepared: !!s.prepared,
      isActive: !!s.isActive,
      installed: !!s.installed,
      internalResource: {
        value: Number(s.internalResource?.value) || 0,
        max: Number(s.internalResource?.max) || 0,
      },
      level: Number(s.level) || 0,
    };
  }
  return {
    poolGrant: {
      value: Number(s.poolGrant?.value) || 0,
    },
    bonusSkillsChosen: Array.isArray(s.bonusSkillsChosen) ? [...s.bonusSkillsChosen] : [],
    attributeGrant: {
      chosen: String(s.attributeGrant?.chosen ?? ""),
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
    } else if (data.type === "classEdge" && preserved) {
      if (preserved.poolGrant) {
        data.system.poolGrant = {
          ...(data.system.poolGrant ?? {}),
          value: preserved.poolGrant.value,
        };
      }
      if (Array.isArray(preserved.bonusSkillsChosen)) {
        data.system.bonusSkillsChosen = preserved.bonusSkillsChosen;
      }
      if (preserved.attributeGrant?.chosen) {
        data.system.attributeGrant = {
          ...(data.system.attributeGrant ?? {}),
          chosen: preserved.attributeGrant.chosen,
        };
      }
    } else if (data.type === "power" && preserved) {
      if (preserved.poolCommitted) {
        data.system.poolCommitted = {
          ...(data.system.poolCommitted ?? {}),
          ...preserved.poolCommitted,
        };
      }
      if (preserved.internalResource) {
        data.system.internalResource = {
          ...(data.system.internalResource ?? {}),
          ...preserved.internalResource,
        };
      }
      data.system.prepared = preserved.prepared ?? data.system.prepared;
      data.system.isActive = preserved.isActive ?? data.system.isActive;
      data.system.installed = preserved.installed ?? data.system.installed;
      if (preserved.level != null && Number(preserved.level) > 0) {
        data.system.level = preserved.level;
      }
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

const SETTING_DONE = "pcCompendiumItemSyncDone";
const SETTING_GEN = "pcCompendiumItemSyncGen";

/**
 * Effective completed sync generation for this world.
 * Gen-1 boolean-only worlds count as generation 1.
 * @returns {number}
 */
export function getCompletedSyncGeneration() {
  const gen = Number(game.settings.get(NS, SETTING_GEN) || 0);
  if (gen > 0) return gen;
  if (game.settings.get(NS, SETTING_DONE)) return 1;
  return 0;
}

/**
 * @returns {boolean}
 */
export function isPcCompendiumSyncComplete() {
  return getCompletedSyncGeneration() >= PC_COMPENDIUM_SYNC_GENERATION;
}

/**
 * Build lookup map type::name → plain item data from WWN Abilities only.
 * @returns {Promise<Map<string, object>>}
 */
export async function buildSystemItemIndex() {
  const index = new Map();
  const pack = game.packs.get(SYNC_PACK_COLLECTION);
  if (!pack || pack.documentName !== "Item") {
    console.warn(`WWN | PC compendium sync: pack ${SYNC_PACK_COLLECTION} not found.`);
    return index;
  }

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

const MIGRATION_BACKUPS_PARENT_NAME = "Migration Backups";

/**
 * Top-level Items folder that contains per-actor migration backup folders.
 * @returns {Promise<Folder>}
 */
async function ensureParentBackupFolder() {
  const existing = game.folders.find(
    (f) => f.type === "Item" && f.name === MIGRATION_BACKUPS_PARENT_NAME && !f.folder
  );
  if (existing) return existing;
  return Folder.create({
    name: MIGRATION_BACKUPS_PARENT_NAME,
    type: "Item",
    folder: null,
  });
}

/**
 * @param {string} actorName
 * @returns {Promise<Folder>}
 */
export async function ensureBackupFolder(actorName) {
  const parent = await ensureParentBackupFolder();
  const base = `Migration Backup — ${actorName}`;

  const nested = game.folders.find(
    (f) =>
      f.type === "Item" &&
      f.name === base &&
      f.folder?.id === parent.id
  );
  if (nested) return nested;

  const legacyTopLevel = game.folders.find(
    (f) => f.type === "Item" && f.name === base && !f.folder
  );
  if (legacyTopLevel) {
    await legacyTopLevel.update({ folder: parent.id });
    return legacyTopLevel;
  }

  let name = base;
  let n = 2;
  while (
    game.folders.some(
      (f) => f.type === "Item" && f.name === name && f.folder?.id === parent.id
    )
  ) {
    name = `${base} (${n++})`;
  }
  return Folder.create({ name, type: "Item", folder: parent.id });
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
 * Sync PC focus/classEdge/power items against system packs when behind generation.
 * @returns {Promise<{ swapped: number, actors: number }>}
 */
export async function syncPcCompendiumItems() {
  if (isPcCompendiumSyncComplete()) {
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

  await game.settings.set(NS, SETTING_GEN, PC_COMPENDIUM_SYNC_GENERATION);
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
    console.info("WWN | PC compendium item sync: no stale focus/classEdge/power items found.");
  }

  return { swapped, actors: touched.size };
}

/**
 * Run sync when the world is behind the current sync generation (GM only).
 */
export async function maybeSyncPcCompendiumItems() {
  if (!game.user?.isGM) return;
  if (isPcCompendiumSyncComplete()) return;
  try {
    await syncPcCompendiumItems();
  } catch (err) {
    console.error("WWN | PC compendium item sync failed:", err);
    ui.notifications.error(game.i18n.localize("WWN.Migration.ItemSyncFailed"));
  }
}
