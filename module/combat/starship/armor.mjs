/**
 * Armor / AP damage resolution for starship combat.
 */

/**
 * @param {object} opts
 * @param {number} opts.rawDamage
 * @param {number} opts.armor
 * @param {number} [opts.ap]
 * @param {boolean} [opts.hardenedPolyceramic] reduce AP by 5
 * @param {boolean} [opts.targetSystems] half damage (round up) before Armor
 * @returns {{ damageBeforeArmor: number, effectiveArmor: number, finalDamage: number, canDisable: boolean }}
 */
export function resolveStarshipDamage({
  rawDamage,
  armor,
  ap = 0,
  hardenedPolyceramic = false,
  targetSystems = false,
} = {}) {
  let damageBeforeArmor = Math.max(0, Math.floor(Number(rawDamage) || 0));
  if (targetSystems) {
    damageBeforeArmor = Math.ceil(damageBeforeArmor / 2);
  }

  let effectiveAp = Math.max(0, Number(ap) || 0);
  if (hardenedPolyceramic) effectiveAp = Math.max(0, effectiveAp - 5);

  const baseArmor = Math.max(0, Number(armor) || 0);
  const effectiveArmor = Math.max(0, baseArmor - effectiveAp);
  const finalDamage = Math.max(0, damageBeforeArmor - effectiveArmor);
  const canDisable = targetSystems && finalDamage > 0;

  return { damageBeforeArmor, effectiveArmor, finalDamage, canDisable };
}

/**
 * Damage Control HP restored by Fix skill × hull class multiplier.
 * @param {number} fixSkill
 * @param {string} hullClass
 */
export function damageControlHp(fixSkill, hullClass) {
  const skill = Math.max(0, Number(fixSkill) || 0);
  const mult = { fighter: 2, frigate: 3, cruiser: 4, capital: 6 }[hullClass] ?? 2;
  return skill * mult;
}

/**
 * Escalating Damage Control difficulty: base 7 + prior attempts this fight.
 * @param {number} attemptsAlready
 */
export function damageControlDifficulty(attemptsAlready = 0) {
  return 7 + Math.max(0, Number(attemptsAlready) || 0);
}
