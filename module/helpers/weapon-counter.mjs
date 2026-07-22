import { isNpc } from "./actor-types.mjs";
/** NPC weapon attack counters (attacks spent / max per round). */

export function tracksWeaponCounter(actor) {
  return isNpc(actor);
}

/** Decrement spent attacks when an NPC rolls a weapon (WWN allows negative values). */
export async function spendWeaponCounter(weapon) {
  const actor = weapon.actor;
  if (!tracksWeaponCounter(actor)) return;
  const value = weapon.system.counter?.value ?? 0;
  await weapon.update({ "system.counter.value": value - 1 });
}

/** Reset all weapon counters on an NPC to their maximum. */
export async function resetWeaponCounters(actor) {
  if (!tracksWeaponCounter(actor)) return;
  const updates = actor.items
    .filter((i) => i.type === "weapon")
    .map((w) => ({
      _id: w.id,
      "system.counter.value": w.system.counter?.max ?? 1,
    }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

/** Restore weapon counters for NPC combatants at end of round. */
export async function resetCombatNpcWeaponCounters(combat) {
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!tracksWeaponCounter(actor)) continue;
    await resetWeaponCounters(actor);
  }
}
