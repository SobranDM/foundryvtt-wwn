/**
 * Pure helpers for starship combat roll-vs-DC / Flak / Cloud resolution.
 * No Foundry imports.
 */

/** Fixed DCs for common department actions (SWN / existing i18n prompts). */
export const STARSHIP_ACTION_DC = Object.freeze({
  aboveAndBeyond: 9,
  dealWithCrisis: 8,
  evasiveManeuvers: 9,
  sensorGhost: 9,
  boostEngines: 8,
  emergencyRepairs: 8,
  hulkSave: 10,
});

/**
 * Extract a numeric total from a chat message-like object or rolls array.
 * @param {{ rolls?: Array<{ total?: number }> }|Array<{ total?: number }>|null|undefined} messageOrRolls
 * @param {number} [index=0]
 * @returns {number|null}
 */
export function extractChatRollTotal(messageOrRolls, index = 0) {
  if (messageOrRolls == null) return null;
  let rolls = Array.isArray(messageOrRolls) ? messageOrRolls : messageOrRolls.rolls;
  if (rolls && typeof rolls === "object" && !Array.isArray(rolls) && typeof rolls.toObject === "function") {
    rolls = Object.values(rolls.toObject());
  }
  if (!Array.isArray(rolls) || !rolls.length) return null;
  const roll = rolls[index];
  const total = roll?.total;
  return Number.isFinite(Number(total)) ? Number(total) : null;
}

/**
 * Skill / station check vs a fixed difficulty (meet or beat).
 * @param {number|null|undefined} total
 * @param {number} dc
 * @returns {boolean}
 */
export function stationCheckSucceeded(total, dc) {
  if (total == null || !Number.isFinite(Number(total))) return false;
  if (!Number.isFinite(Number(dc))) return false;
  return Number(total) >= Number(dc);
}

/**
 * Opposed check: attacker wins on meet-or-beat defender total.
 * @param {number|null|undefined} attackerTotal
 * @param {number|null|undefined} defenderTotal
 * @returns {boolean}
 */
export function opposedCheckSucceeded(attackerTotal, defenderTotal) {
  if (attackerTotal == null || defenderTotal == null) return false;
  if (!Number.isFinite(Number(attackerTotal)) || !Number.isFinite(Number(defenderTotal))) {
    return false;
  }
  return Number(attackerTotal) >= Number(defenderTotal);
}

/**
 * Flak vs fighters: keep the shot with the higher attack total (paired damage).
 * @param {{ attack: number, damage: number }} first
 * @param {{ attack: number, damage: number }} second
 * @returns {{ attack: number, damage: number, usedSecond: boolean }}
 */
export function pickFlakShot(first, second) {
  const a1 = Number(first?.attack) || 0;
  const d1 = Number(first?.damage) || 0;
  const a2 = Number(second?.attack) || 0;
  const d2 = Number(second?.damage) || 0;
  if (a2 > a1) return { attack: a2, damage: d2, usedSecond: true };
  return { attack: a1, damage: d1, usedSecond: false };
}

/**
 * Cloud weapon targets: combatant ids that attacked this ship last round and are fighters.
 * @param {string[]} attackedByLastRound
 * @param {Array<{ id?: string, actor?: { system?: { hullClass?: string } } }>} combatants
 * @returns {string[]}
 */
export function cloudDefenderIds(attackedByLastRound = [], combatants = []) {
  const wanted = new Set(attackedByLastRound ?? []);
  if (!wanted.size) return [];
  return (combatants ?? [])
    .filter((c) => wanted.has(c.id) && c.actor?.system?.hullClass === "fighter")
    .map((c) => c.id)
    .filter(Boolean);
}
