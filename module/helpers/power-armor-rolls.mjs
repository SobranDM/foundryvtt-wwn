/**
 * Power armor roll pipeline: live pilot stats + suit overlays (exo, mounts, training).
 */
import { WwnDice } from "../dice/dice.mjs";
import { RollParts, resolveSkillDiceFormula } from "../dice/roll-parts.mjs";
import { WwnRoll, WwnAttackRoll, WwnSkillRoll, WwnDamageRoll } from "../dice/rolls.mjs";
import { createRollMessage } from "../chat/chat-card.mjs";
import { resolvePilot, isPilotTrained } from "./power-armor-pilot.mjs";
import { weaponMountBonuses } from "./power-armor-derive.mjs";

async function resolvePilotLive(suit) {
  const uuid = suit.system.pilot?.actor ?? null;
  const actor = uuid ? await fromUuid(uuid) : null;
  return resolvePilot(suit.system.pilot, () => actor);
}

function suitTitle(suit, action) {
  return `${suit.name}: ${action}`;
}

/**
 * Evaluate two rolls and keep the worse for the given semantics.
 * @param {() => Promise<Roll>} makeRoll
 * @param {boolean} higherIsBetter
 */
async function pickWorstRoll(makeRoll, higherIsBetter) {
  const a = await makeRoll();
  const b = await makeRoll();
  if (higherIsBetter) return a.total <= b.total ? a : b;
  return a.total >= b.total ? a : b;
}

export async function rollSuitCheck(suit, abilityKey, { skipDialog = false } = {}) {
  const resolved = await resolvePilotLive(suit);
  if (resolved.mode !== "actor") {
    return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
  }
  const pilot = resolved.actor;
  const derived = suit.system.derived ?? {};
  const ability = foundry.utils.deepClone(pilot.system.abilities?.[abilityKey]);
  if (!ability) return;

  if (abilityKey === "str" && derived.effectiveStrength != null) {
    ability.value = derived.effectiveStrength;
    if (derived.effectiveStrengthMod != null) ability.mod = derived.effectiveStrengthMod;
  }

  const label = game.i18n.localize(CONFIG.WWN.abilities[abilityKey]);
  const title = suitTitle(suit, game.i18n.format("WWN.Roll.CheckTitle", { ability: label }));
  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const untrained = !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
  const formula = untrained ? "2d20kh" : "1d20";
  const rollParts = new RollParts().add(formula, game.i18n.localize("WWN.Roll.Die"));
  rollParts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

  const roll = await new WwnRoll(rollParts.formula(), pilot.getRollData(), { kind: "check" }).evaluate();
  const success = roll.total <= ability.value;

  return createRollMessage({
    rolls: [roll],
    kind: "check",
    actor: suit,
    title,
    subtitle: game.i18n.format("WWN.Roll.CheckTarget", { target: ability.value }),
    badge: {
      label: game.i18n.localize(success ? "WWN.Roll.Success" : "WWN.Roll.Failure"),
      type: success ? "hit" : "miss",
    },
    bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
    context: {
      breakdown: rollParts.breakdown(),
      pilotName: pilot.name,
      untrained,
    },
  });
}

export async function rollSuitSave(suit, saveId, { skipDialog = false } = {}) {
  const resolved = await resolvePilotLive(suit);
  if (resolved.mode !== "actor") {
    return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
  }
  const pilot = resolved.actor;
  const save = pilot.system.saves?.[saveId];
  if (!save) return;

  const label = game.i18n.localize(save.label ?? saveId);
  const title = suitTitle(suit, game.i18n.format("WWN.Roll.SaveTitle", { save: label }));
  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const untrained = !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
  const formula = untrained ? "2d20kl" : "1d20";
  const parts = new RollParts().add(formula, game.i18n.localize("WWN.Roll.Die"));
  parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

  const roll = await new WwnRoll(parts.formula(), pilot.getRollData(), { kind: "save" }).evaluate();
  const success = roll.total >= save.value;

  return createRollMessage({
    rolls: [roll],
    kind: "save",
    actor: suit,
    title,
    subtitle: game.i18n.format("WWN.Roll.SaveTarget", { target: save.value }),
    badge: {
      label: game.i18n.localize(success ? "WWN.Roll.Success" : "WWN.Roll.Failure"),
      type: success ? "hit" : "miss",
    },
    bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
    context: { breakdown: parts.breakdown(), pilotName: pilot.name, untrained },
  });
}

export async function rollSuitSkill(suit, skill, { skipDialog = false, abilityKey = null } = {}) {
  const resolved = await resolvePilotLive(suit);
  if (resolved.mode !== "actor") {
    return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
  }
  const pilot = resolved.actor;
  abilityKey ??= skill.system.score ?? "int";
  const derived = suit.system.derived ?? {};

  let abilityMod = pilot.system.abilities?.[abilityKey]?.mod ?? 0;
  if (abilityKey === "str" && derived.effectiveStrengthMod != null) {
    abilityMod = derived.effectiveStrengthMod;
  }

  const title = suitTitle(suit, game.i18n.format("WWN.Roll.SkillTitle", { skill: skill.name }));
  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const untrained = !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
  const slug = skill.system.slug || "";
  const baseDice = resolveSkillDiceFormula(skill.system.skillDice);

  const buildParts = () => {
    const parts = new RollParts();
    parts.add(baseDice, game.i18n.localize("WWN.Roll.SkillDice"));
    parts.add(WwnDice.effectiveSkillLevel(pilot, skill), skill.name);
    parts.add(abilityMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[abilityKey] ?? abilityKey));
    if (slug === "sneak") {
      parts.add(-(pilot.system.skills?.sneakPenalty ?? 0), game.i18n.localize("WWN.Roll.ArmorPenalty"));
      parts.add(suit.system.stealthPenalty ?? 0, game.i18n.localize("WWN.PowerArmor.StealthPenalty"));
      const camo = suit.system.derived?.stealthBonus ?? 0;
      if (camo) parts.add(camo, game.i18n.localize("WWN.PowerArmor.CamoBonus"));
    }
    if (slug === "exert") {
      parts.add(-(pilot.system.skills?.exertPenalty ?? 0), game.i18n.localize("WWN.Roll.ArmorPenalty"));
    }
    parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));
    return parts;
  };

  let roll;
  let parts = buildParts();
  if (untrained) {
    roll = await pickWorstRoll(
      () => new WwnSkillRoll(buildParts().formula(), pilot.getRollData(), { kind: "skill" }).evaluate(),
      true,
    );
  } else {
    roll = await new WwnSkillRoll(parts.formula(), pilot.getRollData(), { kind: "skill" }).evaluate();
  }

  return createRollMessage({
    rolls: [roll],
    kind: "skill",
    actor: suit,
    img: skill.img,
    title,
    bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
    context: { breakdown: parts.breakdown(), pilotName: pilot.name, untrained },
  });
}

/**
 * Find mount bonuses for a weapon (linked via flag or first available mount).
 * @param {Actor} suit
 * @param {Item} weapon
 */
export function resolveMountBonus(suit, weapon) {
  const mountId = weapon.getFlag?.("wwn", "armorMountEffectId")
    ?? weapon.system?.armorMountEffectId
    ?? "";
  if (mountId) return weaponMountBonuses(mountId);

  // Default: if any mount fitting exists and weapon is on the suit, use best matching mount
  const mounts = (suit.system.derived?.mounts ?? []);
  if (!mounts.length) return { attackBonus: 0, damageBonus: 0 };
  return mounts[0];
}

export async function rollSuitWeapon(suit, weapon, { skipDialog = false } = {}) {
  const resolved = await resolvePilotLive(suit);
  if (resolved.mode !== "actor") {
    return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
  }
  const pilot = resolved.actor;
  const untrained = !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
  const mount = resolveMountBonus(suit, weapon);
  const title = suitTitle(suit, weapon.name);

  // Delegate to standard attack when trained and no mount bonus — still prefer custom for mount + untrained
  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const derived = suit.system.derived ?? {};
  const attrKey = weapon.system.score ?? "str";
  let attrMod = pilot.system.abilities?.[attrKey]?.mod ?? 0;
  if (attrKey === "str" && derived.effectiveStrengthMod != null) {
    attrMod = derived.effectiveStrengthMod;
  }

  const skillName = weapon.system.linkedSkill || "";
  const skill = pilot.items.find(
    (i) => i.type === "skill" && i.name.toLowerCase() === String(skillName).toLowerCase(),
  );
  const skillLevel = skill ? WwnDice.effectiveSkillLevel(pilot, skill) : 0;

  const die = untrained ? "2d20kl" : "1d20";
  const attack = new RollParts().add(die, game.i18n.localize("WWN.Roll.Die"));
  attack.add(pilot.system.combat?.ab ?? 0, game.i18n.localize("WWN.Roll.AttackBonus"));
  attack.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));
  if (skill) attack.add(skillLevel, skill.name);
  attack.add(mount.attackBonus ?? 0, game.i18n.localize("WWN.PowerArmor.MountBonus"));
  attack.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

  const damageFormula = weapon.system.damage || "1d6";
  const damage = new RollParts().add(damageFormula, game.i18n.localize("WWN.Roll.WeaponDamage"));
  damage.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));
  damage.add(mount.damageBonus ?? 0, game.i18n.localize("WWN.PowerArmor.MountBonus"));

  const attackRoll = await new WwnAttackRoll(attack.formula(), pilot.getRollData(), { kind: "attack" }).evaluate();
  const damageRoll = await new WwnDamageRoll(damage.formula(), pilot.getRollData(), { kind: "damage" }).evaluate();

  return createRollMessage({
    rolls: [attackRoll, damageRoll],
    kind: "attack",
    actor: suit,
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
      pilotName: pilot.name,
      untrained,
    },
    flags: { applyRows: [{ id: "damage", value: damageRoll.total }] },
  });
}

/**
 * Roll an armor fitting from a power-armor suit: weapon attack or damage+save chat.
 * @param {Actor} suit
 * @param {Item} fitting
 * @param {{ skipDialog?: boolean }} [options]
 */
export async function rollSuitArmorFitting(suit, fitting, { skipDialog = false } = {}) {
  if (fitting.type !== "armorFitting") return;
  const system = fitting.system ?? {};

  if (system.isWeapon) {
    const synthetic = {
      name: fitting.name,
      img: fitting.img,
      type: "weapon",
      id: fitting.id,
      system: {
        damage: system.damageRoll || "3d6",
        melee: system.melee !== false,
        missile: !!system.missile,
        bonus: system.weaponBonus ?? 0,
        score: system.score || "str",
        linkedSkill: system.linkedSkill || "",
        shock: {
          damage: system.shock?.damage ?? "",
          ac: system.shock?.ac ?? 0,
        },
        trauma: {
          die: system.trauma?.die ?? "",
          rating: Number(system.trauma?.rating) || 0,
        },
        traumaRatingValue: Number(system.trauma?.rating) || 0,
        ammo: { mode: "none" },
      },
      getFlag: () => null,
    };
    // Ripper-style integral weapons do not get Weapon Mount bonuses.
    const resolved = await resolvePilotLive(suit);
    if (resolved.mode !== "actor") {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
    }
    const pilot = resolved.actor;
    const untrained = !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
    const title = suitTitle(suit, fitting.name);
    const prompt = await WwnDice.promptModifier({ title, skipDialog });
    if (!prompt) return;

    const derived = suit.system.derived ?? {};
    let attrKey = synthetic.system.score;
    let attrMod = pilot.system.abilities?.[attrKey]?.mod ?? 0;
    // Ripper: Str/Dex — use the better modifier
    if (!system.score || system.score === "str") {
      const str = pilot.system.abilities?.str?.mod ?? 0;
      const dex = pilot.system.abilities?.dex?.mod ?? 0;
      if (dex > str) {
        attrKey = "dex";
        attrMod = dex;
      } else {
        attrKey = "str";
        attrMod = str;
      }
      if (derived.effectiveStrengthMod != null && attrKey === "str") {
        attrMod = derived.effectiveStrengthMod;
      }
    } else if (attrKey === "str" && derived.effectiveStrengthMod != null) {
      attrMod = derived.effectiveStrengthMod;
    }

    const die = untrained ? "2d20kl" : "1d20";
    const attack = new RollParts().add(die, game.i18n.localize("WWN.Roll.Die"));
    attack.add(pilot.system.combat?.ab ?? 0, game.i18n.localize("WWN.Roll.AttackBonus"));
    attack.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));
    attack.add(synthetic.system.bonus ?? 0, game.i18n.localize("WWN.Roll.WeaponBonus"));
    attack.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

    const damage = new RollParts().add(synthetic.system.damage, game.i18n.localize("WWN.Roll.WeaponDamage"));
    damage.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));

    const rolls = [];
    const attackRoll = await new WwnAttackRoll(attack.formula(), pilot.getRollData(), { kind: "attack" }).evaluate();
    const damageRollEval = await new WwnDamageRoll(damage.formula(), pilot.getRollData(), { kind: "damage" }).evaluate();
    rolls.push(attackRoll, damageRollEval);

    let shockTotal = null;
    if (synthetic.system.shock?.damage) {
      const shock = new RollParts().add(synthetic.system.shock.damage, game.i18n.localize("WWN.Roll.ShockBase"));
      const shockRoll = await new WwnDamageRoll(shock.formula(), pilot.getRollData(), { kind: "damage" }).evaluate();
      shockTotal = shockRoll.total;
      rolls.push(shockRoll);
    }

    const applyRows = [
      { id: "damage", label: game.i18n.localize("WWN.Roll.Damage"), value: damageRollEval.total },
    ];
    if (shockTotal != null) {
      applyRows.push({ id: "shock", label: game.i18n.localize("WWN.Roll.Shock"), value: shockTotal });
    }

    return createRollMessage({
      rolls,
      kind: "attack",
      actor: suit,
      img: fitting.img,
      title,
      bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
      context: {
        attackBreakdown: attack.breakdown(),
        damageBreakdown: damage.breakdown(),
        applyRows,
        hit: true,
        pilotName: pilot.name,
        untrained,
      },
      flags: { applyRows: applyRows.map((r) => ({ id: r.id, value: r.value })) },
    });
  }

  if (!system.damageRoll && !system.save) {
    return fitting.show?.() ?? null;
  }

  const title = suitTitle(suit, fitting.name);
  const rolls = [];
  let damageTotal = null;
  if (system.damageRoll) {
    const damageRollEval = await new WwnDamageRoll(
      system.damageRoll,
      suit.getRollData(),
      { kind: "damage" },
    ).evaluate();
    rolls.push(damageRollEval);
    damageTotal = damageRollEval.total;
  }

  const applyRows = damageTotal != null
    ? [{ id: "damage", label: game.i18n.localize("WWN.Roll.Damage"), value: damageTotal }]
    : [];

  // attack-card exposes applyRows + save; power-card only has save / power buttons.
  const bodyTemplate = applyRows.length
    ? "systems/wwn/templates/chat/attack-card.hbs"
    : "systems/wwn/templates/chat/power-card.hbs";

  return createRollMessage({
    rolls,
    kind: "damage",
    actor: suit,
    img: fitting.img,
    title,
    defaultHealing: !!system.healing,
    bodyTemplate,
    context: {
      description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.description ?? "",
        { relativeTo: fitting, secrets: false },
      ),
      damageBreakdown: system.damageRoll || null,
      save: system.save || null,
      hasDamage: false,
      healing: !!system.healing,
      applyRows,
    },
    flags: {
      applyRows: applyRows.map((r) => ({ id: r.id, value: r.value })),
      itemUuid: fitting.uuid,
    },
  });
}
