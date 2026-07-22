/**
 * Spells Prepared / Cast progression from classEdge grants.
 * Dual Partial spellcaster table from WWN SRD §4.3.
 */

/** Spells Cast by character level (1–10) for dual Partial Mage traditions. */
export const DUAL_PARTIAL_CAST = [1, 1, 2, 2, 2, 3, 3, 4, 4, 5];

/** Spells Prepared by character level (1–10) for dual Partial Mage traditions. */
export const DUAL_PARTIAL_PREPARED = [3, 4, 5, 6, 8, 9, 10, 12, 13, 15];

/**
 * @param {object} edge  classEdge-like { system }
 * @returns {boolean}
 */
export function isSpellcastingClassEdge(edge) {
  const prep = edge?.system?.preparedGrant?.progression;
  if (Array.isArray(prep) && prep.length > 0) return true;
  const slot = edge?.system?.slotGrant;
  if (slot?.enabled) return true;
  if (!slot?.enabled && Array.isArray(slot?.progression) && slot.progression.length > 0) {
    return true;
  }
  return false;
}

/**
 * @param {Array<{ system?: object }>} edges
 * @returns {boolean}
 */
export function hasDualPartialSpellcasters(edges) {
  const list = Array.isArray(edges) ? edges : [];
  const casting = list.filter(isSpellcastingClassEdge);
  const partials = casting.filter((e) => {
    const name = String(e?.name ?? "").trim().toLowerCase();
    if (name.includes("invoker")) return false; // Invoker cannot dual-tradition cast
    return !name.startsWith("full ");
  });
  return partials.length >= 2;
}

/**
 * Value at character level from a 1-indexed progression array.
 * @param {number[]} progression
 * @param {number} level
 * @returns {number}
 */
export function progressionAtLevel(progression, level) {
  const table = Array.isArray(progression) ? progression : [];
  if (!table.length) return 0;
  const lvl = Math.max(Number(level) || 1, 1);
  const idx = Math.min(lvl, table.length) - 1;
  return Number(table[idx]) || 0;
}

/**
 * @param {Array<{ name?: string, system?: object }>} edges
 * @param {number} level
 * @param {number} [intMod=0]  added for Invoker prepared totals
 * @returns {number|null}
 */
export function derivePreparedMax(edges, level, intMod = 0) {
  const list = Array.isArray(edges) ? edges : [];
  const withPrep = list.filter(
    (e) => Array.isArray(e?.system?.preparedGrant?.progression)
      && e.system.preparedGrant.progression.length > 0
  );
  if (!withPrep.length) return null;

  if (hasDualPartialSpellcasters(list)) {
    return progressionAtLevel(DUAL_PARTIAL_PREPARED, level);
  }

  let best = 0;
  let invokerBonus = 0;
  for (const e of withPrep) {
    best = Math.max(best, progressionAtLevel(e.system.preparedGrant.progression, level));
    if (String(e?.name ?? "").toLowerCase().includes("invoker")) {
      invokerBonus = Math.max(invokerBonus, Number(intMod) || 0);
    }
  }
  return best + invokerBonus;
}

/**
 * Cast progression array to use for Spell Slots (unleveled).
 * @param {Array<{ name?: string, system?: object }>} edges
 * @returns {number[]|null}
 */
export function resolveCastProgression(edges) {
  const list = Array.isArray(edges) ? edges : [];
  if (hasDualPartialSpellcasters(list)) {
    return [...DUAL_PARTIAL_CAST];
  }

  const unleveled = list.filter(
    (e) => !e?.system?.slotGrant?.enabled
      && Array.isArray(e?.system?.slotGrant?.progression)
      && e.system.slotGrant.progression.length > 0
  );
  if (!unleveled.length) return null;

  // Prefer Full over Partial when both somehow present; else first with longest table / max at L10.
  let best = unleveled[0];
  let bestScore = progressionAtLevel(best.system.slotGrant.progression, 10);
  for (let i = 1; i < unleveled.length; i++) {
    const e = unleveled[i];
    const name = String(e?.name ?? "").toLowerCase();
    const score = progressionAtLevel(e.system.slotGrant.progression, 10);
    if (name.startsWith("full ") || score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return [...(best.system.slotGrant.progression ?? [])];
}
