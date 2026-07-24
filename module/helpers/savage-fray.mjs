/**
 * Pure helpers for Savage Fray combatant flag tracking.
 */

/**
 * @param {{ attackerId?: string, round?: number }|null|undefined} stored
 * @param {string} attackerId
 * @param {number} round
 * @returns {boolean} true if this melee attack should auto-miss
 */
export function shouldMissAfterFirstMeleeHit(stored, attackerId, round) {
  if (!stored?.attackerId) return false;
  if (Number(stored.round) !== Number(round)) return false;
  return stored.attackerId !== attackerId;
}

/**
 * @param {string[]} attackedIds
 * @param {string} targetId
 * @returns {string[]}
 */
export function appendAttackedThisTurn(attackedIds, targetId) {
  const list = Array.isArray(attackedIds) ? [...attackedIds] : [];
  if (targetId && !list.includes(targetId)) list.push(targetId);
  return list;
}

/**
 * Filter adjacent foes who were not attacked this turn.
 * @param {Array<{ id: string }>} adjacentFoes
 * @param {string[]} attackedThisTurn
 */
export function adjacentShockTargets(adjacentFoes, attackedThisTurn = []) {
  const attacked = new Set(attackedThisTurn ?? []);
  return (adjacentFoes ?? []).filter((f) => f?.id && !attacked.has(f.id));
}
