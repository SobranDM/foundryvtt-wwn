import {
  POWER_SUBTYPES,
  POWER_SECTION_ORDER,
  COMMITMENT_LENGTHS,
  INTERNAL_USE_REFRESH_LENGTHS,
  getPowerSheetVisibility,
  applySubtypeDefaults,
  resolveCommitmentOptions,
  ensureCommitmentOptions,
  coerceCommitmentOptionsArray,
  usesSharedPool,
  hasSceneOrDayCommitment,
  hasActiveCommitment,
  EFFECT_APPLICATION_CHOICES,
} from "./power-subtypes.mjs";
import { THEMES } from "./themes.mjs";
import { getAeTargetGroups, getAeTargets, getFilteredAeTargetGroups, localizeAeTarget } from "./ae-targets.mjs";
import {
  getItemAeTargetGroups,
  getItemAeTargets,
  getFilteredItemAeTargetGroups,
  localizeItemAeTarget,
} from "./ae-item-targets.mjs";
import { ATTACK_PROGRESSIONS, ATTACK_PROGRESSION_MODES } from "./attack-progression.mjs";

export const WWN = {};

/* -------------------------------------------- */
/*  Abilities                                   */
/* -------------------------------------------- */

WWN.abilities = {
  str: "WWN.Ability.Str.long",
  dex: "WWN.Ability.Dex.long",
  con: "WWN.Ability.Con.long",
  int: "WWN.Ability.Int.long",
  wis: "WWN.Ability.Wis.long",
  cha: "WWN.Ability.Cha.long",
};

WWN.abilityAbbreviations = {
  str: "WWN.Ability.Str.abbr",
  dex: "WWN.Ability.Dex.abbr",
  con: "WWN.Ability.Con.abbr",
  int: "WWN.Ability.Int.abbr",
  wis: "WWN.Ability.Wis.abbr",
  cha: "WWN.Ability.Cha.abbr",
};

/** Attribute modifier tables, keyed by the attributeModType setting. */
WWN.modifierTables = {
  wwn: { 0: -2, 3: -2, 4: -1, 8: 0, 14: 1, 18: 2 },
  bx: { 0: -3, 4: -2, 6: -1, 9: 0, 13: 1, 16: 2, 18: 3 },
};

/* -------------------------------------------- */
/*  Save sets                                   */
/* -------------------------------------------- */

/**
 * Save set registry. Each set defines save keys, labels, the ability pair
 * whose best modifier reduces the target, and a derivation mode.
 *
 * derivation "wwn": value = base + baseMod + saveMod − bestPairMod − level
 * derivation "godbound": value = base + baseMod + saveMod − bestPairMod
 */
WWN.saveSets = {
  wwn: {
    label: "WWN.SaveSet.wwn",
    base: 16,
    npcBase: 15,
    derivation: "wwn",
    saves: {
      physical: { label: "WWN.Save.physical", pair: ["str", "con"] },
      evasion: { label: "WWN.Save.evasion", pair: ["dex", "int"] },
      mental: { label: "WWN.Save.mental", pair: ["wis", "cha"] },
      luck: { label: "WWN.Save.luck", pair: [] },
    },
  },
  godbound: {
    label: "WWN.SaveSet.godbound",
    base: 15,
    npcBase: 15,
    derivation: "godbound",
    saves: {
      hardiness: { label: "WWN.Save.hardiness", pair: ["str", "con"] },
      evasion: { label: "WWN.Save.evasion", pair: ["dex", "int"] },
      spirit: { label: "WWN.Save.spirit", pair: ["wis", "cha"] },
    },
  },
};

/* -------------------------------------------- */
/*  Header trackers                             */
/* -------------------------------------------- */

/**
 * Universal header tracker registry. Filtered at render time by setting.
 * mode "positive": full bar is good (HP). mode "negative": rising value is
 * bad (Strain/Alienation/Stress) — bar fills as value rises.
 */
WWN.headerTrackers = [
  { id: "hp", path: "hp", label: "WWN.Tracker.HP", mode: "positive", always: true, ceiling: "max", editableMax: true },
  { id: "strain", path: "strain", label: "WWN.Tracker.Strain", mode: "negative", always: true, ceiling: "max" },
  { id: "alienation", path: "alienation", label: "WWN.Tracker.Alienation", mode: "negative", setting: "useAlienation", ceiling: "valueMax" },
  { id: "stress", path: "stress", label: "WWN.Tracker.Stress", mode: "negative", setting: "useStress", ceiling: "valueMax" },
];

/* -------------------------------------------- */
/*  Skills                                      */
/* -------------------------------------------- */

/** Core WWN skill list used to auto-seed new PCs. */
WWN.coreSkills = [
  "administer", "connect", "convince", "craft", "exert", "heal", "know",
  "lead", "magic", "notice", "perform", "pray", "punch", "ride", "sail",
  "shoot", "sneak", "stab", "survive", "trade", "work",
];

/** Secondary (psychic) skills — created only on demand. */
WWN.psychicSkills = [
  "biopsionics", "metapsionics", "precognition", "telekinesis", "telepathy", "teleportation",
];

/** Combat skills are exempt from the skills.floor (Polymath) derivation. */
WWN.combatSkills = ["stab", "shoot", "punch"];

/** Skill dice options. */
WWN.skillDice = ["2d6", "3d6kh2", "4d6kh2"];

/* -------------------------------------------- */
/*  Powers                                      */
/* -------------------------------------------- */

WWN.powerSubtypes = POWER_SUBTYPES;
WWN.powerSectionOrder = POWER_SECTION_ORDER;
WWN.getPowerSheetVisibility = getPowerSheetVisibility;
WWN.applyPowerSubtypeDefaults = applySubtypeDefaults;
WWN.resolveCommitmentOptions = resolveCommitmentOptions;
WWN.ensureCommitmentOptions = ensureCommitmentOptions;
WWN.coerceCommitmentOptionsArray = coerceCommitmentOptionsArray;
WWN.usesSharedPool = usesSharedPool;
WWN.hasSceneOrDayCommitment = hasSceneOrDayCommitment;
WWN.hasActiveCommitment = hasActiveCommitment;
WWN.effectApplicationChoices = EFFECT_APPLICATION_CHOICES;
/** Commitment choices for power commitmentOptions (shared pool tiers). */
WWN.commitmentLengths = COMMITMENT_LENGTHS;
/** Scene/day refresh for per-power use limits (internalResource). */
WWN.internalUseRefreshLengths = INTERNAL_USE_REFRESH_LENGTHS;
/** Focus and other items that use resourceLength without "user". */
WWN.commitmentLengthsNoUser = COMMITMENT_LENGTHS;

/** Fixed pool name for leveled spell slot derivation (not configurable on Class/Edge). */
WWN.SPELL_SLOTS_POOL_NAME = "Spell Slots";

WWN.attackProgressions = ATTACK_PROGRESSIONS;
WWN.attackProgressionModes = ATTACK_PROGRESSION_MODES;

/* -------------------------------------------- */
/*  Items                                       */
/* -------------------------------------------- */

WWN.armorTypes = {
  light: "WWN.Armor.light",
  medium: "WWN.Armor.medium",
  heavy: "WWN.Armor.heavy",
  shield: "WWN.Armor.shield",
};

WWN.weightlessOptions = {
  "": "WWN.Item.WeightlessNever",
  whenReadied: "WWN.Item.WeightlessReadied",
  whenStowed: "WWN.Item.WeightlessStowed",
};

WWN.ammoModes = {
  none: "WWN.Weapon.AmmoModeNone",
  linked: "WWN.Weapon.AmmoModeLinked",
  magazine: "WWN.Weapon.AmmoModeMagazine",
};

WWN.favoritableTypes = ["weapon", "power", "item"];

WWN.hitDiceOptions = ["d4", "d6", "d8", "d10", "d12", "d20"];

/** Default item icons by type. */
WWN.defaultIcons = {
  weapon: "icons/svg/sword.svg",
  armor: "icons/svg/shield.svg",
  skill: "icons/svg/book.svg",
  power: "icons/svg/lightning.svg",
  classEdge: "icons/svg/upgrade.svg",
  focus: "icons/svg/eye.svg",
  currency: "icons/svg/coins.svg",
  item: "icons/svg/item-bag.svg",
};

/* -------------------------------------------- */
/*  Currency sets                               */
/* -------------------------------------------- */

/** Built-in currency sets used to seed new PCs (wwn.defaultCurrencySet). */
WWN.currencySets = {
  silver: [
    { name: "WWN.Currency.Copper", multiplier: 0.1, perSlot: 100 },
    { name: "WWN.Currency.Silver", multiplier: 1, perSlot: 100 },
    { name: "WWN.Currency.Gold", multiplier: 10, perSlot: 100 },
  ],
  gold: [
    { name: "WWN.Currency.Copper", multiplier: 0.01, perSlot: 100 },
    { name: "WWN.Currency.Silver", multiplier: 0.1, perSlot: 100 },
    { name: "WWN.Currency.Electrum", multiplier: 0.5, perSlot: 100 },
    { name: "WWN.Currency.Gold", multiplier: 1, perSlot: 100 },
    { name: "WWN.Currency.Platinum", multiplier: 5, perSlot: 100 },
  ],
  credits: [
    { name: "WWN.Currency.Credits", multiplier: 1, perSlot: 0 },
  ],
};

/* -------------------------------------------- */
/*  Movement / XP                               */
/* -------------------------------------------- */

WWN.movementRates = {
  movewwn: [30, 20, 15],
  movebx: [40, 30, 20],
};

WWN.xpRates = {
  xpSlow: [6, 15, 24, 36, 51, 69, 87, 105, 139],
  xpFast: [3, 6, 12, 18, 27, 39, 54, 72, 93],
};

/* -------------------------------------------- */
/*  Sheet infrastructure                        */
/* -------------------------------------------- */

WWN.defaultCollapsedSections = {
  "inventory.containers": true,
  "inventory.currency": true,
};

WWN.themes = THEMES;

/* AE target registry helpers */
WWN.getAeTargetGroups = getAeTargetGroups;
WWN.getAeTargets = getAeTargets;
WWN.getFilteredAeTargetGroups = getFilteredAeTargetGroups;
WWN.localizeAeTarget = localizeAeTarget;

/* Item-local AE target registry helpers */
WWN.getItemAeTargetGroups = getItemAeTargetGroups;
WWN.getItemAeTargets = getItemAeTargets;
WWN.getFilteredItemAeTargetGroups = getFilteredItemAeTargetGroups;
WWN.localizeItemAeTarget = localizeItemAeTarget;
