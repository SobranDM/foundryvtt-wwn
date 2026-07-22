import { isNpc } from "../helpers/actor-types.mjs";
/**
 * Armor Class derivation (ascending only, melee/ranged split).
 *
 * Reads post-"initial"-phase AE values: combat.ac.base, combat.ac.mod,
 * combat.ac.melee.mod, combat.ac.ranged.mod, trauma.base/targetMod.
 *
 * NPCs without equipped armor use persisted combat.acManual; equipped armor
 * uses the same item-based derivation as PCs.
 */

/** @param {Actor} actor */
export function npcHasEquippedArmor(actor) {
  return actor.items.some((i) => i.type === "armor" && i.system.equipped);
}

/** @param {Actor} actor */
export function actorHasBodyArmor(actor) {
  return actor.items.some(
    (i) => i.type === "armor" && i.system.equipped && i.system.type !== "shield"
  );
}

/**
 * @param {Actor} actor
 */
export function deriveAC(actor) {
  const system = actor.system;
  const ac = system.combat.ac;
  const separateRanged = game.settings.get("wwn", "separateRangedAC");
  const useTrauma = game.settings.get("wwn", "useTrauma");
  const dexMod = system.abilities?.dex?.mod ?? 0;

  if (isNpc(actor) && !npcHasEquippedArmor(actor)) {
    const manual = system.combat.acManual ?? { melee: 10, ranged: 10 };
    ac.melee.value = (manual.melee ?? 10) + ac.mod + (ac.melee?.mod ?? 0);
    ac.ranged.value = separateRanged
      ? (manual.ranged ?? manual.melee ?? 10) + ac.mod + (ac.ranged?.mod ?? 0)
      : ac.melee.value;
    system.combat.soak = 0;
    deriveTraumaTarget(actor, useTrauma);
    return;
  }

  let baseMelee = ac.base;
  let baseRanged = ac.base;
  let shieldBonus = 0;
  let shieldBase = 0;
  let sneakPenalty = 0;
  let exertPenalty = 0;
  let soak = 0;

  const armors = actor.items.filter((i) => i.type === "armor" && i.system.equipped);
  for (const a of armors) {
    const acBase = a.system.acValue ?? a.system.ac ?? 0;
    const acRangedBase = a.system.acRangedValue ?? a.system.acRanged ?? acBase;
    const modBonus = a.system.modValue ?? a.system.mod ?? 0;

    soak += a.system.soakValue ?? a.system.soak ?? 0;

    const isShield = a.system.type === "shield";
    if (isShield) {
      shieldBonus = 1 + modBonus;
      shieldBase = acBase + modBonus;
      continue;
    }

    baseMelee = Math.max(baseMelee, acBase + modBonus);
    const rangedBase = separateRanged && (a.system.acRanged ?? a.system.ac) ? acRangedBase : acBase;
    baseRanged = Math.max(baseRanged, rangedBase + modBonus);

    if (game.settings.get("wwn", "useFlatArmorPenalty")) {
      if (a.system.ashesHeavy) {
        sneakPenalty = Math.max(sneakPenalty, 1);
        exertPenalty = Math.max(exertPenalty, 1);
      }
    } else {
      const weight = a.system.weight ?? 0;
      if (["medium", "heavy"].includes(a.system.type)) sneakPenalty = Math.max(sneakPenalty, weight);
      if (a.system.type === "heavy") exertPenalty = Math.max(exertPenalty, weight);
    }
  }

  const assemble = (base, modePath) => {
    const withArmor = base + dexMod + ac.mod + (modePath?.mod ?? 0);
    if (shieldBonus > 0) {
      const shieldOnly = shieldBase + dexMod + ac.mod + (modePath?.mod ?? 0);
      return Math.max(shieldOnly, withArmor + shieldBonus);
    }
    return withArmor;
  };

  ac.melee.value = assemble(baseMelee, ac.melee);
  ac.ranged.value = separateRanged ? assemble(baseRanged, ac.ranged) : ac.melee.value;

  // Impervious Defense: innate AC floor when unarmored (does not stack with body armor)
  if (!actorHasBodyArmor(actor)) {
    const innateMin = system.combat.innateAc?.min ?? 0;
    if (innateMin > 0) {
      const innateAssemble = (modePath) => {
        const withInnate = innateMin + dexMod + ac.mod + (modePath?.mod ?? 0);
        if (shieldBonus > 0) {
          const shieldOnly = shieldBase + dexMod + ac.mod + (modePath?.mod ?? 0);
          return Math.max(shieldOnly, withInnate + shieldBonus);
        }
        return withInnate;
      };
      ac.melee.value = Math.max(ac.melee.value, innateAssemble(ac.melee));
      if (separateRanged) {
        ac.ranged.value = Math.max(ac.ranged.value, innateAssemble(ac.ranged));
      }
    }
  }

  if (system.skills) {
    system.skills.sneakPenalty = sneakPenalty;
    system.skills.exertPenalty = exertPenalty;
  }

  system.combat.soak = soak;
  deriveTraumaTarget(actor, useTrauma);
}

/**
 * Trauma target: base from equipped body armor (or 6), then actor AE targetMod.
 * @param {Actor} actor
 * @param {boolean} useTrauma
 */
export function deriveTraumaTarget(actor, useTrauma = game.settings.get("wwn", "useTrauma")) {
  const trauma = actor.system.trauma;
  if (!trauma) return;

  let base = 6;
  if (useTrauma) {
    let armorBase = null;
    for (const a of actor.items) {
      if (a.type !== "armor" || !a.system.equipped || a.system.type === "shield") continue;
      const value = Number(a.system.traumaTargetValue ?? a.system.traumaTarget);
      if (!Number.isFinite(value)) continue;
      armorBase = armorBase === null ? value : Math.max(armorBase, value);
    }
    if (armorBase !== null) base = armorBase;
  }

  trauma.base = base;
  trauma.value = base + (trauma.targetMod ?? 0);
}
