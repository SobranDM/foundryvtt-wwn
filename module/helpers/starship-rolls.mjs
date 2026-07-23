/**
 * Starship crew-station and weapon roll pipeline.
 *
 * Pure resolution/matching helpers (`resolveStation`, `findStationSkillItem`,
 * `gunnerySkillName`, `bestAttributeMod`) live in `starship-crew.mjs` with no
 * Foundry imports and are unit tested there. This module wires them to the
 * live `WwnDice` / chat-card pipeline, so — like `module/dice/dice.mjs`
 * itself — it isn't unit tested under plain Node; it's exercised via manual
 * QA (see `.superpowers/sdd/task-7-report.md`).
 */
import { WwnDice } from "../dice/dice.mjs";
import { RollParts, resolveSkillDiceFormula } from "../dice/roll-parts.mjs";
import { WwnAttackRoll, WwnDamageRoll, WwnSkillRoll } from "../dice/rolls.mjs";
import { createRollMessage } from "../chat/chat-card.mjs";
import { isNpc } from "./actor-types.mjs";
import {
  DEFAULT_STATION_SKILL,
  resolveStation,
  findStationSkillItem,
  gunnerySkillName,
  bestAttributeMod,
} from "./starship-crew.mjs";

/** Resolve a station against the live actor it points at (async `fromUuid`). */
async function resolveStationLive(starship, stationKey) {
  const stationData = starship.system.stations?.[stationKey] ?? {};
  const actorUuid = stationData.actor ?? null;
  const actor = actorUuid ? await fromUuid(actorUuid) : null;
  return resolveStation(stationData, { getActor: () => actor });
}

/* -------------------------------------------- */
/*  Department checks                           */
/* -------------------------------------------- */

/**
 * Roll a crew department check: the assigned PC's default skill for that
 * station (2d6 / 3d6kh2 from the skill item + level + attribute), an NPC's
 * flat crew skill on 2d6, the station's NPC formula, or a warning if empty.
 * @param {Actor} starship
 * @param {string} stationKey
 * @param {{skipDialog?: boolean}} [options]
 */
export async function rollStationCheck(starship, stationKey, { skipDialog = false } = {}) {
  const resolved = await resolveStationLive(starship, stationKey);
  const stationLabel = game.i18n.localize(`WWN.Starship.Station.${stationKey}`);
  const title = `${starship.name}: ${stationLabel}`;

  if (resolved.mode === "unassigned") {
    return ui.notifications.warn(
      game.i18n.format("WWN.Starship.StationUnassigned", { station: stationLabel })
    );
  }

  if (resolved.mode === "formula") {
    return WwnDice.rollFormula(starship, resolved.formula, { title });
  }

  const skillName = DEFAULT_STATION_SKILL[stationKey];
  const skill = findStationSkillItem(resolved.actor.items, skillName);
  if (skill) {
    return WwnDice.rollSkill(resolved.actor, skill, { skipDialog, title });
  }

  // NPCs use a single crew-skill rating rather than per-skill items.
  if (isNpc(resolved.actor)) {
    return rollNpcStationCheck(resolved.actor, { title, skipDialog });
  }

  return ui.notifications.warn(
    game.i18n.format("WWN.Starship.NoStationSkill", {
      actor: resolved.actor.name,
      skill: skillName,
    })
  );
}

/** 2d6 + NPC `system.skill` for department checks when no skill item exists. */
async function rollNpcStationCheck(actor, { title, skipDialog = false } = {}) {
  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const parts = new RollParts().add(resolveSkillDiceFormula("2d6"), game.i18n.localize("WWN.Roll.SkillDice"));
  parts.add(actor.system.skill ?? 0, game.i18n.localize("WWN.Roll.NpcSkill"));
  parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

  const roll = await new WwnSkillRoll(parts.formula(), actor.getRollData(), { kind: "skill" }).evaluate();
  return createRollMessage({
    rolls: [roll],
    kind: "skill",
    actor,
    title,
    bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
    context: { breakdown: parts.breakdown() },
  });
}

/* -------------------------------------------- */
/*  Ship weapons                                */
/* -------------------------------------------- */

/** Shared chat-card finalization for both the actor and formula gunnery paths. */
async function postShipWeaponCard({ starship, weapon, title, attack, damage, rollData }) {
  const attackRoll = await new WwnAttackRoll(attack.formula(), rollData, { kind: "attack" }).evaluate();
  const damageRoll = await new WwnDamageRoll(damage.formula(), rollData, { kind: "damage" }).evaluate();

  return createRollMessage({
    rolls: [attackRoll, damageRoll],
    kind: "attack",
    actor: starship,
    img: weapon.img,
    title,
    bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
    context: {
      attackBreakdown: attack.breakdown(),
      damageBreakdown: damage.breakdown(),
      applyRows: [
        { id: "damage", label: game.i18n.localize("WWN.Roll.Damage"), value: damageRoll.total },
      ],
      hit: true,
    },
    flags: { applyRows: [{ id: "damage", value: damageRoll.total }] },
  });
}

/**
 * Roll a ship weapon attack. Crewed by the gunnery station's linked PC
 * (live ability/skill stats; the weapon's own `attackBonus` is ignored —
 * live stats win) or by its NPC gunnery formula (weapon damage + the
 * weapon's flat `attackBonus`, no ability mod).
 * @param {Actor} starship
 * @param {Item} weapon
 * @param {{skipDialog?: boolean}} [options]
 */
export async function rollShipWeapon(starship, weapon, { skipDialog = false } = {}) {
  const resolved = await resolveStationLive(starship, "gunnery");
  const stationLabel = game.i18n.localize("WWN.Starship.Station.gunnery");

  if (resolved.mode === "unassigned") {
    return ui.notifications.warn(
      game.i18n.format("WWN.Starship.StationUnassigned", { station: stationLabel })
    );
  }

  const crewLabel = resolved.mode === "actor"
    ? resolved.actor.name
    : game.i18n.localize("WWN.Starship.Npc");
  const title = game.i18n.format("WWN.Starship.WeaponRollTitle", {
    ship: starship.name,
    station: stationLabel,
    weapon: weapon.name,
    crew: crewLabel,
  });
  const damageFormula = weapon.system.damage || "1d6";

  if (resolved.mode === "formula") {
    const attack = new RollParts().add(resolved.formula, stationLabel);
    attack.add(weapon.system.attackBonus ?? 0, game.i18n.localize("WWN.Starship.AttackBonus"));
    const damage = new RollParts().add(damageFormula, game.i18n.localize("WWN.Roll.WeaponDamage"));
    return postShipWeaponCard({ starship, weapon, title, attack, damage, rollData: starship.getRollData() });
  }

  const actor = resolved.actor;
  const skillName = gunnerySkillName(starship.system.hullClass);
  const skill = findStationSkillItem(actor.items, skillName);
  let skillLevel = -2;
  if (skill) skillLevel = WwnDice.effectiveSkillLevel(actor, skill);
  else if (isNpc(actor)) skillLevel = actor.system.skill ?? -2;
  const attrMod = bestAttributeMod(actor.system.abilities);

  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const attack = new RollParts().add("1d20", game.i18n.localize("WWN.Roll.Die"));
  attack.add(actor.system.combat?.ab ?? 0, game.i18n.localize("WWN.Roll.AttackBonus"));
  attack.add(attrMod, game.i18n.localize("WWN.Starship.IntDex"));
  attack.add(skillLevel, skill?.name ?? skillName);
  attack.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

  const damage = new RollParts().add(damageFormula, game.i18n.localize("WWN.Roll.WeaponDamage"));
  damage.add(attrMod, game.i18n.localize("WWN.Starship.IntDex"));

  return postShipWeaponCard({ starship, weapon, title, attack, damage, rollData: actor.getRollData() });
}
