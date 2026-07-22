import { isPc } from "../helpers/actor-types.mjs";
/**
 * Derive PC attack bonus from Class/Edge progressions at character level.
 */

/**
 * @param {Actor} actor
 */
export function deriveAttackBonus(actor) {
  if (!isPc(actor)) return;

  const system = actor.system;
  const level = Math.max(system.details?.level ?? 1, 1);
  const progressions = CONFIG.WWN.attackProgressions;

  const modes = actor.items
    .filter((i) => i.type === "classEdge" && i.system.attackProgression !== "none")
    .map((i) => i.system.attackProgression);

  const effectiveModes = modes.length ? modes : ["expert"];

  const base = Math.max(
    ...effectiveModes.map((m) => progressions[m]?.compute(level) ?? 0)
  );
  const mod = system.combat.abMod ?? 0;

  system.combat.abBase = base;
  system.combat.ab = base + mod;
}

/**
 * Residual modifier when migrating persisted combat.ab to abMod.
 * @param {number} oldAb
 * @param {number} level
 * @param {{ warrior?: boolean }} [options]
 */
export function computeAbModResidual(oldAb, level, { warrior = false } = {}) {
  const progressions = CONFIG.WWN?.attackProgressions;
  const key = warrior ? "warrior" : "expert";
  const base = progressions?.[key]?.compute(Math.max(level, 1)) ?? Math.floor(level / 2);
  return (Number(oldAb) || 0) - base;
}
