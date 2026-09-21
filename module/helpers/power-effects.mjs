import {
  usesSharedPool,
  resolveCommitmentOptions,
  usesInstalledField,
  hasFreeActiveToggle,
} from "../config/power-subtypes.mjs";
import { safeDeleteActorActiveEffects } from "./safe-delete-active-effects.mjs";
import { refreshActorDerivedData } from "./actor-refresh.mjs";

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
  if (usesSharedPool(subType, system)) {
    // A power can mix a paid shared-pool tier (e.g. cost:2/length:"scene")
    // with an unrelated free (cost:0) "active"-length toggle tier in the
    // same commitmentOptions array -- checking only the paid entries here
    // would silently drop that free toggle's ability to enable/disable the
    // transfer effect. Any "active"-length entry, paid or free, means this
    // power has a manual toggle; syncPowerTransferEffects gates the actual
    // enabled state on system.isActive for "active" mode either way.
    const hasActiveLength = resolveCommitmentOptions(subType, system).some((o) => o.length === "active");
    mode = hasActiveLength ? "active" : "none";
  } else if (hasFreeActiveToggle(subType, system)) {
    // A free (cost:0) "active"-length commitment option is a real manual
    // toggle, not a plain always-on passive art -- without this, the
    // "passive" branch below would force it permanently enabled on every
    // createItem/updateItem sync (see syncPowerTransferEffects).
    mode = system.isActive ? "active" : "none";
  } else {
    mode = "passive";
  }

  // Cyberware / custom: `installed` gates transfer effects regardless of the
  // mode derived above. Subtypes with no `installed` concept (art/spell/
  // ability/psychic/mutation/gift) are unaffected.
  if (usesInstalledField(subType)) {
    if (!system.installed) return "none";
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
  if (toCreate.length) {
    await actor.createEmbeddedDocuments("ActiveEffect", toCreate);
    // These effects are created directly on the actor (transfer: false), so
    // `effect.parent` is the actor itself, not an item -- the generic
    // createActiveEffect/updateActiveEffect/deleteActiveEffect hooks in
    // wwn.mjs only refresh when `effect.transfer` is true, so they never
    // fire for these. Refresh explicitly here (see actor-refresh.mjs for
    // why a plain document update doesn't reliably do this on its own).
    refreshActorDerivedData(actor);
  }
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
  const deleted = await safeDeleteActorActiveEffects(actor, ids);
  // Same reasoning as applyPowerEffectsToActor above: these are non-transfer
  // effects living directly on the actor, so the generic delete hook never
  // refreshes derived data for them. Do it explicitly.
  if (deleted.length) refreshActorDerivedData(actor);
}
