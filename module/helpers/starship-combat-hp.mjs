/**
 * Star Captain L2: temporary combat bonus HP on starships.
 */
import {
  starshipFocusBonusesFromActor,
  resolveStarshipStationActor,
} from "./starship-focus-bonuses.mjs";

/**
 * Combat bonus HP percent comes from the captain station only.
 * @param {Actor} starship
 * @returns {Promise<number>}
 */
export async function captainCombatBonusHpPercent(starship) {
  const captain = await resolveStarshipStationActor(starship, "captain");
  return starshipFocusBonusesFromActor(captain).combatBonusHpPercent;
}

/**
 * @param {number} hpMax
 * @param {number} percent
 * @returns {number}
 */
export function computeCombatBonusHp(hpMax, percent) {
  const pct = Number(percent) || 0;
  if (pct <= 0) return 0;
  return Math.round((Number(hpMax) || 0) * (pct / 100));
}

/**
 * Seed ephemeral combat bonus HP at combat start.
 * @param {Actor} starship
 */
export async function applyStarshipCombatBonusHp(starship) {
  if (starship?.type !== "starship") return;
  const pct = await captainCombatBonusHpPercent(starship);
  const bonus = computeCombatBonusHp(starship.system.hp?.max, pct);
  if (bonus <= 0) {
    await starship.unsetFlag("wwn", "combatBonusHp");
    return;
  }
  await starship.setFlag("wwn", "combatBonusHp", bonus);
}

/**
 * Clear combat bonus HP when combat ends.
 * @param {Actor} starship
 */
export async function clearStarshipCombatBonusHp(starship) {
  if (starship?.type !== "starship") return;
  await starship.unsetFlag("wwn", "combatBonusHp");
}

/**
 * Remaining combat bonus HP on a starship.
 * @param {Actor} starship
 * @returns {number}
 */
export function remainingCombatBonusHp(starship) {
  return Number(starship?.getFlag?.("wwn", "combatBonusHp")) || 0;
}

/**
 * Apply damage against combat bonus pool first, then hull.
 * Mutates nothing; returns how much hull damage remains and new bonus.
 * @param {number} damage
 * @param {number} bonusHp
 * @returns {{ hullDamage: number, bonusRemaining: number, bonusTaken: number }}
 */
export function applyDamageThroughCombatBonus(damage, bonusHp) {
  const dmg = Math.max(0, Math.floor(Number(damage) || 0));
  const bonus = Math.max(0, Number(bonusHp) || 0);
  if (dmg <= 0) return { hullDamage: dmg, bonusRemaining: bonus, bonusTaken: 0 };
  const bonusTaken = Math.min(bonus, dmg);
  return {
    hullDamage: dmg - bonusTaken,
    bonusRemaining: bonus - bonusTaken,
    bonusTaken,
  };
}
