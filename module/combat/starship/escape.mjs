/**
 * Escape rating helpers (per opposing combatant).
 */

import { normalizeStarshipCombatState } from "./state.mjs";

export const ESCAPE_THRESHOLD = 3;

/**
 * Escape points that `opponentId` has accumulated against this ship (fleeing).
 * @param {object} state
 * @param {string} opponentId
 */
export function getEscape(state, opponentId) {
  const s = normalizeStarshipCombatState(state);
  return Number(s.escape[opponentId]) || 0;
}

/**
 * After a successful Escape Combat vs the field: each enemy gains +1 Escape on you.
 * @param {object} state
 * @param {string[]} opponentIds
 * @returns {{ state: object, newlyEscapedFrom: string[] }}
 */
export function applyEscapeCombatSuccess(state, opponentIds) {
  const s = normalizeStarshipCombatState(state);
  const escape = { ...s.escape };
  const newlyEscapedFrom = [];
  for (const id of opponentIds) {
    if (!id) continue;
    escape[id] = (Number(escape[id]) || 0) + 1;
    if (escape[id] >= ESCAPE_THRESHOLD) newlyEscapedFrom.push(id);
  }
  return { state: { ...s, escape }, newlyEscapedFrom };
}

/**
 * Pursue Target: remove 1 Escape that `targetId` has on the pursuer (this ship).
 * Escape is stored on the fleeing ship's state — so we update the *target's* state.
 * @param {object} fleeingState state of the ship that holds Escape vs pursuer
 * @param {string} pursuerCombatantId
 */
export function applyPursueSuccess(fleeingState, pursuerCombatantId) {
  const s = normalizeStarshipCombatState(fleeingState);
  const escape = { ...s.escape };
  const cur = Number(escape[pursuerCombatantId]) || 0;
  if (cur <= 0) return { state: s, changed: false };
  escape[pursuerCombatantId] = cur - 1;
  if (escape[pursuerCombatantId] <= 0) delete escape[pursuerCombatantId];
  return { state: { ...s, escape }, changed: true };
}

/**
 * True if this ship has reached Escape threshold vs every given opponent.
 * @param {object} state
 * @param {string[]} opponentIds
 */
export function hasEscapedAll(state, opponentIds) {
  if (!opponentIds.length) return false;
  return opponentIds.every((id) => getEscape(state, id) >= ESCAPE_THRESHOLD);
}
