/**
 * Focus resource grants — custom derivation (deliberately NOT Active Effects).
 * Applies Focus resourceGrant bonuses to derived pool maxes.
 */

/**
 * @param {Actor} actor
 * @param {Array<object>} pools  Derived pool array (mutated)
 */
export function applyFocusResourceGrants(actor, pools) {
  for (const focus of actor.items.filter((i) => i.type === "focus")) {
    const grant = focus.system.resourceGrant;
    if (!grant?.targetName?.trim() || !(grant.bonusMax > 0)) continue;
    const matches = pools.filter((p) => p.name === grant.targetName);
    for (const pool of matches) {
      pool.max += grant.bonusMax;
      if (pool.warning === "WWN.Pools.WarnNoClassEdge") pool.warning = null;
    }
  }
}
