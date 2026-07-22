import {
  usesSharedPool,
  resolveCommitmentOptions,
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
  if (!usesSharedPool(subType, system)) return "passive";
  const paid = resolveCommitmentOptions(subType, system).filter((o) => o.cost > 0);
  if (paid.some((o) => o.length === "active")) return "active";
  return "none";
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
