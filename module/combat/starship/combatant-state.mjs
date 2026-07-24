/**
 * Foundry-facing read/write for combatant `flags.wwn.starshipCombat`.
 */
import {
  defaultStarshipCombatState,
  normalizeStarshipCombatState,
  isPcCrewMode,
} from "./state.mjs";

const FLAG_SCOPE = "wwn";
const FLAG_KEY = "starshipCombat";

/**
 * @param {Combatant} combatant
 * @returns {object}
 */
export function getStarshipCombatState(combatant) {
  const raw = combatant?.getFlag?.(FLAG_SCOPE, FLAG_KEY);
  return normalizeStarshipCombatState(raw);
}

/**
 * @param {Combatant} combatant
 * @param {object} state
 */
export async function setStarshipCombatState(combatant, state) {
  return combatant.setFlag(FLAG_SCOPE, FLAG_KEY, normalizeStarshipCombatState(state));
}

/**
 * @param {Combatant} combatant
 * @param {(state: object) => object} updater
 */
export async function updateStarshipCombatState(combatant, updater) {
  const next = updater(getStarshipCombatState(combatant));
  await setStarshipCombatState(combatant, next);
  return normalizeStarshipCombatState(next);
}

/**
 * Ensure flag exists with defaults.
 * @param {Combatant} combatant
 */
export async function ensureStarshipCombatState(combatant) {
  const raw = combatant?.getFlag?.(FLAG_SCOPE, FLAG_KEY);
  if (raw) return normalizeStarshipCombatState(raw);
  const fresh = defaultStarshipCombatState();
  await setStarshipCombatState(combatant, fresh);
  return fresh;
}

/**
 * @param {Combatant} combatant
 */
export async function clearStarshipCombatState(combatant) {
  return combatant.unsetFlag(FLAG_SCOPE, FLAG_KEY);
}

/**
 * @param {Actor} starship
 */
export function shipIsPcCrew(starship) {
  return isPcCrewMode(starship?.system);
}

export { FLAG_SCOPE, FLAG_KEY };
