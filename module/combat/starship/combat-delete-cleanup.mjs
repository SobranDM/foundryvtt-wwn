/**
 * Cleanup policy when a Combat document is deleted.
 *
 * Foundry removes the Combat from the collection before calling `_onDelete`, and
 * does not await async `_onDelete` handlers. Updating embedded combatants there
 * fails with "Combat … does not exist in combats" and can skip `super._onDelete`,
 * leaving a zombie viewed combat in the tracker.
 */

/**
 * Never clear combatant `flags.wwn.starshipCombat` during/after Combat delete.
 * Those flags live on embedded combatants that are deleted with the parent.
 */
export const CLEAR_COMBATANT_STATE_ON_COMBAT_DELETE = false;

/**
 * Starship actors that still need actor-scoped cleanup (e.g. combat bonus HP).
 * @param {Iterable<{ actor?: { type?: string }|null }|null|undefined>|null|undefined} combatants
 * @returns {object[]}
 */
export function starshipActorsToClearOnCombatDelete(combatants) {
  const seen = new Set();
  const actors = [];
  for (const c of combatants ?? []) {
    const actor = c?.actor;
    if (!actor || actor.type !== "starship") continue;
    if (seen.has(actor)) continue;
    seen.add(actor);
    actors.push(actor);
  }
  return actors;
}
