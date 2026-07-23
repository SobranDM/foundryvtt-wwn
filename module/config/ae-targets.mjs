/**
 * Plain-English Active Effect target registry.
 *
 * Users never type raw data paths: the AE editor renders this registry as a
 * grouped dropdown. Each target constrains the legal change types (modes),
 * the value input type, and the application phase.
 *
 * valueType: "number" (spinner), "formula" (deterministic roll-data formula),
 *            "dice" (dice expression string)
 */

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/** @param {object} target */
function tokenTarget(label, { modes = ["add", "override"], valueType = "number" } = {}) {
  return { label, modes, valueType, phase: "final" };
}

/** Core token sight fields (Applied via `token.*` keys; phase must be `final`). */
function buildTokenSightTargets() {
  return {
    "token.sight.enabled": tokenTarget("WWN.Effects.TokenSightEnabled", { modes: ["override"], valueType: "string" }),
    "token.sight.range": tokenTarget("WWN.Effects.TokenSightRange"),
    "token.sight.angle": tokenTarget("WWN.Effects.TokenSightAngle"),
    "token.sight.visionMode": tokenTarget("WWN.Effects.TokenSightVisionMode", { modes: ["override"], valueType: "string" }),
    "token.sight.color": tokenTarget("WWN.Effects.TokenSightColor", { modes: ["override"], valueType: "string" }),
    "token.sight.attenuation": tokenTarget("WWN.Effects.TokenSightAttenuation"),
    "token.sight.brightness": tokenTarget("WWN.Effects.TokenSightBrightness"),
    "token.sight.saturation": tokenTarget("WWN.Effects.TokenSightSaturation"),
    "token.sight.contrast": tokenTarget("WWN.Effects.TokenSightContrast"),
  };
}

/** Core token light / emission fields (`LightData` on TokenDocument). */
function buildTokenLightTargets() {
  return {
    "token.light.negative": tokenTarget("WWN.Effects.TokenLightNegative", { modes: ["override"], valueType: "string" }),
    "token.light.priority": tokenTarget("WWN.Effects.TokenLightPriority", { modes: ["add", "override"], valueType: "number" }),
    "token.light.alpha": tokenTarget("WWN.Effects.TokenLightAlpha"),
    "token.light.angle": tokenTarget("WWN.Effects.TokenLightAngle"),
    "token.light.bright": tokenTarget("WWN.Effects.TokenLightBright"),
    "token.light.dim": tokenTarget("WWN.Effects.TokenLightDim"),
    "token.light.color": tokenTarget("WWN.Effects.TokenLightColor", { modes: ["override"], valueType: "string" }),
    "token.light.coloration": tokenTarget("WWN.Effects.TokenLightColoration", { modes: ["add", "override"], valueType: "number" }),
    "token.light.attenuation": tokenTarget("WWN.Effects.TokenLightAttenuation"),
    "token.light.luminosity": tokenTarget("WWN.Effects.TokenLightLuminosity"),
    "token.light.saturation": tokenTarget("WWN.Effects.TokenLightSaturation"),
    "token.light.contrast": tokenTarget("WWN.Effects.TokenLightContrast"),
    "token.light.shadows": tokenTarget("WWN.Effects.TokenLightShadows"),
    "token.light.animation.type": tokenTarget("WWN.Effects.TokenLightAnimationType", { modes: ["override"], valueType: "string" }),
    "token.light.animation.speed": tokenTarget("WWN.Effects.TokenLightAnimationSpeed", { modes: ["add", "override"], valueType: "number" }),
    "token.light.animation.intensity": tokenTarget("WWN.Effects.TokenLightAnimationIntensity", { modes: ["add", "override"], valueType: "number" }),
    "token.light.animation.reverse": tokenTarget("WWN.Effects.TokenLightAnimationReverse", { modes: ["override"], valueType: "string" }),
    "token.light.darkness.min": tokenTarget("WWN.Effects.TokenLightDarknessMin"),
    "token.light.darkness.max": tokenTarget("WWN.Effects.TokenLightDarknessMax"),
  };
}

/** Per-mode detection entries from `CONFIG.Canvas.detectionModes`. */
function buildTokenDetectionTargets() {
  const targets = {};
  const modes = CONFIG.Canvas?.detectionModes ?? {};
  for (const [id, mode] of Object.entries(modes)) {
    const modeLabel = game.i18n?.localize(mode.label) ?? id;
    targets[`token.detectionModes.${id}.enabled`] = {
      label: "WWN.Effects.TokenDetectionEnabled",
      labelData: { mode: modeLabel },
      modes: ["override"],
      valueType: "string",
      phase: "final",
    };
    targets[`token.detectionModes.${id}.range`] = {
      label: "WWN.Effects.TokenDetectionRange",
      labelData: { mode: modeLabel },
      modes: ["add", "override"],
      valueType: "number",
      phase: "final",
    };
  }
  return targets;
}

/** Static groups (saves and token groups are appended in getAeTargetGroups). */
function staticGroups() {
  const abilities = {};
  for (const key of ABILITY_KEYS) {
    const K = key.toUpperCase();
    abilities[`system.abilities.${key}.value`] = {
      label: "WWN.Effects.AbilityValue",
      labelData: { ability: K },
      modes: ["add", "override"],
      valueType: "number",
      phase: "initial",
      actorTypes: ["character", "pc"],
    };
    abilities[`system.abilities.${key}.baseMod`] = {
      label: "WWN.Effects.AbilityBaseMod",
      labelData: { ability: K },
      modes: ["add"],
      valueType: "number",
      phase: "initial",
      actorTypes: ["character", "pc"],
    };
    abilities[`system.abilities.${key}.mod`] = {
      label: "WWN.Effects.AbilityMod",
      labelData: { ability: K },
      modes: ["add", "override"],
      valueType: "number",
      phase: "final",
      actorTypes: ["character", "pc"],
    };
  }

  return {
    combat: {
      label: "WWN.Effects.Groups.Combat",
      targets: {
        "system.combat.ac.mod": { label: "WWN.Effects.ArmorClassAll", modes: ["add"], valueType: "number", phase: "initial" },
        "system.combat.ac.melee.mod": { label: "WWN.Effects.ArmorClassMelee", modes: ["add"], valueType: "number", phase: "initial" },
        "system.combat.ac.ranged.mod": { label: "WWN.Effects.ArmorClassRanged", modes: ["add"], valueType: "number", phase: "initial", setting: "separateRangedAC" },
        "system.combat.abMod": {
          label: "WWN.Effects.AttackBonusBase",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          actorTypes: ["character", "pc"],
        },
        "system.combat.allAttack": { label: "WWN.Effects.AttackAll", modes: ["add"], valueType: "number", phase: "final" },
        "system.combat.meleeAttack": { label: "WWN.Effects.AttackMelee", modes: ["add"], valueType: "number", phase: "final" },
        "system.combat.rangeAttack": { label: "WWN.Effects.AttackRanged", modes: ["add"], valueType: "number", phase: "final" },
        "system.combat.allDamage": { label: "WWN.Effects.DamageAll", modes: ["add"], valueType: "formula", phase: "final" },
        "system.combat.meleeDamage": { label: "WWN.Effects.DamageMelee", modes: ["add"], valueType: "formula", phase: "final" },
        "system.combat.rangeDamage": { label: "WWN.Effects.DamageRanged", modes: ["add"], valueType: "formula", phase: "final" },
        "system.combat.allShock": { label: "WWN.Effects.ShockAll", modes: ["add"], valueType: "formula", phase: "final" },
        "system.combat.meleeShock": { label: "WWN.Effects.ShockMelee", modes: ["add"], valueType: "formula", phase: "final" },
        "system.combat.rangeShock": { label: "WWN.Effects.ShockRanged", modes: ["add"], valueType: "formula", phase: "final" },
        "system.combat.initiative.individual.roll": {
          label: "WWN.Effects.InitiativeIndividualDie",
          modes: ["override"],
          valueType: "dice",
          phase: "initial",
        },
        "system.combat.initiative.individual.mod": {
          label: "WWN.Effects.InitiativeIndividualMod",
          modes: ["add"],
          valueType: "number",
          phase: "initial",
        },
        "system.combat.initiative.group.roll": {
          label: "WWN.Effects.InitiativeGroupDie",
          modes: ["override"],
          valueType: "dice",
          phase: "initial",
        },
        "system.combat.initiative.group.mod": {
          label: "WWN.Effects.InitiativeGroupMod",
          modes: ["add"],
          valueType: "number",
          phase: "initial",
        },
        "system.hitDice.staticMod": { label: "WWN.Effects.MaxHpOneTime", modes: ["add"], valueType: "number", phase: "final", actorTypes: ["character", "pc"] },
        "system.hitDice.perLevelMod": { label: "WWN.Effects.MaxHpPerLevel", modes: ["add"], valueType: "number", phase: "final", actorTypes: ["character", "pc"] },
        "system.skills.floor": { label: "WWN.Effects.SkillFloor", modes: ["upgrade"], valueType: "formula", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.immuneToSurprise": { label: "WWN.Effects.ImmuneToSurprise", modes: ["override"], valueType: "string", phase: "initial", actorTypes: ["character", "pc"] },
        "system.combat.treatAllMeleeAsAcTen": { label: "WWN.Effects.TreatAllMeleeAsAcTen", modes: ["override"], valueType: "string", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.immuneToShock": { label: "WWN.Effects.ImmuneToShock", modes: ["override"], valueType: "string", phase: "final" },
        "system.combat.innateAc.min": { label: "WWN.Effects.InnateAcMin", modes: ["upgrade"], valueType: "formula", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.autoStabilize": { label: "WWN.Effects.AutoStabilize", modes: ["override"], valueType: "string", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.meleeCountsAsTl4": { label: "WWN.Effects.MeleeCountsAsTl4", modes: ["override"], valueType: "string", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.meleeMissDamage": { label: "WWN.Effects.MeleeMissDamage", modes: ["override"], valueType: "dice", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.rangeMissDamage": { label: "WWN.Effects.RangeMissDamage", modes: ["override"], valueType: "dice", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.punchMissDamage": { label: "WWN.Effects.PunchMissDamage", modes: ["override"], valueType: "dice", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.immuneToPrimitiveWeapons": { label: "WWN.Effects.ImmuneToPrimitiveWeapons", modes: ["override"], valueType: "string", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.endOfTurnAdjacentShock": { label: "WWN.Effects.EndOfTurnAdjacentShock", modes: ["override"], valueType: "string", phase: "final", actorTypes: ["character", "pc"] },
        "system.combat.missAfterFirstMeleeHit": { label: "WWN.Effects.MissAfterFirstMeleeHit", modes: ["override"], valueType: "string", phase: "final", actorTypes: ["character", "pc"] },
        "system.starship.commandPointsBonus": { label: "WWN.Effects.StarshipCommandPointsBonus", modes: ["add"], valueType: "number", phase: "final", actorTypes: ["character", "pc"] },
        "system.starship.combatBonusHpPercent": { label: "WWN.Effects.StarshipCombatBonusHpPercent", modes: ["add", "override"], valueType: "number", phase: "final", actorTypes: ["character", "pc"] },
        "system.starship.spikeDrillAutoSucceedDiff": { label: "WWN.Effects.SpikeDrillAutoSucceedDiff", modes: ["upgrade", "override"], valueType: "number", phase: "final", actorTypes: ["character", "pc"] },
        "system.starship.spikeDrillDoublePilot": { label: "WWN.Effects.SpikeDrillDoublePilot", modes: ["override"], valueType: "string", phase: "final", actorTypes: ["character", "pc"] },
        "system.starship.spikeDriveLevelBonus": { label: "WWN.Effects.SpikeDriveLevelBonus", modes: ["add"], valueType: "number", phase: "final", actorTypes: ["character", "pc"] },
      },
    },
    abilities: {
      label: "WWN.Effects.Groups.Abilities",
      targets: abilities,
    },
    movement: {
      label: "WWN.Effects.Groups.Movement",
      targets: {
        "system.movement.base.value": { label: "WWN.Effects.MovementBase", modes: ["add", "override"], valueType: "number", phase: "initial" },
        "system.movement.bonus": { label: "WWN.Effects.MovementBonus", modes: ["add"], valueType: "number", phase: "initial" },
        "system.movement.combat": { label: "WWN.Effects.MovementCombat", modes: ["add", "override"], valueType: "number", phase: "final" },
        "system.movement.exploration": { label: "WWN.Effects.MovementExploration", modes: ["add", "override"], valueType: "number", phase: "final" },
        "system.movement.daily": { label: "WWN.Effects.MovementDaily", modes: ["add", "override"], valueType: "number", phase: "final" },
      },
    },
    trackers: {
      label: "WWN.Effects.Groups.Trackers",
      targets: {
        "system.strain.max": { label: "WWN.Effects.StrainMax", modes: ["add"], valueType: "number", phase: "final" },
        "system.trauma.targetMod": {
          label: "WWN.Effects.TraumaTargetMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          setting: "useTrauma",
        },
      },
    },
  };
}

/**
 * Build the complete grouped registry, including per-save targets from the
 * active save set.
 * @returns {Record<string, {label: string, targets: Record<string, object>}>}
 */
export function getAeTargetGroups() {
  const groups = staticGroups();
  const saveSetKey = game.settings?.get("wwn", "saveSet") ?? "wwn";
  const saveSet = CONFIG.WWN.saveSets[saveSetKey] ?? CONFIG.WWN.saveSets.wwn;
  const saveTargets = {
    "system.saves.base.mod": { label: "WWN.Effects.SaveBaseMod", modes: ["add"], valueType: "number", phase: "initial" },
  };
  for (const [id, save] of Object.entries(saveSet.saves)) {
    saveTargets[`system.saves.${id}.mod`] = {
      label: "WWN.Effects.SaveMod",
      labelData: { save: game.i18n?.localize(save.label) ?? id },
      modes: ["add"],
      valueType: "number",
      phase: "initial",
    };
  }
  groups.saves = { label: "WWN.Effects.Groups.Saves", targets: saveTargets };
  groups.tokenSight = { label: "WWN.Effects.Groups.TokenSight", targets: buildTokenSightTargets() };
  groups.tokenLight = { label: "WWN.Effects.Groups.TokenLight", targets: buildTokenLightTargets() };
  const detectionTargets = buildTokenDetectionTargets();
  if (Object.keys(detectionTargets).length) {
    groups.tokenDetection = { label: "WWN.Effects.Groups.TokenDetection", targets: detectionTargets };
  }
  return groups;
}

/**
 * Flattened registry: data path -> target descriptor.
 * @returns {Record<string, object>}
 */
export function getAeTargets() {
  const flat = {};
  for (const group of Object.values(getAeTargetGroups())) {
    Object.assign(flat, group.targets);
  }
  return flat;
}

/**
 * Filtered groups for the editor dropdown.
 * @param {object} [options]
 * @param {string} [options.actorType]  Filter out targets not valid for this actor type.
 * @returns {Record<string, {label: string, targets: Record<string, object>}>}
 */
export function getFilteredAeTargetGroups({ actorType } = {}) {
  const groups = getAeTargetGroups();
  const filtered = {};
  for (const [groupId, group] of Object.entries(groups)) {
    const targets = {};
    for (const [path, target] of Object.entries(group.targets)) {
      if (target.setting && !game.settings.get("wwn", target.setting)) continue;
      if (actorType && target.actorTypes && !target.actorTypes.includes(actorType)) continue;
      targets[path] = target;
    }
    if (Object.keys(targets).length) filtered[groupId] = { label: group.label, targets };
  }
  return filtered;
}

/** Localized label for a single registry target. */
export function localizeAeTarget(target) {
  return game.i18n.format(target.label, target.labelData ?? {});
}
