/**
 * Resolve ship weapon hits: armor, defenses, hit/miss chat card with owner apply.
 * Never auto-applies hull damage — the defender owner clicks Apply on the card.
 */
import {
  getStarshipCombatState,
  updateStarshipCombatState,
} from "./combatant-state.mjs";
import {
  hasGravEddy,
  disableTargetCandidates,
} from "./systems.mjs";
import { weaponsLockedOut } from "./crises.mjs";
import { createRollMessage } from "../../chat/chat-card.mjs";
import { showWwnDialog, cancelButton } from "../../applications/wwn-dialog.mjs";
import { WwnAttackRoll, WwnDamageRoll } from "../../dice/rolls.mjs";
import { computeShipWeaponOutcome } from "./weapon-outcome.mjs";

export { computeShipWeaponOutcome } from "./weapon-outcome.mjs";

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
 * Resolve a ship weapon attack into a hit/miss chat card with owner-driven apply.
 *
 * @param {object} opts
 * @param {Combat} [opts.combat]
 * @param {Combatant} opts.attacker
 * @param {Combatant} opts.defender
 * @param {Item} opts.weapon
 * @param {number} opts.attackTotal
 * @param {number} opts.damageTotal
 * @param {Roll} [opts.attackRoll]
 * @param {Roll} [opts.damageRoll]
 * @param {boolean} [opts.targetSystems]
 * @param {string} [opts.title]
 * @param {string} [opts.attackBreakdown]
 * @param {string} [opts.damageBreakdown]
 */
export async function resolveShipWeaponHit({
  combat,
  attacker,
  defender,
  weapon,
  attackTotal,
  damageTotal,
  attackRoll = null,
  damageRoll = null,
  targetSystems = false,
  title = null,
  attackBreakdown = null,
  damageBreakdown = null,
}) {
  const target = defender.actor;
  if (!target || target.type !== "starship") return { hit: false };

  const atkState = getStarshipCombatState(attacker);
  if (weaponsLockedOut(atkState.crises)) {
    ui.notifications.warn(game.i18n.localize("WWN.Starship.WeaponsLockedOut"));
    return { hit: false, reason: "lockedOut" };
  }

  // Ammo: spend on fire (hit or miss) — attacker owns the weapon.
  if (weapon.system?.ammo != null && Number.isFinite(Number(weapon.system.ammo))) {
    const ammo = Number(weapon.system.ammo);
    if (ammo <= 0) {
      ui.notifications.warn(game.i18n.localize("WWN.Starship.OutOfAmmo"));
      return { hit: false, reason: "ammo" };
    }
    await weapon.update({ "system.ammo": ammo - 1 });
  }

  let outcome = computeShipWeaponOutcome({
    attacker,
    defender,
    weapon,
    attackTotal,
    damageTotal,
    targetSystems,
  });

  if (outcome.reason === "lockedOut") {
    ui.notifications.warn(game.i18n.localize("WWN.Starship.WeaponsLockedOut"));
    return { hit: false, reason: "lockedOut" };
  }

  // Grav Eddy: random negate (not a damage apply — resolves whether the hit stands).
  let negated = false;
  if (outcome.hit && hasGravEddy(target)) {
    const eddy = await new Roll("1d6").evaluate();
    if (eddy.total === 1) {
      negated = true;
      outcome = {
        ...outcome,
        finalDamage: 0,
        notices: [
          ...outcome.notices,
          game.i18n.localize("WWN.Starship.GravEddyNegate"),
        ],
      };
    }
  }

  // Best-effort cloud-tracking flag (may fail if the attacker cannot update the defender).
  if (outcome.hit && !negated) {
    try {
      await updateStarshipCombatState(defender, (s) => ({
        ...s,
        flags: {
          ...s.flags,
          attackedByThisRound: [...new Set([...(s.flags.attackedByThisRound ?? []), attacker.id])],
        },
      }));
    } catch (err) {
      console.warn("WWN | Could not record starship attack flag on defender", err);
    }
  }

  const rolls = [];
  if (attackRoll) rolls.push(attackRoll);
  else {
    rolls.push(await new WwnAttackRoll(String(attackTotal), {}, { kind: "attack" }).evaluate());
  }
  if (damageRoll) rolls.push(damageRoll);
  else if (outcome.hit && !negated) {
    rolls.push(await new WwnDamageRoll(String(damageTotal), {}, { kind: "damage" }).evaluate());
  }

  const applyRows = (outcome.hit && !negated && outcome.finalDamage > 0)
    ? [{
      id: "damage",
      label: game.i18n.localize("WWN.Roll.Damage"),
      value: outcome.finalDamage,
    }]
    : [];

  const badge = {
    label: game.i18n.localize(
      negated ? "WWN.Roll.Miss" : (outcome.hit ? "WWN.Roll.Hit" : "WWN.Roll.Miss"),
    ),
    type: negated || !outcome.hit ? "miss" : "hit",
  };

  const notices = [];
  if (!outcome.hit) {
    notices.push(
      game.i18n.format("WWN.Starship.AttackMissed", {
        weapon: weapon.name,
        target: target.name,
      }) + ` (${outcome.attack} vs AC ${outcome.ac})`,
    );
  }
  notices.push(...outcome.notices);

  await createRollMessage({
    rolls,
    kind: "attack",
    actor: attacker.actor,
    img: weapon.img,
    title: title ?? weapon.name,
    subtitle: game.i18n.format("WWN.Roll.VsTarget", { target: target.name }),
    badge,
    bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
    context: {
      attackBreakdown: attackBreakdown ?? `${outcome.attack} vs AC ${outcome.ac}`,
      damageBreakdown: damageBreakdown ?? null,
      applyRows,
      notices,
      hit: outcome.hit && !negated,
    },
    flags: {
      applyRows: applyRows.map((r) => ({ id: r.id, value: r.value })),
    },
  });

  void combat;

  return {
    hit: outcome.hit,
    negated,
    damage: applyRows[0]?.value ?? 0,
    ac: outcome.ac,
    attack: outcome.attack,
    canDisable: outcome.canDisable,
  };
}

/**
 * Post a sheet-driven ship weapon card with optional target AC resolution.
 * Used when rolls were already evaluated outside combat fireWeapons.
 *
 * @param {object} opts
 */
export async function postResolvedShipWeaponCard({
  starship,
  weapon,
  title,
  attackRoll,
  damageRoll,
  attackBreakdown,
  damageBreakdown,
  targetActor = null,
  attackerCombatant = null,
  defenderCombatant = null,
}) {
  let hit = null;
  let applyRows = [];
  const notices = [];

  if (targetActor?.type === "starship") {
    const attacker = attackerCombatant ?? {
      id: starship.id,
      actor: starship,
      getFlag: () => null,
      setFlag: async () => null,
    };
    const defender = defenderCombatant ?? {
      id: targetActor.id,
      actor: targetActor,
      getFlag: () => null,
      setFlag: async () => null,
    };
    // Spend ammo when firing from the sheet against a target.
    if (weapon.system?.ammo != null && Number.isFinite(Number(weapon.system.ammo))) {
      const ammo = Number(weapon.system.ammo);
      if (ammo <= 0) {
        ui.notifications.warn(game.i18n.localize("WWN.Starship.OutOfAmmo"));
        return null;
      }
      await weapon.update({ "system.ammo": ammo - 1 });
    }

    const outcome = computeShipWeaponOutcome({
      attacker,
      defender,
      weapon,
      attackTotal: attackRoll.total,
      damageTotal: damageRoll.total,
    });
    hit = outcome.hit;
    notices.push(...outcome.notices);
    if (hit && outcome.finalDamage > 0) {
      applyRows = [{
        id: "damage",
        label: game.i18n.localize("WWN.Roll.Damage"),
        value: outcome.finalDamage,
      }];
    }
    if (!hit) {
      notices.push(game.i18n.format("WWN.Starship.AttackMissed", {
        weapon: weapon.name,
        target: targetActor.name,
      }) + ` (${outcome.attack} vs AC ${outcome.ac})`);
    }
  } else {
    // No target: offer raw damage apply (owner of whatever is selected applies).
    applyRows = [{
      id: "damage",
      label: game.i18n.localize("WWN.Roll.Damage"),
      value: damageRoll.total,
    }];
  }

  return createRollMessage({
    rolls: [attackRoll, damageRoll],
    kind: "attack",
    actor: starship,
    img: weapon.img,
    title,
    subtitle: targetActor
      ? game.i18n.format("WWN.Roll.VsTarget", { target: targetActor.name })
      : null,
    badge: hit == null ? null : {
      label: game.i18n.localize(hit ? "WWN.Roll.Hit" : "WWN.Roll.Miss"),
      type: hit ? "hit" : "miss",
    },
    bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
    context: {
      attackBreakdown,
      damageBreakdown,
      applyRows,
      notices,
      hit: hit !== false,
    },
    flags: {
      applyRows: applyRows.map((r) => ({ id: r.id, value: r.value })),
    },
  });
}
