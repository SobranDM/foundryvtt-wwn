import {
  migrateActorData,
  migrateItemData,
  applyEmbeddedItemMigration,
  isBarePlaceholderActorData,
} from "./transforms.mjs";
import { mergeWeaponFavorites } from "../helpers/favorites.mjs";
import { isNpc, isPc } from "../helpers/actor-types.mjs";
import { remapAssetPath } from "./asset-map.mjs";
import { maybeSyncPcCompendiumItems } from "./pc-compendium-sync.mjs";
import { maybeCleanupClassAbilities, repairInvalidEmbeddedItems } from "./class-ability-cleanup.mjs";

const NS = "wwn";

/** Legacy item types that the server cannot instantiate (not in system.json). */
const LEGACY_ITEM_TYPES = new Set(["art", "spell", "ability"]);

/** Versions below this trigger migration. Bump when adding steps. */
const NEEDS_MIGRATION_BELOW = "2.0.0";

/** @param {any} value */
function forcedReplace(value) {
  return foundry.data.operators.ForcedReplacement.create(value);
}

/**
 * Check the world's migration version on ready and run migration if needed.
 * Also runs one-shot PC compendium item sync when that flag is still unset.
 */
export async function checkMigration() {
  if (!game.user.isGM) return;
  const current = game.settings.get(NS, "systemMigrationVersion");
  const needsVersionMigrate =
    !current || foundry.utils.isNewerVersion(NEEDS_MIGRATION_BELOW, current);

  if (needsVersionMigrate) {
    // Shape / item signals only — actor types stay character/monster forever.
    const needsWork =
      game.actors.some((a) => a.system?.scores) ||
      game.actors.some(
        (a) => isPc(a) && a.system?.combat?.ab !== undefined && a.system?.combat?.abMod === undefined
      ) ||
      game.actors.some((a) => isNpc(a) && a.system?.hp?.hd && !a.system?.hd) ||
      game.items.some((i) => ["art", "spell", "ability"].includes(i.type)) ||
      game.items.some((i) => i.type === "armor" && i.system?.traumaTargetMod !== undefined) ||
      game.items.some(
        (i) =>
          i.type === "power"
          && i.system?.internalResourceLength
          && !["scene", "day"].includes(i.system.internalResourceLength)
      ) ||
      game.actors.invalidDocumentIds.size > 0 ||
      game.items.invalidDocumentIds.size > 0 ||
      [...game.actors].some((a) =>
        [...(a.items?.invalidDocumentIds ?? [])].length > 0
        || [...a.items].some((i) => LEGACY_ITEM_TYPES.has(i.type))
      );
    if (!needsWork) {
      await game.settings.set(NS, "systemMigrationVersion", game.system.version);
    } else {
      await migrateWorld();
    }
  }

  // One-shot: refresh stale PC foci/classEdges from system packs (also covers
  // worlds that already finished data-model migration before this step shipped).
  await maybeSyncPcCompendiumItems();

  // One-shot: archive retired Class Ability foci, strip Full Warrior AE, flag class assignment.
  await maybeCleanupClassAbilities();

  // Drop corrupt embedded items left without name/type (blocks actor load otherwise).
  await repairInvalidEmbeddedItems();
}

/**
 * Migrate all world actors, items, scene token deltas, and compendium packs.
 * Idempotent: documents already in WWN shape pass through unchanged.
 */
export async function migrateWorld() {
  ui.notifications.info(
    game.i18n.format("WWN.Migration.Started", { version: game.system.version }),
    { permanent: false }
  );

  // Foundry dismisses non-permanent notifications after Notifications.LIFETIME_MS
  // (5s). Re-ping at 5.5s so a replacement appears shortly after each fades.
  const stillMigrating = window.setInterval(() => {
    ui.notifications.info(game.i18n.localize("WWN.Migration.StillRunning"), {
      permanent: false,
      console: false,
    });
  }, 5500);

  game.wwn ??= {};
  game.wwn.migrating = true;

  try {
    console.info("WWN | Migration: starting world items…");
    let itemCount = 0;
    for (const item of allDocuments(game.items)) {
      try {
        await migrateWorldItem(item);
        itemCount++;
      } catch (err) {
        console.error(`WWN | Item migration failed for ${item.name}:`, err);
      }
    }
    console.info(`WWN | Migration: world items done (${itemCount}). Starting actors…`);

    for (const actor of allDocuments(game.actors)) {
      try {
        console.info(`WWN | Migration: starting actor ${actor.name}`);
        await migrateActorDocument(actor);
        console.info(`${actor.name}-- Migration Complete`);
      } catch (err) {
        console.error(`WWN | Actor migration failed for ${actor.name}:`, err);
      }
    }
    console.info("WWN | Migration: world actors done. Checking world packs…");

    for (const pack of game.packs) {
      if (pack.metadata.packageType !== "world") continue;
      if (!["Actor", "Item"].includes(pack.documentName)) continue;
      if (pack.locked) continue;
      console.info(`WWN | Migration: pack ${pack.collection}…`);
      await pack.getDocuments(); // populates the collection + invalid bucket
      for (const doc of allDocuments(pack)) {
        try {
          if (pack.documentName === "Item") {
            await migrateWorldItem(doc);
          } else {
            console.info(`WWN | Migration: starting pack actor ${doc.name}`);
            await migrateActorDocument(doc);
            console.info(`${doc.name}-- Migration Complete`);
          }
        } catch (err) {
          console.error(`WWN | Pack migration failed for ${doc.name}:`, err);
        }
      }
    }

    console.info("WWN | Migration: post-steps (compendium sync, class cleanup)…");
    await game.settings.set(NS, "systemMigrationVersion", game.system.version);
    await maybeSyncPcCompendiumItems();
    await maybeCleanupClassAbilities();
    console.info("WWN | Migration: all steps finished.");
  } finally {
    game.wwn.migrating = false;
    window.clearInterval(stillMigrating);
  }

  ui.notifications.info(
    game.i18n.format("WWN.Migration.Complete", { version: game.system.version }),
    { permanent: true }
  );
}

/**
 * World-level Item: type changes (art→power) must recreate — the server cannot
 * updateSource on a document whose stored type is no longer in system.json.
 * @param {Item} item
 */
async function migrateWorldItem(item) {
  const raw = item.toObject();
  const pending = !!item.getFlag?.(NS, "pendingTypeMigration");
  const migrated = applyEmbeddedItemMigration(raw);
  const needsRecreate =
    pending
    || LEGACY_ITEM_TYPES.has(raw.type)
    || (migrated.type && migrated.type !== raw.type);

  if (needsRecreate) {
    const keepId = item.id;
    const pack = item.pack || null;
    foundry.utils.setProperty(migrated, `flags.${NS}.pendingTypeMigration`, null);
    await item.delete();
    await CONFIG.Item.documentClass.create({ ...migrated, _id: keepId }, {
      keepId: true,
      pack,
      wwnMigrating: true,
    });
    return;
  }

  const data = migrateItemData(raw);
  if (!data) return;
  await item.update(data, { enforceTypes: false, diff: false, recursive: false });
}

/**
 * Iterate a DocumentCollection's valid documents plus its invalid ones.
 * Legacy item types (`art`, ...) may fail schema validation and live in the
 * invalid bucket; actor types stay character/monster (with pc/npc aliases).
 */
function* allDocuments(collection) {
  yield* collection.contents;
  for (const id of collection.invalidDocumentIds) {
    const doc = collection.getInvalid(id, { strict: false });
    if (doc) yield doc;
  }
}

/**
 * Migrate a single Actor document in place (system shape + embedded items).
 * Does not change actor type.
 */
export async function migrateActorDocument(actor) {
  if (actor.type === "faction") return; // out of scope — leave untouched

  // Fast path: already canonical shape, no embedded content to fix.
  if (
    (isPc(actor) || isNpc(actor))
    && !actor.items?.size
    && !(actor.items?.invalidDocumentIds?.size)
    && !actor.effects?.size
    && !actor.system?.scores
    && !(isNpc(actor) && actor.system?.hp?.hd && !actor.system?.hd)
  ) {
    return;
  }

  const raw = actor.toObject();
  const itemSources = collectEmbeddedItemSources(actor, raw);
  raw.items = itemSources;
  const bare = isBarePlaceholderActorData(raw, itemSources);

  const result = migrateActorData(raw);
  if (!result) {
    if (!bare) {
      const replaced = await replaceEmbeddedItemsIfNeeded(actor, itemSources);
      if (replaced) await finalizeActorMigrationHooks(actor);
    }
    return;
  }

  const isDataChange = result.system !== null;
  const itemsChanged = !bare && embeddedItemsNeedReplace(itemSources, result.items);

  if (!isDataChange && !itemsChanged) {
    if (!bare && isNpc(actor)) await ensureNpcWeaponFavorites(actor);
    return;
  }

  if (raw.system?.hp?.injuries || raw.system?.hp?.wounds) {
    console.info(`WWN | ${actor.name}: WWN injuries/wounds data discarded (wound modules own that data).`);
  }

  const tokenSrc = foundry.utils.getProperty(raw, "prototypeToken.texture.src");
  const newTokenSrc = remapAssetPath(tokenSrc);

  await persistActorMigration(actor, {
    system: result.system,
    img: result.img && result.img !== actor.img ? result.img : undefined,
    tokenSrc: newTokenSrc !== tokenSrc ? newTokenSrc : undefined,
    effects: bare ? null : result.effects,
    items: itemsChanged ? result.items : null,
    bare,
  });

  if (!bare && isNpc(actor)) await ensureNpcWeaponFavorites(actor);
  if (itemsChanged) await finalizeActorMigrationHooks(actor);
}

/**
 * Run focus/power sync that was skipped during embedded item clear/recreate hooks.
 * @param {Actor} actor
 */
async function finalizeActorMigrationHooks(actor) {
  console.info(`WWN | ${actor.name}: post-item focus/power sync…`);
  const { syncPowerTransferEffects } = await import("../helpers/power-effects.mjs");
  for (const power of actor.items.filter((i) => i.type === "power")) {
    await syncPowerTransferEffects(power);
  }
  if (!isPc(actor)) return;
  const { syncActorFocusBonusSkills } = await import("../helpers/focus-bonus-skills.mjs");
  const { syncActorPowerBonusSkills } = await import("../helpers/power-bonus-skills.mjs");
  const { syncActorFocusEffects } = await import("../helpers/focus-effects.mjs");
  await syncActorFocusEffects(actor);
  await syncActorFocusBonusSkills(actor);
  await syncActorPowerBonusSkills(actor);
}

/**
 * Persist remapped system/items via update (never changes actor type).
 * Effects are applied surgically — never ForcedReplace the whole collection
 * (that races item clear/recreate and tries to delete transferred AEs).
 * @param {Actor} actor
 * @param {{
 *   system?: object|null,
 *   img?: string,
 *   tokenSrc?: string,
 *   effects?: object[]|null,
 *   items?: object[]|null,
 *   bare?: boolean,
 * }} data
 */
async function persistActorMigration(actor, data) {
  const label = actor.name ?? actor.id;
  const update = {};
  if (data.system != null) update.system = forcedReplace(data.system);
  if (data.img) update.img = data.img;
  if (data.tokenSrc) update["prototypeToken.texture.src"] = data.tokenSrc;

  if (Object.keys(update).length) {
    console.info(`WWN | ${label}: persisting system…`);
    await actor.update(update, { enforceTypes: false, diff: false, recursive: false });
  }

  if (data.effects?.length && !data.bare) {
    console.info(`WWN | ${label}: persisting effects…`);
    await persistActorEffectMigrations(actor, data.effects);
  }

  if (data.items == null) return;

  const migratedItems = data.items.map((i) => applyEmbeddedItemMigration(i));
  console.info(`WWN | ${label}: clearing ${actor.items?.size ?? 0} embedded items…`);
  await clearEmbeddedItems(actor);
  console.info(`WWN | ${label}: recreating ${migratedItems.length} embedded items…`);
  await recreateEmbeddedItems(actor, migratedItems);
  console.info(`WWN | ${label}: embedded items done.`);
}

/**
 * Create/update actor-owned effects from migration output without wiping the collection.
 * @param {Actor} actor
 * @param {object[]} effects
 */
async function persistActorEffectMigrations(actor, effects) {
  const sourceById = new Map((actor._source?.effects ?? []).map((e) => [e._id, e]));
  const toCreate = [];
  const toUpdate = [];

  for (const effect of effects) {
    if (!effect || typeof effect !== "object") continue;
    // Skip names owned by classEdge assignment / cleanup.
    if (String(effect.name ?? "").trim() === "Full Warrior") continue;

    const id = effect._id;
    if (!id || !sourceById.has(id)) {
      const data = foundry.utils.deepClone(effect);
      delete data._id;
      delete data._key;
      toCreate.push(data);
      continue;
    }

    const prev = sourceById.get(id);
    const prevChanges = JSON.stringify(prev.system?.changes ?? prev.changes ?? []);
    const nextChanges = JSON.stringify(effect.system?.changes ?? effect.changes ?? []);
    if (prevChanges === nextChanges && prev.name === effect.name) continue;
    toUpdate.push({
      _id: id,
      name: effect.name,
      img: effect.img,
      system: effect.system,
    });
  }

  if (toUpdate.length) {
    await actor.updateEmbeddedDocuments("ActiveEffect", toUpdate, { enforceTypes: false });
  }
  if (toCreate.length) {
    // Avoid duplicating an already-present migration Tweaks AE.
    const existingNames = new Set(
      (actor._source?.effects ?? []).map((e) => String(e.name ?? "").trim())
    );
    const filtered = toCreate.filter((e) => !existingNames.has(String(e.name ?? "").trim()));
    if (filtered.length) {
      await actor.createEmbeddedDocuments("ActiveEffect", filtered);
    }
  }
}

/**
 * Gather plain item data from the actor, including invalid embedded docs.
 * @param {Actor} actor
 * @param {object} raw  actor.toObject()
 * @returns {object[]}
 */
function collectEmbeddedItemSources(actor, raw) {
  const byId = new Map();
  for (const i of raw.items ?? []) {
    if (i?._id) byId.set(i._id, i);
  }
  const invalidIds = actor.items?.invalidDocumentIds;
  if (invalidIds) {
    for (const id of invalidIds) {
      const doc = actor.items.getInvalid(id, { strict: false });
      if (!doc) continue;
      const src = doc.toObject?.() ?? doc;
      if (src?._id) byId.set(src._id, src);
    }
  }
  return Array.from(byId.values());
}

/** @param {object[]} before @param {object[]} after */
function embeddedItemsNeedReplace(before, after) {
  if ((before?.length ?? 0) !== (after?.length ?? 0)) return true;
  for (let i = 0; i < after.length; i++) {
    const a = before[i];
    const b = after[i];
    if (!a || !b) return true;
    if (a.type !== b.type) return true;
    if (LEGACY_ITEM_TYPES.has(a.type) || LEGACY_ITEM_TYPES.has(b.type)) return true;
  }
  return before.some((i) => LEGACY_ITEM_TYPES.has(i.type));
}

/**
 * Replace embedded items when legacy types remain (no actor system rewrite needed).
 * @param {Actor} actor
 * @param {object[]} itemSources
 * @returns {Promise<boolean>} true if items were cleared/recreated
 */
async function replaceEmbeddedItemsIfNeeded(actor, itemSources) {
  const items = itemSources.map((i) => applyEmbeddedItemMigration(i));
  const needs = itemSources.some((src, idx) => {
    const next = items[idx];
    if (!next) return true;
    if (LEGACY_ITEM_TYPES.has(src.type) || src.type !== next.type) return true;
    return JSON.stringify(src.system ?? {}) !== JSON.stringify(next.system ?? {});
  });
  if (!needs) return false;
  const label = actor.name ?? actor.id;
  console.info(`WWN | ${label}: clearing ${actor.items?.size ?? 0} embedded items…`);
  await clearEmbeddedItems(actor);
  console.info(`WWN | ${label}: recreating ${items.length} embedded items…`);
  await recreateEmbeddedItems(actor, items);
  console.info(`WWN | ${label}: embedded items done.`);
  return true;
}

/**
 * Wipe the actor's item collection without constructing legacy Item documents.
 * Foundry's ForcedReplacement still createDocument()'s existing rows when IDs
 * match — an empty replacement avoids that path entirely.
 * @param {Actor} actor
 */
async function clearEmbeddedItems(actor) {
  const hasItems =
    actor.items?.size > 0
    || (actor.items?.invalidDocumentIds?.size ?? 0) > 0
    || (actor.toObject().items?.length ?? 0) > 0;
  if (!hasItems) return;
  await actor.update(
    { items: forcedReplace([]) },
    { enforceTypes: false, diff: false, recursive: false, wwnMigrating: true }
  );
}

/**
 * @param {Actor} actor
 * @param {object[]} items
 */
async function recreateEmbeddedItems(actor, items) {
  if (!items?.length) return;
  await actor.createEmbeddedDocuments("Item", items, {
    keepId: true,
    enforceTypes: false,
    wwnMigrating: true,
  });
}

/** Ensure all embedded weapons appear on an NPC favorites list. */
async function ensureNpcWeaponFavorites(actor) {
  if (!isNpc(actor)) return;
  const favorites = mergeWeaponFavorites(actor.system.favorites, actor.items);
  if (favorites) await actor.update({ "system.favorites": favorites });
}
