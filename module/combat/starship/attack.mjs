/**
 * Apply ship weapon hits: armor, defenses, HP, optional Target Systems, Crisis prompt data.
 */
import { parseWeaponQualities, qualityAttackModifier } from "./qualities.mjs";
import { resolveStarshipDamage } from "./armor.mjs";
import { armorWithCrises, weaponsLockedOut } from "./crises.mjs";
import {
  getStarshipCombatState,
  updateStarshipCombatState,
} from "./combatant-state.mjs";
import {
  hasHardenedPolyceramic,
  hasPointDefense,
  hasBurstEcm,
  hasGravEddy,
  disableShipSystem,
  degradeDrive,
  disableTargetCandidates,
} from "./systems.mjs";
import { effectiveStarshipAc } from "./state.mjs";
import { createNoticeMessage } from "../../chat/chat-card.mjs";
import { showWwnDialog, cancelButton, confirmWwnDialog } from "../../applications/wwn-dialog.mjs";

/**
 * Ask which defender system/drive to disable for Target Systems.
 * @param {Actor} defenderActor
 * @returns {Promise<{ disableItem: Item|null, disableDrive: boolean }|null>}
 *   null if the user cancelled entirely.
 */
export async function promptDisableTarget(defenderActor) {
  if (!defenderActor) return null;
  const candidates = disableTargetCandidates(defenderActor);
  const buttons = [
    ...candidates.map((i) => ({
      action: i.id,
      label: i.name,
      callback: () => ({ disableItemId: i.id }),
    })),
    {
      action: "drive",
      label: game.i18n.localize("WWN.Starship.DisableDrive"),
      callback: () => ({ disableDrive: true }),
    },
    {
      action: "skip",
      label: game.i18n.localize("WWN.Starship.SkipDisable"),
      callback: () => ({ skip: true }),
    },
    { ...cancelButton(), default: true },
  ];
  const choice = await showWwnDialog({
    modifier: "pick-disable",
    title: defenderActor.name,
    content: `<p>${game.i18n.localize("WWN.Starship.PickDisableTarget")}</p>`,
    buttons,
  });
  if (!choice || choice === "cancel") return null;
  if (choice.skip) return { disableItem: null, disableDrive: false };
  if (choice.disableDrive) return { disableItem: null, disableDrive: true };
  const item = choice.disableItemId ? defenderActor.items.get(choice.disableItemId) : null;
  return { disableItem: item ?? null, disableDrive: false };
}

/**
 * Find opposing combatant for a starship actor in a combat.
 * @param {Combat} combat
 * @param {Actor} starship
 */
export function combatantForStarship(combat, starship) {
  return combat?.combatants?.find((c) => c.actor?.id === starship.id) ?? null;
}

/**
 * @param {object} opts
 * @param {Combat} opts.combat
 * @param {Combatant} opts.attacker
 * @param {Combatant} opts.defender
 * @param {Item} opts.weapon
 * @param {number} opts.attackTotal
 * @param {number} opts.damageTotal
 * @param {boolean} [opts.targetSystems]
 * @param {Item|null} [opts.disableItem]
 * @param {boolean} [opts.disableDrive]
 */
export async function resolveShipWeaponHit({
  combat,
  attacker,
  defender,
  weapon,
  attackTotal,
  damageTotal,
  targetSystems = false,
  disableItem = null,
  disableDrive = false,
}) {
  const target = defender.actor;
  if (!target || target.type !== "starship") return { hit: false };

  const defState = getStarshipCombatState(defender);
  if (weaponsLockedOut(defState.crises)) {
    // Attacker lock-out is on attacker crises — check attacker
  }
  const atkState = getStarshipCombatState(attacker);
  if (weaponsLockedOut(atkState.crises)) {
    ui.notifications.warn(game.i18n.localize("WWN.Starship.WeaponsLockedOut"));
    return { hit: false, reason: "lockedOut" };
  }

  const qualities = parseWeaponQualities(weapon.system?.qualities);
  const isAmmoWeapon = qualities.ammo != null || (weapon.system?.ammo != null && weapon.system.ammo !== null);
  const pointDefense = isAmmoWeapon && hasPointDefense(target);

  let ac = effectiveStarshipAc(target.system.ac, defState, { pointDefense });
  // Defeat ECM bonus from attacker buffs vs this defender
  const ecmBonus = Number(atkState.buffs?.defeatEcm?.[defender.id]) || 0;
  const clumsyMod = qualityAttackModifier(qualities, target.system.hullClass);
  const adjustedAttack = attackTotal + ecmBonus + clumsyMod;

  // Flak: roll hit twice conceptually — caller may pass better of two; we just note flak
  const hit = adjustedAttack >= ac;
  if (!hit) {
    await createNoticeMessage({
      title: game.i18n.format("WWN.Starship.AttackMissed", {
        weapon: weapon.name,
        target: target.name,
      }),
      actor: attacker.actor,
      body: `${adjustedAttack} vs AC ${ac}`,
    });
    return { hit: false, ac, attack: adjustedAttack };
  }

  // Ammo spend
  if (weapon.system?.ammo != null && Number.isFinite(Number(weapon.system.ammo))) {
    const ammo = Number(weapon.system.ammo);
    if (ammo <= 0) {
      ui.notifications.warn(game.i18n.localize("WWN.Starship.OutOfAmmo"));
      return { hit: false, reason: "ammo" };
    }
    await weapon.update({ "system.ammo": ammo - 1 });
  }

  const baseArmor = armorWithCrises(target.system.armor, defState.crises);
  const dmg = resolveStarshipDamage({
    rawDamage: damageTotal,
    armor: baseArmor,
    ap: qualities.ap,
    hardenedPolyceramic: hasHardenedPolyceramic(target),
    targetSystems,
  });

  // Burst ECM / Grav Eddy after damage known
  let negated = false;
  if (hasBurstEcm(target) && !defState.flags.usedBurstEcmThisFight) {
    const use = await confirmWwnDialog({
    title: target.name,
    content: `<p>${game.i18n.localize("WWN.Starship.UseBurstEcm")}</p>`,
  });
    if (use) {
      negated = true;
      await updateStarshipCombatState(defender, (s) => ({
        ...s,
        flags: { ...s.flags, usedBurstEcmThisFight: true },
      }));
    }
  }
  if (!negated && hasGravEddy(target)) {
    const eddy = await new Roll("1d6").evaluate();
    if (eddy.total === 1) {
      negated = true;
      await createNoticeMessage({
        title: target.name,
        actor: target,
        body: game.i18n.localize("WWN.Starship.GravEddyNegate"),
      });
    }
  }

  if (negated) {
    return { hit: true, negated: true, damage: 0, ac, attack: adjustedAttack };
  }

  // Record attacker for Cloud weapons next round
  await updateStarshipCombatState(defender, (s) => ({
    ...s,
    flags: {
      ...s.flags,
      attackedByThisRound: [...new Set([...(s.flags.attackedByThisRound ?? []), attacker.id])],
    },
  }));

  // Offer Crisis conversion
  const crisisOffered = await offerCrisisOrApplyDamage({
    combat,
    defender,
    damage: dmg.finalDamage,
    canDisable: dmg.canDisable,
    disableItem,
    disableDrive,
    targetSystems,
  });

  return {
    hit: true,
    negated: false,
    damage: crisisOffered.applied ? dmg.finalDamage : 0,
    crisis: crisisOffered.crisis,
    ac,
    attack: adjustedAttack,
    canDisable: dmg.canDisable,
  };
}

/**
 * @param {object} opts
 */
async function offerCrisisOrApplyDamage({
  combat,
  defender,
  damage,
  canDisable,
  disableItem,
  disableDrive,
  targetSystems,
}) {
  const target = defender.actor;
  const state = getStarshipCombatState(defender);
  const canHitCrisis = !state.flags.usedHitCrisisThisRound;

  let acceptCrisis = false;
  if (canHitCrisis && damage > 0) {
    acceptCrisis = await confirmWwnDialog({
    title: target.name,
    content: `<p>${game.i18n.format("WWN.Starship.AcceptCrisisPrompt", { damage })}</p>`,
  });
  }

  if (acceptCrisis) {
    const { acceptHitCrisis } = await import("./crisis-flow.mjs");
    await acceptHitCrisis(defender, combat?.round ?? 1, { source: "hit" });
    return { applied: false, crisis: true };
  }

  if (damage > 0) {
    const { applyStarshipHullDamage } = await import("./hull-damage.mjs");
    await applyStarshipHullDamage(target, damage);
  }

  if (targetSystems && canDisable) {
    let item = disableItem;
    let drive = disableDrive;
    if (!item && !drive) {
      const picked = await promptDisableTarget(target);
      if (picked === null) {
        // Cancelled disable pick — still apply hull damage, skip disable
      } else {
        item = picked.disableItem;
        drive = picked.disableDrive;
      }
    }
    if (drive) await degradeDrive(target);
    else if (item) await disableShipSystem(item);
  }

  return { applied: true, crisis: false };
}
