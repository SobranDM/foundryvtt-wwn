/**
 * Power armor roll pipeline: live pilot stats + suit overlays (exo, mounts, training).
 */
import { WwnDice } from "../dice/dice.mjs";
import { skillRollAbilityChoices } from "../dice/roll-prompt.mjs";
import { RollParts, BASE_SKILL_DICE_COUNT } from "../dice/roll-parts.mjs";
import { WwnRoll, WwnAttackRoll, WwnSkillRoll, WwnDamageRoll } from "../dice/rolls.mjs";
import { createRollMessage } from "../chat/chat-card.mjs";
import { enrichItemDescription } from "../chat/item-description.mjs";
import { formatShockAcDetail, formatAttackAcDetail, buildNoShockRollRow } from "../chat/roll-rows.mjs";
import { resolvePilot, isPilotTrained } from "./power-armor-pilot.mjs";
import { resolveCamoStealthBonus, weaponMountBonuses, isShockImmuneTarget } from "./power-armor-derive.mjs";
import {
  floodlightsAttackPenalty,
  targetLockAttackBonus,
  tsukumogamiSkillBonus,
} from "./power-armor-effects.mjs";
import {
  resolveAttackHit,
  naturalAttackDie,
  applyShockFloor,
  buildAttackApplyRows,
  effectiveShockCompareAc,
  shouldShowShockRow,
  shouldEmitNoShockPlaceholder,
  hasBaseShockDamage,
  resolveChatAttackTarget,
} from "./attack-outcome.mjs";
import { resolveTargetAcForAttack } from "./attack-ac.mjs";
import { resolveWeaponTlGate } from "./weapon-tl.mjs";
import { resolvePilotWeaponSkill } from "./power-armor-pilot-skill.mjs";
import { skillSlugOf } from "./skill-set.mjs";

export { resolvePilotWeaponSkill } from "./power-armor-pilot-skill.mjs";

function applyRowLabels() {
  return {
    damage: game.i18n.localize("WWN.Roll.Damage"),
    damageFloored: game.i18n.localize("WWN.Roll.DamageFloored"),
    missDamage: game.i18n.localize("WWN.Roll.MissDamage"),
    straight: (value) => game.i18n.format("WWN.Roll.Straight", { value }),
    shock: game.i18n.localize("WWN.Roll.ShockBase"),
    shockSuffix: (ac) => game.i18n.format("WWN.Roll.ShockApplySuffix", { ac }),
    trauma: (rating) => game.i18n.format("WWN.Roll.TraumaDamage", { rating }),
  };
}

function suitAttackKind(weapon) {
  if (weapon.system?.missile && weapon.system?.melee === false) return "ranged";
  if (weapon.system?.melee === false) return "ranged";
  return "melee";
}

/**
 * Resolve hit / shock floor / apply rows against the current user target.
 * @param {{ suit: Actor, weapon: object, attackKind: string, attackRoll: Roll, damageTotal: number, shockTotal?: number|null }} input
 */
export function resolveSuitWeaponOutcome({
  suit,
  weapon,
  attackKind,
  attackRoll,
  damageTotal,
  shockTotal = null,
  attacker = null,
}) {
  const shockAttacker = attacker ?? suit;
  const { target, untargeted } = resolveChatAttackTarget(game.user?.targets);
  let hit = true;
  let blockedByTl = false;
  let targetAc = null;
  let shockAppliesOnMiss = false;
  let shockLabelAc = weapon.system?.shockAcValue ?? weapon.system?.shock?.ac;
  let badge = null;
  let acKind = "melee";
  let separateRanged = false;

  if (target?.actor) {
    const gate = resolveWeaponTlGate(suit, target.actor, weapon, attackKind);
    blockedByTl = gate.blocked;
    const separateRangedSetting = game.settings.get("wwn", "separateRangedAC");
    separateRanged = separateRangedSetting;
    const acResult = resolveTargetAcForAttack(suit, target.actor, weapon, attackKind, { separateRanged: separateRangedSetting });
    targetAc = acResult.ac;
    acKind = acResult.acKind ?? (attackKind === "ranged" ? "ranged" : "melee");
    const hitResult = resolveAttackHit({
      attackTotal: attackRoll.total,
      naturalDie: naturalAttackDie(attackRoll),
      targetAc,
      blockedByTl,
    });
    hit = hitResult.hit;
    badge = {
      label: game.i18n.localize(hit ? "WWN.Roll.Hit" : "WWN.Roll.Miss"),
      type: hit ? "hit" : "miss",
    };

    if (shockTotal != null && !blockedByTl) {
      const shockCheck = WwnDice.shockAppliesOnMiss(shockAttacker, target.actor, weapon, attackKind, {
        effectiveTargetAc: Number.isFinite(targetAc) ? targetAc : null,
      });
      shockLabelAc = shockCheck.threshold;
      shockAppliesOnMiss = shockCheck.applies;
    }
  } else if (shockTotal != null) {
    shockAppliesOnMiss = true;
  }

  const shockForFloor = isShockImmuneTarget(target?.actor) ? null : shockTotal;
  const floorInfo = applyShockFloor(damageTotal, hit ? shockForFloor : null);
  const applyRows = buildAttackApplyRows({
    hit,
    untargeted,
    blockedByTl,
    damageValue: floorInfo.value,
    damageFloored: floorInfo.floored,
    straightValue: null,
    shockTotal: shockForFloor,
    shockAppliesOnMiss,
    shockLabelAc,
    trauma: null,
    missDamageValue: null,
    labels: applyRowLabels(),
  });

  return {
    hit,
    untargeted,
    applyRows,
    badge,
    targetAc,
    acKind,
    separateRanged,
    targetName: target?.name ?? null,
    outcome: untargeted ? null : {
      type: hit ? "hit" : "miss",
      label: game.i18n.localize(hit ? "WWN.Roll.HitHeader" : "WWN.Roll.MissHeader"),
    },
  };
}

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
    rollMeta: [{
      label: game.i18n.localize("WWN.Roll.Formula"),
      breakdown: rollParts.breakdown(),
    }],
    context: {
      pilotName: pilot.name,
      untrained,
    },
  });
}

export async function rollSuitSave(suit, saveId, { skipDialog = false } = {}) {
  const emptySuit = !!suit.system.derived?.emptySuit?.active;
  const saveTarget = emptySuit
    ? (suit.system.derived.emptySuit.save ?? 14)
    : null;

  const resolved = emptySuit ? null : await resolvePilotLive(suit);
  if (!emptySuit && resolved.mode !== "actor") {
    return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
  }
  const pilot = resolved?.actor ?? null;
  const save = emptySuit
    ? { value: saveTarget, label: saveId }
    : pilot.system.saves?.[saveId];
  if (!save) return;

  const label = game.i18n.localize(save.label ?? saveId);
  const title = suitTitle(suit, game.i18n.format("WWN.Roll.SaveTitle", { save: label }));
  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const untrained = emptySuit
    ? false
    : !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
  const formula = untrained ? "2d20kl" : "1d20";
  const parts = new RollParts().add(formula, game.i18n.localize("WWN.Roll.Die"));
  parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

  const rollData = emptySuit ? suit.getRollData() : pilot.getRollData();
  const roll = await new WwnRoll(parts.formula(), rollData, { kind: "save" }).evaluate();
  const target = emptySuit ? saveTarget : save.value;
  const success = roll.total >= target;

  return createRollMessage({
    rolls: [roll],
    kind: "save",
    actor: suit,
    title,
    subtitle: game.i18n.format("WWN.Roll.SaveTarget", { target }),
    badge: {
      label: game.i18n.localize(success ? "WWN.Roll.Success" : "WWN.Roll.Failure"),
      type: success ? "hit" : "miss",
    },
    bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
    rollMeta: [{
      label: game.i18n.localize("WWN.Roll.Formula"),
      breakdown: parts.breakdown(),
    }],
    context: {
      pilotName: emptySuit ? game.i18n.localize("WWN.PowerArmor.EmptySuit") : pilot.name,
      untrained,
    },
  });
}

export async function rollSuitSkill(suit, skill, { skipDialog = false, abilityKey = null } = {}) {
  const resolved = await resolvePilotLive(suit);
  if (resolved.mode !== "actor") {
    return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
  }
  const pilot = resolved.actor;
  const defaultKey = abilityKey ?? skill.system.score ?? "int";
  const derived = suit.system.derived ?? {};

  const title = suitTitle(suit, game.i18n.format("WWN.Roll.SkillTitle", { skill: skill.name }));
  const prompt = await WwnDice.promptModifier({
    title,
    skipDialog,
    abilities: skillRollAbilityChoices(pilot, defaultKey),
    defaultAbilityKey: defaultKey,
  });
  if (!prompt) return;
  abilityKey = prompt.abilityKey ?? defaultKey;

  let abilityMod = pilot.system.abilities?.[abilityKey]?.mod ?? 0;
  if (abilityKey === "str" && derived.effectiveStrengthMod != null) {
    abilityMod = derived.effectiveStrengthMod;
  }

  const untrained = !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
  const slug = skillSlugOf(skill);

  const buildParts = () => {
    const parts = new RollParts();
    parts.add(`${BASE_SKILL_DICE_COUNT}d6`, game.i18n.localize("WWN.Roll.SkillDice"));
    parts.add(WwnDice.effectiveSkillLevel(pilot, skill), skill.name);
    parts.add(abilityMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[abilityKey] ?? abilityKey));
    if (slug === "sneak") {
      parts.add(-(pilot.system.skills?.sneakPenalty ?? 0), game.i18n.localize("WWN.Roll.ArmorPenalty"));
      parts.add(suit.system.stealthPenalty ?? 0, game.i18n.localize("WWN.PowerArmor.StealthPenalty"));
      const camo = resolveCamoStealthBonus(suit.system.derived, null);
      if (camo) parts.add(camo, game.i18n.localize("WWN.PowerArmor.CamoBonus"));
    }
    const viBonus = tsukumogamiSkillBonus(suit);
    if (viBonus) parts.add(viBonus, game.i18n.localize("WWN.PowerArmor.ViAssist"));
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
    rollMeta: [{
      label: game.i18n.localize("WWN.Roll.Formula"),
      breakdown: parts.breakdown(),
    }],
    context: { pilotName: pilot.name, untrained },
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
  const emptySuit = !!suit.system.derived?.emptySuit?.active;
  const resolved = emptySuit ? null : await resolvePilotLive(suit);
  if (!emptySuit && resolved.mode !== "actor") {
    return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
  }
  const pilot = resolved?.actor ?? null;
  const untrained = emptySuit
    ? false
    : !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
  const mount = resolveMountBonus(suit, weapon);
  const title = suitTitle(suit, weapon.name);

  // Delegate to standard attack when trained and no mount bonus — still prefer custom for mount + untrained
  const prompt = await WwnDice.promptModifier({ title, skipDialog });
  if (!prompt) return;

  const derived = suit.system.derived ?? {};
  const attrKey = weapon.system.score ?? "str";
  let attrMod = emptySuit ? 0 : (pilot.system.abilities?.[attrKey]?.mod ?? 0);
  if (attrKey === "str" && derived.effectiveStrengthMod != null) {
    attrMod = derived.effectiveStrengthMod;
  }

  const skill = emptySuit ? null : resolvePilotWeaponSkill(pilot, weapon);
  const skillLevel = emptySuit
    ? 0
    : (skill ? WwnDice.effectiveSkillLevel(pilot, skill) : -2);
  const attackBonus = emptySuit
    ? (derived.emptySuit?.ab ?? derived.attackBonus ?? 6)
    : (pilot.system.combat?.ab ?? 0);

  const die = untrained ? "2d20kl" : "1d20";
  const attack = new RollParts().add(die, game.i18n.localize("WWN.Roll.Die"));
  attack.add(attackBonus, game.i18n.localize("WWN.Roll.AttackBonus"));
  if (attrMod) attack.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));
  if (!emptySuit) {
    attack.add(skillLevel, skill?.name ?? game.i18n.localize("WWN.Roll.Unskilled"));
  }
  attack.add(mount.attackBonus ?? 0, game.i18n.localize("WWN.PowerArmor.MountBonus"));
  const { target: lockToken } = resolveChatAttackTarget(game.user?.targets);
  const lockBonus = targetLockAttackBonus(suit, lockToken?.actor ?? null);
  if (lockBonus) attack.add(lockBonus, game.i18n.localize("WWN.PowerArmor.TargetLockBonus"));
  const lightPen = floodlightsAttackPenalty(suit);
  if (lightPen) attack.add(lightPen, game.i18n.localize("WWN.PowerArmor.FloodlightsPenalty"));
  attack.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

  const rollData = emptySuit ? suit.getRollData() : pilot.getRollData();
  const damageFormula = weapon.system.damage || "1d6";
  const damage = new RollParts(rollData).add(damageFormula, game.i18n.localize("WWN.Roll.WeaponDamage"));
  if (attrMod) damage.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));
  damage.add(mount.damageBonus ?? 0, game.i18n.localize("WWN.PowerArmor.MountBonus"));

  const attackRoll = await new WwnAttackRoll(attack.formula(), rollData, { kind: "attack" }).evaluate();
  const damageRoll = await new WwnDamageRoll(damage.formula(), rollData, { kind: "damage" }).evaluate();
  const attackKind = suitAttackKind(weapon);

  let shockTotal = null;
  let shock = null;
  let shockRoll = null;
  if (hasBaseShockDamage(weapon.system?.shock?.damage)) {
    shock = new RollParts(rollData).add(weapon.system.shock.damage, game.i18n.localize("WWN.Roll.ShockBase"));
    shockRoll = await new WwnDamageRoll(shock.formula(), rollData, { kind: "damage" }).evaluate();
    shockTotal = shockRoll.total;
  }

  const shockAttacker = emptySuit ? suit : pilot;
  const outcome = resolveSuitWeaponOutcome({
    suit,
    weapon,
    attackKind,
    attackRoll,
    damageTotal: damageRoll.total,
    shockTotal,
    attacker: shockAttacker,
  });

  const compareAcs = [];
  if (!outcome.untargeted && Number.isFinite(outcome.targetAc)) {
    compareAcs.push(effectiveShockCompareAc(shockAttacker, lockToken?.actor, outcome.targetAc));
  }
  const shockThreshold = weapon.system?.shockAcValue ?? weapon.system?.shock?.ac;
  const showShockRow = shouldShowShockRow(shockThreshold, compareAcs);
  const rolls = [attackRoll, damageRoll];
  const rollMeta = [
    {
      label: game.i18n.localize("WWN.Roll.Attack"),
      detail: formatAttackAcDetail(outcome.targetAc, {
        separateRanged: outcome.separateRanged,
        acKind: outcome.acKind,
      }),
      breakdown: attack.breakdown(),
    },
    { label: game.i18n.localize("WWN.Roll.Damage"), breakdown: damage.breakdown() },
  ];
  if (shockRoll && (outcome.hit || showShockRow)) {
    rolls.push(shockRoll);
    rollMeta.push({
      label: game.i18n.localize("WWN.Roll.ShockBase"),
      detail: formatShockAcDetail(shockThreshold),
      breakdown: shock.breakdown(),
    });
  }
  const extraRollRows = shouldEmitNoShockPlaceholder({
    hit: outcome.hit,
    showShockRow,
    canUseShock: !!shockRoll,
    hasCompareAcs: compareAcs.length > 0,
  })
    ? [buildNoShockRollRow(shockThreshold)]
    : [];

  const msg = await createRollMessage({
    rolls,
    extraRollRows,
    rollMeta,
    kind: "attack",
    actor: suit,
    img: weapon.img,
    title,
    subtitle: outcome.targetName
      ? game.i18n.format("WWN.Roll.VsTarget", { target: outcome.targetName })
      : null,
    badge: outcome.badge,
    bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
    description: await enrichItemDescription(weapon),
    context: {
      applyRows: outcome.applyRows,
      hit: outcome.hit,
      outcome: outcome.outcome,
      pilotName: emptySuit ? game.i18n.localize("WWN.PowerArmor.EmptySuit") : pilot.name,
      untrained,
    },
    flags: {
      applyRows: outcome.applyRows.map((r) => ({
        id: r.id,
        value: r.value,
        altValue: r.altValue,
      })),
    },
  });

  if (suit.system.derived?.capabilities?.linkedTargeting) {
    ui.notifications?.info?.(game.i18n.localize("WWN.PowerArmor.LinkedTargetingHint"));
  }

  return msg;
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
    const emptySuit = !!suit.system.derived?.emptySuit?.active;
    const resolved = emptySuit ? null : await resolvePilotLive(suit);
    if (!emptySuit && resolved.mode !== "actor") {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
    }
    const pilot = resolved?.actor ?? null;
    const untrained = emptySuit
      ? false
      : !isPilotTrained(resolved.uuid, suit.system.trainedPilots);
    const title = suitTitle(suit, fitting.name);
    const prompt = await WwnDice.promptModifier({ title, skipDialog });
    if (!prompt) return;

    const derived = suit.system.derived ?? {};
    let attrKey = synthetic.system.score;
    let attrMod = emptySuit ? 0 : (pilot.system.abilities?.[attrKey]?.mod ?? 0);
    // Ripper: Str/Dex — use the better modifier
    if (!emptySuit && (!system.score || system.score === "str")) {
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

    const skill = emptySuit ? null : resolvePilotWeaponSkill(pilot, synthetic);
    const skillLevel = emptySuit
      ? 0
      : (skill ? WwnDice.effectiveSkillLevel(pilot, skill) : -2);
    const attackBonus = emptySuit
      ? (derived.emptySuit?.ab ?? derived.attackBonus ?? 6)
      : (pilot.system.combat?.ab ?? 0);
    const die = untrained ? "2d20kl" : "1d20";
    const attack = new RollParts().add(die, game.i18n.localize("WWN.Roll.Die"));
    attack.add(attackBonus, game.i18n.localize("WWN.Roll.AttackBonus"));
    if (attrMod) attack.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));
    if (!emptySuit) {
      attack.add(skillLevel, skill?.name ?? game.i18n.localize("WWN.Roll.Unskilled"));
    }
    attack.add(synthetic.system.bonus ?? 0, game.i18n.localize("WWN.Roll.WeaponBonus"));
    attack.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

    const rollData = emptySuit ? suit.getRollData() : pilot.getRollData();
    const damage = new RollParts(rollData).add(synthetic.system.damage, game.i18n.localize("WWN.Roll.WeaponDamage"));
    if (attrMod) damage.add(attrMod, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[attrKey] ?? attrKey));

    const rolls = [];
    const attackRoll = await new WwnAttackRoll(attack.formula(), rollData, { kind: "attack" }).evaluate();
    const damageRollEval = await new WwnDamageRoll(damage.formula(), rollData, { kind: "damage" }).evaluate();
    rolls.push(attackRoll, damageRollEval);

    let shockTotal = null;
    let shock = null;
    let shockRoll = null;
    if (hasBaseShockDamage(synthetic.system.shock?.damage)) {
      shock = new RollParts(rollData).add(synthetic.system.shock.damage, game.i18n.localize("WWN.Roll.ShockBase"));
      shockRoll = await new WwnDamageRoll(shock.formula(), rollData, { kind: "damage" }).evaluate();
      shockTotal = shockRoll.total;
    }

    const attackKind = suitAttackKind(synthetic);
    const shockAttacker = emptySuit ? suit : pilot;
    const outcome = resolveSuitWeaponOutcome({
      suit,
      weapon: synthetic,
      attackKind,
      attackRoll,
      damageTotal: damageRollEval.total,
      shockTotal,
      attacker: shockAttacker,
    });

    const compareAcs = [];
    if (!outcome.untargeted) {
      const { target: shockTarget } = resolveChatAttackTarget(game.user.targets);
      if (shockTarget?.actor) {
        const ac = resolveTargetAcForAttack(shockAttacker, shockTarget.actor, synthetic, attackKind, {
          separateRanged: game.settings.get("wwn", "separateRangedAC"),
        }).ac;
        compareAcs.push(effectiveShockCompareAc(shockAttacker, shockTarget.actor, ac));
      }
    }
    const shockThreshold = synthetic.system?.shockAcValue ?? synthetic.system?.shock?.ac;
    const showShockRow = shouldShowShockRow(shockThreshold, compareAcs);
    if (shockRoll && (outcome.hit || showShockRow)) rolls.push(shockRoll);
    const extraRollRows = shouldEmitNoShockPlaceholder({
      hit: outcome.hit,
      showShockRow,
      canUseShock: !!shockRoll,
      hasCompareAcs: compareAcs.length > 0,
    })
      ? [buildNoShockRollRow(shockThreshold)]
      : [];

    const rollMeta = [
      {
        label: game.i18n.localize("WWN.Roll.Attack"),
        detail: formatAttackAcDetail(outcome.targetAc, {
          separateRanged: outcome.separateRanged,
          acKind: outcome.acKind,
        }),
        breakdown: attack.breakdown(),
      },
      { label: game.i18n.localize("WWN.Roll.Damage"), breakdown: damage.breakdown() },
    ];
    if (shockRoll && (outcome.hit || showShockRow)) {
      rollMeta.push({
        label: game.i18n.localize("WWN.Roll.ShockBase"),
        detail: formatShockAcDetail(shockThreshold),
        breakdown: shock.breakdown(),
      });
    }

    return createRollMessage({
      rolls,
      extraRollRows,
      description: await enrichItemDescription(fitting),
      rollMeta,
      kind: "attack",
      actor: suit,
      img: fitting.img,
      title,
      subtitle: outcome.targetName
        ? game.i18n.format("WWN.Roll.VsTarget", { target: outcome.targetName })
        : null,
      badge: outcome.badge,
      bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
      context: {
        applyRows: outcome.applyRows,
        hit: outcome.hit,
        outcome: outcome.outcome,
        pilotName: emptySuit ? game.i18n.localize("WWN.PowerArmor.EmptySuit") : pilot.name,
        untrained,
      },
      flags: {
        applyRows: outcome.applyRows.map((r) => ({
          id: r.id,
          value: r.value,
          altValue: r.altValue,
        })),
      },
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
  const useAttackCard = applyRows.length > 0;
  const description = await enrichItemDescription(fitting);
  const bodyTemplate = useAttackCard
    ? "systems/wwn/templates/chat/attack-card.hbs"
    : "systems/wwn/templates/chat/power-card.hbs";

  return createRollMessage({
    rolls,
    rollMeta: [{ label: game.i18n.localize("WWN.Roll.Damage"), breakdown: system.damageRoll || "" }],
    kind: "damage",
    actor: suit,
    img: fitting.img,
    title,
    defaultHealing: !!system.healing,
    bodyTemplate,
    description: useAttackCard ? description : "",
    context: {
      description: useAttackCard ? "" : description,
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
