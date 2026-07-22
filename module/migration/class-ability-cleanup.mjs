/**
 * One-shot cleanup: retire Class Ability foci, strip legacy Full Warrior AE,
 * flag existing PCs that need classEdge assignment.
 */

import { archiveAndDeleteOwnedItem } from "./pc-compendium-sync.mjs";
import { isPc } from "../helpers/actor-types.mjs";
import { safeDeleteActorActiveEffects } from "../helpers/safe-delete-active-effects.mjs";

const NS = "wwn";
const SETTING_DONE = "classAbilityCleanupDone";
const SETTING_FLAG_REPAIR = "classAssignmentFlagRepairDone";

/** Exact names of pack foci removed in favor of classEdges (case-insensitive match). */
export const RETIRED_CLASS_ABILITY_NAMES = [
  "Class Ability: Killing Blow",
  "Class Ability: Veteran's Luck",
  "Class Ability: Quick Learner",
  "Class Ability: Masterful Expertise",
  "Class Ability: Arcane Tradition",
];

const RETIRED_SET = new Set(RETIRED_CLASS_ABILITY_NAMES.map((n) => n.trim().toLowerCase()));

/** Item types that mark a pack actor as a real PC (not a map/token placeholder). */
const PLAYABLE_PC_ITEM_TYPES = new Set(["skill", "focus", "power"]);

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isRetiredClassAbilityName(name) {
  return RETIRED_SET.has(String(name ?? "").trim().toLowerCase());
}

/**
 * Whether an actor looks like a playable PC rather than an empty map token.
 * Used to gate `needsClassAssignment` on world pack actors.
 * @param {{ items?: Iterable<{ type?: string }> }|null|undefined} actor
 * @returns {boolean}
 */
export function isLikelyPlayablePc(actor) {
  for (const item of actor?.items ?? []) {
    if (PLAYABLE_PC_ITEM_TYPES.has(item?.type)) return true;
  }
  return false;
}

/**
 * Pack PCs get the class-assignment flag only when they look playable or we
 * just archived a retired Class Ability from them (those foci may have been
 * their only character-defining items).
 * @param {{ items?: Iterable<{ type?: string }> }|null|undefined} actor
 * @param {number} [archived]
 * @returns {boolean}
 */
export function shouldFlagPackPcClassAssignment(actor, archived = 0) {
  if ([...(actor?.items ?? [])].some((i) => i?.type === "classEdge")) return false;
  if (archived > 0) return true;
  return isLikelyPlayablePc(actor);
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
 * @param {Actor} actor
 * @param {{ flagMode?: "always"|"never"|"ifPlayable" }} [options]
 *   - `always`: world directory PCs
 *   - `ifPlayable`: world pack PCs that look real (or had Class Abilities archived)
 *   - `never`: archive/AE only
 * @returns {Promise<number>} archived count
 */
async function cleanupActorClassAbilities(actor, { flagMode = "always" } = {}) {
  let archived = 0;
  const toRemove = actor.items.filter((i) => isRetiredClassAbilityName(i.name));
  for (const item of toRemove) {
    const current = actor.items.get(item.id);
    if (!current) continue;
    await archiveAndDeleteOwnedItem(actor, current);
    archived++;
  }

  // Flag before AE deletes so a failure cannot skip the prompt.
  const hasClassEdge = actor.items.some((i) => i.type === "classEdge");
  const shouldFlag =
    !hasClassEdge
    && (
      flagMode === "always"
      || (flagMode === "ifPlayable" && shouldFlagPackPcClassAssignment(actor, archived))
    );
  if (shouldFlag) {
    await actor.setFlag(NS, "needsClassAssignment", true);
    if (flagMode === "ifPlayable") {
      console.info(`WWN | Class assignment: flagged pack PC ${actor.name}`);
    }
  }

  // Only actor-owned (source) effects — transferred item effects appear in
  // actor.effects but are not deletable via deleteEmbeddedDocuments.
  const sourceEffectIds = new Set((actor._source?.effects ?? []).map((e) => e._id));
  const aeIds = actor.effects
    .filter(
      (e) =>
        String(e.name ?? "").trim() === "Full Warrior"
        && sourceEffectIds.has(e.id)
    )
    .map((e) => e.id);
  if (aeIds.length) {
    const deleted = await safeDeleteActorActiveEffects(actor, aeIds);
    if (deleted.length) {
      console.info(`WWN | Removed legacy Full Warrior AE(s) on ${actor.name}`);
    }
  }

  return archived;
}

/**
 * One-shot: flag PCs that still lack classEdges after cleanup ran without
 * matching `character`-typed actors (pre-isPc filter). Skips dismissed PCs.
 * World directory: all PCs. Packs: only likely-playable PCs.
 */
async function repairMissingClassAssignmentFlags() {
  if (game.settings.get(NS, SETTING_FLAG_REPAIR)) return { flagged: 0 };
  let flagged = 0;
  console.info("WWN | Class assignment: repairing missing needsClassAssignment flags…");

  for (const actor of iterWorldPcs()) {
    if (actor.items.some((i) => i.type === "classEdge")) continue;
    if (actor.getFlag(NS, "classAssignmentDismissed")) continue;
    if (actor.getFlag(NS, "needsClassAssignment")) continue;
    await actor.setFlag(NS, "needsClassAssignment", true);
    flagged++;
  }

  const packPcs = await loadWorldPackPcs();
  for (const actor of packPcs) {
    if (!isLikelyPlayablePc(actor)) continue;
    if (actor.items.some((i) => i.type === "classEdge")) continue;
    if (actor.getFlag(NS, "classAssignmentDismissed")) continue;
    if (actor.getFlag(NS, "needsClassAssignment")) continue;
    await actor.setFlag(NS, "needsClassAssignment", true);
    console.info(`WWN | Class assignment: flagged pack PC ${actor.name}`);
    flagged++;
  }

  await game.settings.set(NS, SETTING_FLAG_REPAIR, true);
  if (flagged > 0) {
    console.info(`WWN | Class assignment: flagged ${flagged} PC(s) missing classEdge.`);
  } else {
    console.info("WWN | Class assignment: flag repair done (none newly flagged).");
  }
  return { flagged };
}

/**
 * One-shot world cleanup after classAbility → classEdge transition.
 * @returns {Promise<{ archived: number, actors: number }>}
 */
export async function maybeCleanupClassAbilities() {
  if (!game.user?.isGM) return { archived: 0, actors: 0 };

  let archived = 0;
  let touched = 0;

  if (!game.settings.get(NS, SETTING_DONE)) {
    const worldPcs = [...iterWorldPcs()];
    console.info(`WWN | Class ability cleanup: ${worldPcs.length} world PC(s)…`);
    for (const actor of worldPcs) {
      try {
        console.info(`WWN | Class ability cleanup: ${actor.name}`);
        const n = await cleanupActorClassAbilities(actor, { flagMode: "always" });
        if (n > 0 || actor.getFlag(NS, "needsClassAssignment")) touched++;
        archived += n;
      } catch (err) {
        console.error(`WWN | Class ability cleanup failed for ${actor.name}:`, err);
      }
    }

    const packPcs = await loadWorldPackPcs();
    console.info(
      `WWN | Class ability cleanup: scanning ${packPcs.length} pack PC(s) (flag playable only)…`
    );
    for (const actor of packPcs) {
      try {
        const n = await cleanupActorClassAbilities(actor, { flagMode: "ifPlayable" });
        if (n > 0 || actor.getFlag(NS, "needsClassAssignment")) {
          if (n > 0) console.info(`WWN | Class ability cleanup (pack): archived on ${actor.name}`);
          touched++;
          archived += n;
        }
      } catch (err) {
        console.error(`WWN | Class ability cleanup failed for pack PC ${actor.name}:`, err);
      }
    }

    await game.settings.set(NS, SETTING_DONE, true);
    console.info(`WWN | Class ability cleanup: done (archived ${archived}).`);

    if (archived > 0) {
      ui.notifications.info(
        game.i18n.format("WWN.Migration.ClassAbilityCleanupComplete", {
          count: archived,
          actors: touched,
        }),
        { permanent: true }
      );
    } else {
      console.info("WWN | Class ability cleanup: no retired Class Ability items found.");
    }
  }

  await repairMissingClassAssignmentFlags();

  return { archived, actors: touched };
}

/**
 * Persist removal of embedded items that failed validation (no name/type).
 * {@link WwnActor.migrateData} drops them in-memory; this writes a clean items array back.
 * @returns {Promise<number>} actors updated
 */
export async function repairInvalidEmbeddedItems() {
  if (!game.user?.isGM) return 0;
  let updated = 0;
  for (const actor of game.actors) {
    const invalidIds = actor.items?.invalidDocumentIds;
    if (!invalidIds?.size) continue;
    const items = actor.items.contents.map((i) => i.toObject());
    try {
      await actor.update({ items }, { diff: false, recursive: false, render: false });
      console.info(
        `WWN | Purged ${invalidIds.size} invalid embedded item(s) from ${actor.name}`
      );
      updated++;
    } catch (err) {
      console.error(`WWN | Failed to purge invalid items on ${actor.name}:`, err);
    }
  }
  return updated;
}
