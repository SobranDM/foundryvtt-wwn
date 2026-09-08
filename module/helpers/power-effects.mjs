import {
  usesSharedPool,
  resolveCommitmentOptions,
  usesInstalledField,
  hasFreeActiveToggle,
} from "../config/power-subtypes.mjs";
import { safeDeleteActorActiveEffects } from "./safe-delete-active-effects.mjs";

const FLAG = "wwn";

/**
 * @param {Item} power
 * @returns {"passive"|"active"|"none"}
 */
export function getPowerTransferMode(power) {
  if (power.type !== "power") return "none";
  const subType = power.system.subType;
  const system = power.system;

  let mode;
  if (!usesSharedPool(subType, system)) {
    mode = "passive";
  } else {
    const paid = resolveCommitmentOptions(subType, system).filter((o) => o.cost > 0);
    mode = paid.some((o) => o.length === "active") ? "active" : "none";
  }

  // Cyberware / custom: `installed` gates transfer effects regardless of the
  // shared-pool-derived mode above. Subtypes with no `installed` concept
  // (art/spell/ability/psychic/mutation/gift) are unaffected.
  if (usesInstalledField(subType)) {
    if (!system.installed) return "none";
    // Layered on top of `installed`: cyberware/custom that opted into a
    // poolless active/inactive toggle (a zero-cost "active"-length
    // commitment option) additionally require `isActive`. Cyberware that
    // did NOT opt in (the default) keeps the base `mode` above (normally
    // "passive" for cyberware's zero-cost/no-shared-pool default) -- i.e.
    // installed alone is enough, matching most cyberware's "always-on while
    // installed" book text.
    if (hasFreeActiveToggle(subType, system)) return system.isActive ? "active" : "none";
    return mode;
  }

  return mode;
}

/**
 * Toggle item-embedded effect disabled state for passive/active transfer track.
 * @param {Item} power
 */
export async function syncPowerTransferEffects(power) {
  if (power.type !== "power" || !power.effects.size) return;
  const mode = getPowerTransferMode(power);
  for (const effect of power.effects) {
    let disabled;
    if (mode === "passive") disabled = false;
    else if (mode === "active") disabled = !power.system.isActive;
    else disabled = true;
    if (effect.disabled !== disabled) await effect.update({ disabled });
  }
}

/**
 * @param {Item} item
 * @param {{ durationScope: "scene"|"day" }} options
 * @returns {object[]}
 */
export function buildAppliedPowerEffects(item, { durationScope }) {
  const results = [];
  for (const effect of item.effects) {
    results.push({
      name: effect.name,
      img: effect.img,
      origin: item.uuid,
      transfer: false,
      disabled: false,
      duration: {},
      flags: {
        [FLAG]: {
          powerEffect: true,
          durationScope,
          sourceItemId: item.id,
          sourceEffectId: effect.id,
        },
      },
      system: foundry.utils.deepClone(effect.system),
      statuses: foundry.utils.deepClone([...effect.statuses]),
    });
  }
  return results;
}

/**
 * @param {Actor} actor
 * @param {Item} item
 * @param {{ durationScope: "scene"|"day" }} options
 * @returns {Promise<{ applied: number, skipped: number }>}
 */
export async function applyPowerEffectsToActor(actor, item, { durationScope }) {
  const toCreate = [];
  let skipped = 0;
  for (const data of buildAppliedPowerEffects(item, { durationScope })) {
    const sourceEffectId = data.flags[FLAG].sourceEffectId;
    const existing = actor.effects.find(
      (e) =>
        !e.disabled
        && e.origin === item.uuid
        && e.getFlag(FLAG, "durationScope") === durationScope
        && e.getFlag(FLAG, "sourceEffectId") === sourceEffectId
    );
    if (existing) {
      skipped++;
      continue;
    }
    toCreate.push(data);
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("ActiveEffect", toCreate);
  return { applied: toCreate.length, skipped };
}

/**
 * Clone-path entry for scene/day self application.
 * @param {Item} power
 * @param {Actor} actor
 * @param {{ durationScope: "scene"|"day" }} options
 */
export async function applySceneDayPowerEffects(power, actor, { durationScope }) {
  return applyPowerEffectsToActor(actor, power, { durationScope });
}

/**
 * @param {Actor} actor
 * @param {"scene"|"day"} scope
 */
export async function expireScopedPowerEffects(actor, scope) {
  const sourceEffectIds = new Set((actor._source?.effects ?? []).map((e) => e._id));
  const ids = actor.effects
    .filter(
      (e) =>
        sourceEffectIds.has(e.id)
        && e.getFlag(FLAG, "powerEffect")
        && e.getFlag(FLAG, "durationScope") === scope
    )
    .map((e) => e.id);
  await safeDeleteActorActiveEffects(actor, ids);
}
