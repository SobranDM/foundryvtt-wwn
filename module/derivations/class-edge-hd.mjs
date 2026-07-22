/**
 * Hit-die grants from owned classEdge items.
 * Pure helpers are safe for Node unit tests.
 */

const DIE_RANK = { d4: 1, d6: 2, d8: 3, d10: 4, d12: 5, d20: 6 };

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isPartialWarriorName(name) {
  return String(name ?? "").trim().toLowerCase() === "partial warrior";
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isDuelistName(name) {
  return String(name ?? "").trim().toLowerCase() === "duelist";
}

/**
 * Combine hdGrant from classEdge-like items ({ name, system }).
 * @param {Array<{ name?: string, system?: object }>} edges
 * @returns {{ die: string, perLevelMod: number }|null} null if no grants
 */
export function combineHdGrants(edges) {
  const list = Array.isArray(edges) ? edges : [];
  const grants = [];
  let hasPartialWarrior = false;
  let hasDuelist = false;

  for (const edge of list) {
    if (isPartialWarriorName(edge?.name)) hasPartialWarrior = true;
    if (isDuelistName(edge?.name)) hasDuelist = true;
    const g = edge?.system?.hdGrant;
    const die = String(g?.die ?? "").trim();
    if (!die || !(die in DIE_RANK)) continue;
    grants.push({
      die,
      perLevelMod: Number(g.perLevelMod) || 0,
    });
  }

  if (!grants.length) return null;

  // SRD: Partial Warrior + Duelist use 1d6 (no +2).
  if (hasPartialWarrior && hasDuelist) {
    return { die: "d6", perLevelMod: 0 };
  }

  let best = grants[0];
  for (let i = 1; i < grants.length; i++) {
    const g = grants[i];
    const dieBetter = DIE_RANK[g.die] > DIE_RANK[best.die];
    const dieEqual = DIE_RANK[g.die] === DIE_RANK[best.die];
    if (dieBetter || (dieEqual && g.perLevelMod > best.perLevelMod)) {
      best = g;
    }
  }
  return { die: best.die, perLevelMod: best.perLevelMod };
}
