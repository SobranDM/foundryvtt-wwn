/**
 * Force a fresh derived-data pass on an actor after something changes its
 * applicable Active Effects (an item with a transfer effect is granted,
 * removed, or one of its effects is toggled/updated).
 *
 * `Actor#prepareData()` does not reliably re-run `prepareDerivedData()` in
 * these cases — cross-field "final phase" targets this system computes by
 * hand (e.g. `system.combat.innateAc.min` read by `deriveAC()`) can be left
 * stale (still reflecting the pre-change value) even after the effect change
 * has fully round-tripped and `system.combat.innateAc.min` itself reads
 * correctly. Calling the data model's `prepareDerivedData()` directly (not
 * `actor.prepareData()`) reliably fixes this, confirmed via manual testing:
 * granting Cold Flesh/Impervious Defense (both `innateAc.min` sources) left
 * `system.combat.ac.melee.value` stuck at its pre-grant value through a full
 * page reload, but calling `actor.system.prepareDerivedData()` immediately
 * recomputed it correctly with the same (already-applied) effect data.
 * @param {Actor|null|undefined} actor
 */
export function refreshActorDerivedData(actor) {
  if (!actor || actor.documentName !== "Actor") return;
  actor.system?.prepareDerivedData?.();
  actor.sheet?.render(false);
}
