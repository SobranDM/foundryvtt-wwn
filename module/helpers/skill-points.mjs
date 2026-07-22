/** WWN default skill points gained per character level. */
export const DEFAULT_SKILL_POINTS_PER_LEVEL = 3;

/** Bonus skill points banked on a skill when the house-rule setting is on. */
export const BONUS_SKILL_POINTS_AT_FIRST_LEVEL = 3;

/**
 * Skill points granted per level-up from Class/Edge items.
 * Uses the highest `skillPointsPerLevel` among the actor's classEdge items,
 * or {@link DEFAULT_SKILL_POINTS_PER_LEVEL} when none are present.
 * @param {Actor} actor
 * @returns {number}
 */
export function getSkillPointsPerLevel(actor) {
  const values = actor.items
    .filter((i) => i.type === "classEdge")
    .map((i) => Number(i.system.skillPointsPerLevel))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (!values.length) return DEFAULT_SKILL_POINTS_PER_LEVEL;
  return Math.max(...values);
}

/**
 * @param {Actor} actor
 * @param {number} oldLevel
 * @param {number} newLevel
 * @returns {{ gained: number, perLevel: number }}
 */
export function computeLevelUpSkillGrant(actor, oldLevel, newLevel) {
  const from = Math.max(Number(oldLevel) || 1, 1);
  const to = Math.max(Number(newLevel) || 1, 1);
  if (to <= from) return { gained: 0, perLevel: getSkillPointsPerLevel(actor) };
  const perLevel = getSkillPointsPerLevel(actor);
  return { gained: (to - from) * perLevel, perLevel };
}

/**
 * Cost to buy the next skill level, applying invested points first.
 * @param {Item} skill
 * @param {Actor} [actor]
 * @returns {{ baseCost: number, fromInvested: number, fromUnspent: number }}
 */
export function computeSkillPurchaseCost(skill, actor) {
  const level = skill.system.ownedLevel ?? -1;
  const flatCost = game.settings.get("wwn", "flatSkillCost");
  const baseCost = flatCost ? 1 : level + 2;
  const invested = skill.system.pointsInvested ?? 0;
  const fromInvested = Math.min(invested, baseCost);
  const fromUnspent = baseCost - fromInvested;
  return { baseCost, fromInvested, fromUnspent };
}
