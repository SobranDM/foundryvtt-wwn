/**
 * Pure hit/damage math for a ship weapon shot (no document updates / chat).
 */
import { parseWeaponQualities, qualityAttackModifier } from "./qualities.mjs";
import { resolveStarshipDamage } from "./armor.mjs";
import { armorWithCrises, weaponsLockedOut } from "./crises.mjs";
import { getStarshipCombatState } from "./combatant-state.mjs";
import {
  hasHardenedPolyceramic,
  hasPointDefense,
  hasBurstEcm,
} from "./systems.mjs";
import { effectiveStarshipAc } from "./state.mjs";

/**
 * @param {object} opts
 * @param {object} [opts.i18n]  `{ localize, format }` — defaults to `game.i18n` when present
 * @returns {{ hit: boolean, ac: number, attack: number, finalDamage: number, canDisable: boolean, notices: string[], reason?: string }}
 */
export function computeShipWeaponOutcome({
  attacker,
  defender,
  weapon,
  attackTotal,
  damageTotal,
  targetSystems = false,
  i18n = null,
}) {
  const loc = i18n ?? (typeof game !== "undefined" ? game.i18n : null);
  const localize = (k) => (loc?.localize ? loc.localize(k) : k);
  const format = (k, data) => (loc?.format ? loc.format(k, data) : k);

  const target = defender?.actor ?? defender;
  const attackerCombatant = attacker?.actor ? attacker : null;
  const defenderCombatant = defender?.actor ? defender : null;

  if (!target || target.type !== "starship") {
    return {
      hit: false,
      ac: 0,
      attack: attackTotal,
      finalDamage: 0,
      canDisable: false,
      notices: [],
      reason: "notStarship",
    };
  }

  const defState = defenderCombatant
    ? getStarshipCombatState(defenderCombatant)
    : { crises: [], flags: {}, buffs: {} };
  const atkState = attackerCombatant
    ? getStarshipCombatState(attackerCombatant)
    : { crises: [], flags: {}, buffs: {} };

  if (attackerCombatant && weaponsLockedOut(atkState.crises)) {
    return {
      hit: false,
      ac: 0,
      attack: attackTotal,
      finalDamage: 0,
      canDisable: false,
      notices: [],
      reason: "lockedOut",
    };
  }

  const qualities = parseWeaponQualities(weapon.system?.qualities);
  const isAmmoWeapon = qualities.ammo != null
    || (weapon.system?.ammo != null && weapon.system.ammo !== null);
  const pointDefense = isAmmoWeapon && hasPointDefense(target);

  const ac = effectiveStarshipAc(target.system.ac, defState, { pointDefense });
  const ecmBonus = Number(atkState.buffs?.defeatEcm?.[defenderCombatant?.id]) || 0;
  const clumsyMod = qualityAttackModifier(qualities, target.system.hullClass);
  const adjustedAttack = attackTotal + ecmBonus + clumsyMod;
  const hit = adjustedAttack >= ac;

  if (!hit) {
    return {
      hit: false,
      ac,
      attack: adjustedAttack,
      finalDamage: 0,
      canDisable: false,
      notices: [],
    };
  }

  const baseArmor = armorWithCrises(target.system.armor, defState.crises);
  const dmg = resolveStarshipDamage({
    rawDamage: damageTotal,
    armor: baseArmor,
    ap: qualities.ap,
    hardenedPolyceramic: hasHardenedPolyceramic(target),
    targetSystems,
  });

  const notices = [];
  if (hasBurstEcm(target) && !defState.flags?.usedBurstEcmThisFight) {
    notices.push(localize("WWN.Starship.BurstEcmApplyHint"));
  }
  if (defenderCombatant && !defState.flags?.usedHitCrisisThisRound && dmg.finalDamage > 0) {
    notices.push(format("WWN.Starship.CrisisApplyHint", { damage: dmg.finalDamage }));
  }
  if (targetSystems && dmg.canDisable) {
    notices.push(localize("WWN.Starship.TargetSystemsApplyHint"));
  }

  return {
    hit: true,
    ac,
    attack: adjustedAttack,
    finalDamage: dmg.finalDamage,
    canDisable: dmg.canDisable,
    notices,
  };
}
