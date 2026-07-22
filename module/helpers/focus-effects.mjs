const FLAG = "wwn";

/**
 * @param {ActiveEffect} effect
 * @returns {number|null} Minimum focus ownedLevel required, or null if the effect applies at all levels.
 */
export function getFocusEffectLevel(effect) {
  const level = effect.getFlag(FLAG, "focusLevel");
  return Number.isFinite(level) ? level : null;
}

/**
 * Enable transferred focus effects when ownedLevel meets the effect's focusLevel (minimum).
 * SRD L2 benefits are usually "in addition" to L1, so L1 effects stay active at ownedLevel 2.
 * Effects without focusLevel remain always enabled (unless skipFocusLevelSync).
 * @param {Item} focus
 */
export async function syncFocusTransferEffects(focus) {
  if (focus.type !== "focus" || !focus.effects.size) return;
  const ownedLevel = focus.system.ownedLevel ?? 1;
  for (const effect of focus.effects) {
    if (!effect.transfer) continue;
    if (effect.getFlag(FLAG, "skipFocusLevelSync")) continue;
    const required = getFocusEffectLevel(effect);
    const disabled = required !== null && ownedLevel < required;
    if (effect.disabled === disabled) continue;
    try {
      await effect.update({ disabled });
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (/does not exist/i.test(msg)) {
        console.warn(`WWN | Focus effect ${effect.id} missing during sync; skipping.`);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Sync all focus items on an actor (e.g. on world ready after migration).
 * @param {Actor} actor
 */
export async function syncActorFocusEffects(actor) {
  for (const item of actor.items.filter((i) => i.type === "focus")) {
    await syncFocusTransferEffects(item);
  }
}
