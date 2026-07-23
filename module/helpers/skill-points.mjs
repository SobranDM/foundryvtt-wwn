/** WWN default skill points gained per character level. */
export const DEFAULT_SKILL_POINTS_PER_LEVEL = 3;

/** Skill points applied when a focus bonus skill uses the points path. */
export const FOCUS_BONUS_SKILL_POINTS = 3;

/** @deprecated Use {@link FOCUS_BONUS_SKILL_POINTS}. */
export const BONUS_SKILL_POINTS_AT_FIRST_LEVEL = FOCUS_BONUS_SKILL_POINTS;

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
 * Cost to raise a skill from `ownedLevel` to the next rank.
 * @param {number} ownedLevel
 * @param {{ flatCost?: boolean }} [options]
 * @returns {number}
 */
export function nextSkillLevelCost(ownedLevel, { flatCost = false } = {}) {
  const level = Number.isFinite(Number(ownedLevel)) ? Number(ownedLevel) : -1;
  return flatCost ? 1 : level + 2;
}

/**
 * Apply skill points with automatic rank-ups while cost is covered.
 * @param {number} ownedLevel
 * @param {number} pointsInvested
 * @param {number} points
 * @param {{ flatCost?: boolean }} [options]
 * @returns {{ ownedLevel: number, pointsInvested: number, levelsGained: number }}
 */
export function applySkillPoints(ownedLevel, pointsInvested, points, options = {}) {
  let flatCost = options.flatCost;
  if (flatCost === undefined) {
    flatCost = globalThis.game?.settings?.get?.("wwn", "flatSkillCost") === true;
  }

  let level = Number.isFinite(Number(ownedLevel)) ? Number(ownedLevel) : -1;
  let invested = Math.max((Number(pointsInvested) || 0) + (Number(points) || 0), 0);
  let levelsGained = 0;

  while (true) {
    const cost = nextSkillLevelCost(level, { flatCost });
    if (invested < cost) break;
    invested -= cost;
    level += 1;
    levelsGained += 1;
  }

  return { ownedLevel: level, pointsInvested: invested, levelsGained };
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
  const baseCost = nextSkillLevelCost(level, { flatCost: !!flatCost });
  const invested = skill.system.pointsInvested ?? 0;
  const fromInvested = Math.min(invested, baseCost);
  const fromUnspent = baseCost - fromInvested;
  return { baseCost, fromInvested, fromUnspent };
}
