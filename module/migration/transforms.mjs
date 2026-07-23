/**
 * Pure WWN -> WWN data transforms, shared by world migration and the
 * compendium conversion tooling. Each function takes plain object data
 * (toObject() output or pack JSON) and returns transformed plain data.
 */
import { mergeWeaponFavorites } from "../helpers/favorites.mjs";
import { applyFocusBonusSkillSeed, seedFocusAutomationEffects } from "../helpers/focus-automation-seeds.mjs";

import { remapAssetPath } from "./asset-map.mjs";
import { normalizeInternalResourceLength } from "../config/power-subtypes.mjs";
import { mapWeaponAmmoMigration } from "../helpers/ammo.mjs";

const MODE_TO_TYPE = { 0: "custom", 1: "multiply", 2: "add", 3: "downgrade", 4: "upgrade", 5: "override" };

/** Legacy `weightless: "never"` → blank (current schema choice). */
export function normalizeWeightless(value) {
  if (value === "never" || value == null) return "";
  if (value === "whenReadied" || value === "whenStowed" || value === "") return value;
  return "";
}

/** Legacy armor type / shield flag → current choices. */
export function normalizeArmorType(system = {}) {
  if (system.isShield) return "shield";
  if (system.type === "unarmored") return "light";
  if (["light", "medium", "heavy", "shield"].includes(system.type)) return system.type;
  return "light";
}

/** Attack progression base values for AB residual migration (mirrors attack-progression.mjs). */
function abProgressionBase(key, level) {
  const lv = Math.max(level, 1);
  switch (key) {
    case "warrior":
      return lv;
    case "expert":
      return Math.floor(lv / 2);
    case "mage":
      return Math.floor(lv / 5);
    case "partialWarrior":
      return Math.floor(lv / 2) + Math.ceil(lv / 4);
    default:
      return 0;
  }
}

/**
 * Migrate persisted combat.ab on WWN PCs to combat.abMod (residual offset).
 * @param {object} system
 * @param {{ warrior?: boolean }} [options]
 * @returns {{ combat: { abMod: number } } | null}
 */
export function migratePcCombatAb(system, { warrior = false } = {}) {
  if (system?.combat?.abMod !== undefined) return null;
  const level = Math.max(system.details?.level ?? 1, 1);
  const oldAb = Number(system.combat?.ab) || 0;
  const baseKey = warrior ? "warrior" : "expert";
  return { combat: { abMod: oldAb - abProgressionBase(baseKey, level) } };
}

/** Remap item-local AE keys that target persisted bases instead of mod buckets. */
const ITEM_LOCAL_EFFECT_KEYS = {
  "system.bonus": "system.bonusMod",
  "system.ac": "system.acMod",
  "system.acRanged": "system.acRangedMod",
  "system.mod": "system.modMod",
  "system.soak": "system.soakMod",
  "system.traumaTarget": "system.traumaTargetMod",
  "system.trauma.rating": "system.trauma.ratingMod",
  "system.shock.ac": "system.shock.acMod",
  "system.charges.max": "system.charges.maxMod",
};

/** Remap legacy AE keys on non-transfer item effects to *Mod buckets. */
export function remapItemLocalEffectKeys(effectData) {
  if (effectData.transfer !== false) return effectData;
  const out = foundry.utils.deepClone(effectData);
  const changes = out.system?.changes ?? out.changes ?? [];
  let touched = false;
  for (const change of changes) {
    const mapped = ITEM_LOCAL_EFFECT_KEYS[change.key];
    if (mapped) {
      change.key = mapped;
      touched = true;
    }
  }
  return touched ? out : effectData;
}

/** Remap legacy AE keys targeting combat.ab to combat.abMod. */
export function remapCombatAbEffect(effectData) {
  const out = foundry.utils.deepClone(effectData);
  const changes = out.system?.changes ?? out.changes ?? [];
  let touched = false;
  for (const change of changes) {
    if (change.key === "system.combat.ab") {
      change.key = "system.combat.abMod";
      touched = true;
    }
  }
  return touched ? out : effectData;
}

const TIME_TO_COMMITMENT = { commit: "active", scene: "scene", day: "day" };

/** WWN silver-standard currency definitions used by currency conversion. */
export const WWN_CURRENCIES = [
  { key: "cp", name: "Copper", multiplier: 0.1, perSlot: 100 },
  { key: "sp", name: "Silver", multiplier: 1, perSlot: 100, base: true },
  { key: "ep", name: "Electrum", multiplier: 5, perSlot: 100 },
  { key: "gp", name: "Gold", multiplier: 10, perSlot: 100 },
  { key: "pp", name: "Platinum", multiplier: 50, perSlot: 100 },
];

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/** Parse a WWN hp.hd string like "1d6+1" -> { die, perLevelMod } (or null). */
export function parseHdString(hd) {
  const match = String(hd ?? "").trim().match(/^\d*d(\d+)\s*([+-]\s*\d+)?$/i);
  if (!match) return null;
  return {
    die: `d${match[1]}`,
    perLevelMod: match[2] ? parseInt(match[2].replace(/\s/g, "")) : 0,
  };
}

/** Map a WWN AE change key to its WWN equivalent (null = unmappable). */
export function remapEffectKey(key) {
  if (!key) return null;
  const direct = {
    "system.aac.mod": "system.combat.ac.mod",
    "system.initiative.mod": "system.combat.initiative.individual.mod",
    "system.combat.initiative.roll": "system.combat.initiative.individual.roll",
    "system.combat.initiative.mod": "system.combat.initiative.individual.mod",
    "system.movement.bonus": "system.movement.bonus",
    "system.trauma.bonus": "system.trauma.targetMod",
    "system.trauma.targetBonus": "system.trauma.targetMod",
    "system.thac0.bba": "system.combat.abMod",
    "system.combat.ab": "system.combat.abMod",
  };
  if (key in direct) return direct[key];
  let m = key.match(/^system\.scores\.(\w+)\.(bonus|tweak|mod)$/);
  if (m) return `system.abilities.${m[1]}.baseMod`;
  m = key.match(/^system\.scores\.(\w+)\.value$/);
  if (m) return `system.abilities.${m[1]}.value`;
  m = key.match(/^system\.saves\.baseSave\.mod$/);
  if (m) return "system.saves.base.mod";
  m = key.match(/^system\.saves\.(\w+)\.mod$/);
  if (m) return `system.saves.${m[1]}.mod`;
  return null;
}

/** Convert a v13 effect to v14 system.changes shape with remapped keys. */
export function migrateEffectData(effectData) {
  const out = foundry.utils.deepClone(effectData);
  const legacyChanges = out.changes ?? out.system?.changes ?? [];
  const changes = [];
  for (const change of legacyChanges) {
    const key = remapEffectKey(change.key) ?? change.key;
    let type = change.type;
    if (!type && change.mode !== undefined) type = MODE_TO_TYPE[change.mode] ?? "add";
    changes.push({
      key,
      type: type ?? "add",
      value: change.value,
      phase: change.phase ?? "initial",
      priority: change.priority ?? null,
    });
  }
  delete out.changes;
  out.system = { ...(out.system ?? {}), changes };
  if (out.icon && !out.img) {
    out.img = out.icon;
    delete out.icon;
  }
  return remapItemLocalEffectKeys(out);
}

/* -------------------------------------------- */
/*  Item transforms (M2-M5b)                    */
/* -------------------------------------------- */

export function migrateArtToPower(item) {
  const s = item.system ?? {};
  const time = String(s.time ?? "scene").toLowerCase();
  return {
    _id: item._id,
    name: item.name,
    type: "power",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      subType: "art",
      description: s.description ?? "",
      source: s.source ?? "",
      resourceName: "Effort",
      commitmentOptions: [{ cost: 1, length: TIME_TO_COMMITMENT[time] ?? "scene", note: "" }],
      poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
      internalResource: { value: Number(s.effort) || 0, max: 0 },
      internalResourceLength: "scene",
      activation: {
        roll: s.roll ?? "",
        rollType: s.rollType ?? "result",
        rollTarget: Number(s.rollTarget) || 0,
        save: s.save ?? "",
        range: s.range ?? "",
        duration: "",
      },
    },
  };
}

export function migrateSpellToPower(item) {
  const s = item.system ?? {};
  return {
    _id: item._id,
    name: item.name,
    type: "power",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      subType: "spell",
      description: s.description ?? "",
      source: s.class ?? "",
      resourceName: "Spell Slots",
      commitmentOptions: [{ cost: 1, length: "day", note: "" }],
      poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
      internalResource: { value: Number(s.cast) || 0, max: 0 },
      internalResourceLength: "scene",
      level: Number(s.lvl) || 1,
      prepared: !!s.prepared,
      activation: {
        roll: s.roll ?? "",
        rollType: "result",
        rollTarget: 0,
        save: s.save ?? "",
        range: s.range ?? "",
        duration: s.duration ?? "",
      },
    },
  };
}

export function migrateAbilityToPower(item) {
  const s = item.system ?? {};
  return {
    _id: item._id,
    name: item.name,
    type: "power",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      subType: "ability",
      description: s.description ?? "",
      commitmentOptions: [{ cost: 0, length: "none", note: "" }],
      poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      activation: {
        roll: s.roll ?? "",
        rollType: s.rollType ?? "result",
        rollTarget: Number(s.rollTarget) || 0,
        save: s.save ?? "",
        range: "",
        duration: "",
      },
    },
  };
}

/** Known-foci AE seeding: one-time name matching during migration only. */
export function migrateFocus(item) {
  const s = item.system ?? {};
  const FLAG = "wwn";
  const out = {
    _id: item._id,
    name: item.name,
    type: "focus",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      description: s.description ?? "",
      ownedLevel: Number(s.ownedLevel) || 1,
      resourceGrant: s.resourceGrant ?? { targetName: "", targetSource: "", bonusMax: 0 },
      internalResource: s.internalResource ?? { value: 0, max: 0 },
      resourceLength: s.resourceLength ?? "none",
      bonusSkills: Array.isArray(s.bonusSkills) ? [...s.bonusSkills] : [],
      bonusSkillsPick: Number(s.bonusSkillsPick) || 0,
      bonusSkillsChosen: s.bonusSkillsChosen ?? [],
      bonusDice: s.bonusDice ?? null,
      skillBonus: s.skillBonus ?? "",
    },
  };

  const name = item.name.toLowerCase();
  const ownedLevel = Number(s.ownedLevel) || 1;
  const hasSeeded = (predicate) => out.effects.some(predicate);
  const seed = (changes, { effectName, focusLevel, skipFocusLevelSync = false, disabled } = {}) => {
    if (
      hasSeeded((e) => {
        if (focusLevel != null && e.flags?.[FLAG]?.focusLevel === focusLevel && e.name === (effectName ?? item.name)) {
          return true;
        }
        if (effectName && e.name === effectName) return true;
        return false;
      })
    ) {
      return;
    }
    const effectId = foundry.utils.randomID();
    const parentId = item._id ?? out._id;
    const isDisabled =
      disabled ??
      (skipFocusLevelSync ? true : focusLevel != null ? ownedLevel < focusLevel : false);
    const data = {
      _id: effectId,
      type: "base",
      name: effectName ?? item.name,
      img: item.img ?? "icons/svg/aura.svg",
      transfer: true,
      disabled: isDisabled,
      system: { changes },
      flags: { [FLAG]: {} },
    };
    if (parentId) data._key = `!items.effects!${parentId}.${effectId}`;
    if (focusLevel != null) data.flags[FLAG].focusLevel = focusLevel;
    if (skipFocusLevelSync) data.flags[FLAG].skipFocusLevelSync = true;
    out.effects.push(data);
  };

  if (name === "alert") {
    seed(
      [
        { key: "system.combat.initiative.individual.roll", type: "override", value: "2d8kh", phase: "initial" },
        { key: "system.combat.initiative.group.mod", type: "add", value: 1, phase: "initial" },
        { key: "system.combat.immuneToSurprise", type: "override", value: "true", phase: "initial" },
      ],
      { effectName: "Alert (Level 1)", focusLevel: 1 }
    );
    seed(
      [
        { key: "system.combat.initiative.individual.mod", type: "add", value: 100, phase: "initial" },
        { key: "system.combat.initiative.group.mod", type: "add", value: 100, phase: "initial" },
      ],
      { effectName: "Alert (Level 2)", focusLevel: 2 }
    );
    if (!out.system.bonusSkills.length) {
      out.system.bonusSkills = ["notice"];
      out.system.bonusSkillsPick = 1;
    }
  } else if (name === "armsmaster") {
    seed(
      [
        { key: "system.combat.meleeDamage", type: "add", value: "@stab", phase: "final" },
        { key: "system.combat.meleeShock", type: "add", value: "@stab", phase: "final" },
      ],
      { effectName: "Armsmaster (Level 1)", focusLevel: 1 }
    );
    seed(
      [
        { key: "system.combat.treatAllMeleeAsAcTen", type: "override", value: "true", phase: "final" },
        { key: "system.combat.meleeAttack", type: "add", value: 1, phase: "final" },
      ],
      { effectName: "Armsmaster (Level 2)", focusLevel: 2 }
    );
    if (!out.system.bonusSkills.length) {
      out.system.bonusSkills = ["stab"];
      out.system.bonusSkillsPick = 1;
    }
  } else if (name === "close combatant") {
    seed([{ key: "system.combat.immuneToShock", type: "override", value: "true", phase: "final" }], {
      effectName: "Close Combatant (Level 1)",
      focusLevel: 1,
    });
    seed([{ key: "system.combat.treatAllMeleeAsAcTen", type: "override", value: "true", phase: "final" }], {
      effectName: "Close Combatant (Level 2)",
      focusLevel: 2,
    });
    if (!out.system.bonusSkills.length) {
      out.system.bonusSkills = ["stab", "punch", "shoot"];
      out.system.bonusSkillsPick = 1;
    }
  } else if (name === "deadeye") {
    seed([{ key: "system.combat.rangeDamage", type: "add", value: "@shoot", phase: "final" }], {
      effectName: "Deadeye (Level 1)",
      focusLevel: 1,
    });
    if (!out.system.bonusSkills.length) {
      out.system.bonusSkills = ["shoot"];
      out.system.bonusSkillsPick = 1;
    }
  } else if (name === "die hard") {
    seed([{ key: "system.hitDice.perLevelMod", type: "add", value: 2, phase: "final" }], {
      effectName: "Die Hard (Level 1)",
      focusLevel: 1,
    });
  } else if (name === "impervious defense") {
    seed([{ key: "system.combat.innateAc.min", type: "upgrade", value: "@halfLevel + 15", phase: "final" }], {
      effectName: "Impervious Defense (Level 1)",
      focusLevel: 1,
    });
    if (!out.system.internalResource?.max) {
      out.system.internalResource = { value: 0, max: 1 };
      out.system.resourceLength = "day";
    }
  } else if (name === "shocking assault") {
    seed([{ key: "system.combat.treatAllMeleeAsAcTen", type: "override", value: "true", phase: "final" }], {
      effectName: "Shocking Assault (Level 1)",
      focusLevel: 1,
    });
    seed([{ key: "system.combat.meleeShock", type: "add", value: 2, phase: "final" }], {
      effectName: "Shocking Assault (Level 2)",
      focusLevel: 2,
    });
    if (!out.system.bonusSkills.length) {
      out.system.bonusSkills = ["stab", "punch"];
      out.system.bonusSkillsPick = 1;
    }
  } else if (name === "polymath") {
    if (!hasSeeded((e) => (e.system?.changes ?? []).some((c) => c.key === "system.skills.floor"))) {
      seed([{ key: "system.skills.floor", type: "upgrade", value: "@item.ownedLevel - 1", phase: "final" }], {
        effectName: "Polymath",
      });
    }
  } else if (name === "developed attribute") {
    const attrs = [
      ["str", "Strength"],
      ["dex", "Dexterity"],
      ["con", "Constitution"],
      ["int", "Intelligence"],
      ["wis", "Wisdom"],
      ["cha", "Charisma"],
    ];
    for (const [key, label] of attrs) {
      seed([{ key: `system.abilities.${key}.baseMod`, type: "add", value: 1, phase: "initial" }], {
        effectName: `Developed Attribute (${label})`,
        skipFocusLevelSync: true,
        disabled: true,
      });
    }
  } else if (name === "vigilant") {
    if (!hasSeeded((e) => (e.system?.changes ?? []).some((c) => c.key === "system.combat.initiative.individual.mod"))) {
      seed([{ key: "system.combat.initiative.individual.mod", type: "add", value: 100, phase: "initial" }]);
    }
  }

  applyFocusBonusSkillSeed(out.system, item.name);
  seedFocusAutomationEffects(item.name, seed);
  return out;
}

export function migrateWeapon(item) {
  const s = item.system ?? {};
  const tags = (s.tags ?? []).map((t) => (typeof t === "string" ? t : t.value ?? t.title ?? "")).filter((t) => t);
  return {
    _id: item._id,
    name: item.name,
    type: "weapon",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      description: s.description ?? "",
      damage: s.damage ?? "1d6",
      bonus: Number(s.bonus) || 0,
      skillDamage: !!s.skillDamage,
      shock: {
        damage: String(s.shock?.damage ?? ""),
        ac: Number(s.shock?.ac) || 15,
      },
      trauma: {
        die: s.trauma?.die ?? "1d6",
        rating: Number(s.trauma?.rating) || 2,
      },
      skillId: "",
      skillFallback: s.skill ?? "",
      score: s.score ?? "str",
      melee: s.melee !== false,
      missile: !!s.missile,
      slow: !!s.slow,
      burst: !!s.burst,
      range: {
        short: Number(s.range?.short) || 0,
        medium: Number(s.range?.medium) || 0,
        long: Number(s.range?.long) || 0,
      },
      save: s.save ?? "",
      tags,
      ...(() => {
        const ammo = mapWeaponAmmoMigration(s);
        return {
          ammoMode: ammo.ammoMode,
          ammoId: ammo.ammoId,
          ammoFallback: ammo.ammoFallback,
          charges: ammo.charges,
        };
      })(),
      counter: {
        value: Number(s.counter?.value ?? s.counter?.max) || 1,
        max: Number(s.counter?.max ?? s.counter?.value) || 1,
      },
      price: Number(s.price) || 0,
      weight: Number(s.weight) || 0,
      quantity: Number(s.quantity) || 1,
      equipped: !!s.equipped,
      stowed: !!s.stowed,
      weightless: normalizeWeightless(s.weightless),
      containerId: s.containerId ?? "",
    },
  };
}

export function migrateArmor(item) {
  const s = item.system ?? {};
  const ac = Number(s.aac?.value) || 10;
  return {
    _id: item._id,
    name: item.name,
    type: "armor",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      description: s.description ?? "",
      ac,
      acRanged: ac,
      mod: Number(s.aac?.mod) || 0,
      type: normalizeArmorType(s),
      soak: 0,
      traumaTarget: 6 + (Number(s.traumaMod) || 0),
      ashesHeavy: !!s.ashesHeavy,
      price: Number(s.price) || 0,
      weight: Number(s.weight) || 0,
      quantity: 1,
      equipped: !!s.equipped,
      stowed: !!s.stowed,
      weightless: normalizeWeightless(s.weightless),
      containerId: s.containerId ?? "",
    },
  };
}

export function migrateGear(item) {
  const s = item.system ?? {};
  return {
    _id: item._id,
    name: item.name,
    type: "item",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      description: s.description ?? "",
      price: Number(s.price) || 0,
      weight: Number(s.weight) || 0,
      quantity: Number(s.quantity) || 1,
      equipped: !!s.equipped,
      stowed: !!s.stowed,
      weightless: normalizeWeightless(s.weightless),
      containerId: s.containerId ?? "",
      treasure: !!s.treasure,
      charges: {
        value: Number(s.charges?.value) || 0,
        max: Number(s.charges?.max) || 0,
      },
      expendOnUse: !!s.expendOnUse,
      roll: s.roll ?? "",
      container: {
        isContainer: !!s.container?.isContainer,
        isOpen: s.container?.isOpen !== false,
      },
    },
  };
}

/** Add NPC per-round attack counter defaults to WWN weapons missing the field. */
export function repairWwnWeaponCounter(system) {
  if (!system) return null;
  const counter = system.counter;
  if (counter && Number.isFinite(counter.value) && Number.isFinite(counter.max)) return null;
  const max = Number(counter?.max ?? counter?.value) || 1;
  const value = Number.isFinite(Number(counter?.value)) ? Number(counter.value) : max;
  return { counter: { value, max } };
}

/**
 * Convert legacy decrementOnAttack / system.ammo into ammoMode + ammoFallback.
 * @returns {object|null} Partial system patch
 */
export function repairWwnWeaponAmmo(system) {
  if (!system) return null;
  const needs =
    system.ammoMode === undefined ||
    system.ammoFallback === undefined ||
    system.charges?.decrementOnAttack !== undefined ||
    typeof system.ammo === "string";
  if (!needs) return null;
  const mapped = mapWeaponAmmoMigration(system);
  return {
    ammoMode: mapped.ammoMode,
    ammoId: mapped.ammoId || system.ammoId || "",
    ammoFallback: mapped.ammoFallback,
    charges: mapped.charges,
  };
}

export function migrateSkill(item) {
  const s = item.system ?? {};
  return {
    _id: item._id,
    name: item.name,
    type: "skill",
    img: item.img,
    sort: item.sort,
    flags: item.flags ?? {},
    effects: (item.effects ?? []).map(migrateEffectData),
    system: {
      description: s.description ?? "",
      ownedLevel: Number.isFinite(Number(s.ownedLevel)) ? Number(s.ownedLevel) : -1,
      score: s.score ?? "int",
      skillDice: s.skillDice ?? "2d6",
      secondary: !!s.secondary,
      slug: item.name.slugify({ strict: true }).replace(/-/g, ""),
    },
  };
}

/**
 * Dispatch a WWN item to its transform; returns null for unsupported types
 * or items already in WWN shape (idempotency guards on discriminator fields).
 */
/** WWN armor: traumaTargetMod (additive) → traumaTarget (base, default 6). */
export function migrateWwnArmorTrauma(item) {
  if (item.type !== "armor") return null;
  const s = item.system ?? {};
  if (!Object.hasOwn(s, "traumaTargetMod")) return null;
  const traumaTarget = Object.hasOwn(s, "traumaTarget")
    ? Number(s.traumaTarget) || 6
    : 6 + (Number(s.traumaTargetMod) || 0);
  return {
    _id: item._id,
    system: {
      traumaTarget,
      "-=traumaTargetMod": null,
    },
  };
}

/**
 * Repair WWN power items with dev-era invalid fields (idempotent).
 * @param {object} system
 * @returns {object|null} Partial system patch, or null if nothing to fix.
 */
export function repairWwnPowerSystem(system) {
  if (!system) return null;
  const len = system.internalResourceLength;
  if (len === undefined || len === "scene" || len === "day") return null;
  return { internalResourceLength: normalizeInternalResourceLength(len) };
}

export function migrateItemData(item) {
  const s = item.system ?? {};
  let result;
  switch (item.type) {
    case "power": {
      const patch = repairWwnPowerSystem(s);
      result = patch ? { system: patch } : null;
      break;
    }
    case "art": result = migrateArtToPower(item); break;
    case "spell": result = migrateSpellToPower(item); break;
    case "ability": result = migrateAbilityToPower(item); break;
    case "focus": result = migrateFocus(item); break;
    case "weapon": {
      if (s.skillId !== undefined) {
        const patch = {
          ...(repairWwnWeaponCounter(s) ?? {}),
          ...(repairWwnWeaponAmmo(s) ?? {}),
        };
        // Always coerce legacy blank shock.ac even when ammo/counter are fine.
        const shockAc = s.shock?.ac;
        if (shockAc === "" || shockAc === null || shockAc === undefined || Number.isNaN(Number(shockAc))) {
          patch.shock = { ...(typeof patch.shock === "object" ? patch.shock : {}), ac: 15 };
        }
        result = Object.keys(patch).length ? { system: patch } : null;
      } else {
        result = migrateWeapon(item);
      }
      break;
    }
    case "armor":
      if (s.aac !== undefined || s.acRanged === undefined) result = migrateArmor(item);
      else result = migrateWwnArmorTrauma(item);
      break;
    case "item": result = migrateGear(item); break;
    case "skill": result = s.slug !== undefined ? null : migrateSkill(item); break;
    default: return null; // asset etc. — out of scope
  }
  if (result?.img) result.img = remapAssetPath(result.img);
  return result;
}

/**
 * Apply {@link migrateItemData} onto a plain item object, preserving identity.
 * Full rebuilds (art→power, etc.) replace the document shape; patches merge.
 * @param {object} item
 * @returns {object}
 */
export function applyEmbeddedItemMigration(item) {
  if (!item || typeof item !== "object") return item;
  const migrated = migrateItemData(item);
  if (!migrated) return item;
  // Full document replacements always include name + type + system.
  if (migrated.type != null && migrated.system != null && migrated.name != null) {
    return {
      ...migrated,
      _id: item._id ?? migrated._id,
      _key: item._key ?? migrated._key,
    };
  }
  // Partial patch (e.g. `{ system: { … } }`) — shallow-merge system.
  const out = { ...item, ...migrated };
  if (migrated.system && item.system) {
    out.system = { ...item.system, ...migrated.system };
    if (migrated.system.shock && item.system.shock) {
      out.system.shock = { ...item.system.shock, ...migrated.system.shock };
    }
  }
  return out;
}

/* -------------------------------------------- */
/*  Actor transforms (M0/M1/M5c/M7)             */
/* -------------------------------------------- */

/**
 * Empty map-placeholder actors (e.g. Baileywiki): no items, no effects.
 * Still get a cheap type rewrite when pending; skip item churn.
 * @param {object} raw  Actor plain data (`toObject()` shape)
 * @param {object[]} [itemSources]  Prefetched embedded item sources
 * @returns {boolean}
 */
export function isBarePlaceholderActorData(raw, itemSources) {
  const items = itemSources ?? raw?.items ?? [];
  if (items.length > 0) return false;
  if ((raw?.effects?.length ?? 0) > 0) return false;
  return true;
}

/**
 * Transform a WWN character/monster actor (plain data) into WWN pc/npc data.
 * Returns null when the actor is not a WWN type needing migration.
 */
export function migrateActorData(actor) {
  let result = null;
  if (actor.type === "character" || actor.type === "pc") result = migrateCharacter(actor);
  else if (actor.type === "monster" || actor.type === "npc") result = migrateMonster(actor);
  if (result && actor.img) result.img = remapAssetPath(actor.img);
  // Preserve stored type (character/monster canonical; pc/npc reverse aliases).
  if (result) result.type = actor.type;
  return result; // factions untouched (null)
}

function migrateCharacter(actor) {
  const s = actor.system ?? {};
  const isWwn = !!s.scores;
  const items = (actor.items ?? []).map((i) => applyEmbeddedItemMigration(i));
  const effects = (actor.effects ?? []).map(migrateEffectData);

  if (!isWwn) {
    const combatPatch = migratePcCombatAb(s, { warrior: !!s.warrior });
    const remappedEffects = effects.map((e) => remapCombatAbEffect(e));
    if (!combatPatch) {
      return { type: actor.type, items, effects: remappedEffects, system: null };
    }
    const system = foundry.utils.deepClone(s);
    system.combat = { abMod: combatPatch.combat.abMod };
    return { type: actor.type, items, effects: remappedEffects, system };
  }

  /* Abilities */
  const abilities = {};
  for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
    abilities[key] = { value: Number(s.scores?.[key]?.value) || 0, baseMod: 0 };
  }

  /* Tweaks -> passive AEs */
  const tweakChanges = [];
  for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
    const tweak = Number(s.scores?.[key]?.tweak) || 0;
    if (tweak) tweakChanges.push({ key: `system.abilities.${key}.baseMod`, type: "add", value: tweak, phase: "initial" });
  }
  for (const save of ["evasion", "physical", "mental", "luck"]) {
    const mod = Number(s.saves?.[save]?.mod) || 0;
    if (mod) tweakChanges.push({ key: `system.saves.${save}.mod`, type: "add", value: mod, phase: "initial" });
  }
  const baseSaveMod = Number(s.saves?.baseSave?.mod) || 0;
  if (baseSaveMod) tweakChanges.push({ key: "system.saves.base.mod", type: "add", value: baseSaveMod, phase: "initial" });
  const aacMod = Number(s.aac?.mod) || 0;
  if (aacMod) tweakChanges.push({ key: "system.combat.ac.mod", type: "add", value: aacMod, phase: "initial" });
  const initMod = Number(s.initiative?.mod) || 0;
  if (initMod) tweakChanges.push({ key: "system.combat.initiative.individual.mod", type: "add", value: initMod, phase: "initial" });
  const moveBonus = Number(s.movement?.bonus) || 0;
  if (moveBonus) tweakChanges.push({ key: "system.movement.bonus", type: "add", value: moveBonus, phase: "initial" });

  if (tweakChanges.length) {
    effects.push({
      name: "Migrated: WWN Tweaks",
      img: "icons/svg/upgrade.svg",
      system: { changes: tweakChanges },
    });
  }
  // Legacy `warrior` flag → classEdge "Full Warrior" via assignment dialog; do not
  // stamp a disposable actor-owned Full Warrior AE (delete races transferred effects).

  /* Currency -> items */
  for (const def of WWN_CURRENCIES) {
    const carried = Number(s.currency?.[def.key]) || 0;
    const banked = def.base ? Number(s.currency?.bank) || 0 : 0;
    if (!carried && !banked) continue;
    items.push({
      name: def.name,
      type: "currency",
      img: CONFIG.WWN?.defaultIcons?.currency ?? "icons/svg/coins.svg",
      system: { multiplier: def.multiplier, perSlot: def.perSlot, carried, banked },
    });
  }

  /* Hit dice */
  const hd = parseHdString(s.hp?.hd) ?? { die: "d6", perLevelMod: 0 };
  const level = Number(s.details?.level) || 1;
  const abMod = migratePcCombatAb(
    { combat: { ab: Number(s.thac0?.bba) || 0 }, details: { level } },
    { warrior: !!s.warrior }
  )?.combat?.abMod ?? 0;

  const system = {
    hp: { value: Number(s.hp?.value) || 1, max: Number(s.hp?.max) || 1 },
    strain: { value: Number(s.details?.strain?.value) || 0 },
    alienation: { value: 0 },
    stress: { value: 0 },
    abilities,
    details: {
      class: s.details?.class ?? "",
      background: s.details?.background ?? "",
      alignment: s.details?.alignment ?? "",
      level: Number(s.details?.level) || 1,
      notes: s.details?.notes ?? "",
      morale: Number(s.details?.morale) || 7,
      renown: { value: Number(s.details?.renown?.value ?? s.details?.renown) || 0 },
      xp: {
        value: Number(s.details?.xp?.value) || 0,
        bonus: Number(s.details?.xp?.bonus) || 0,
        share: Number(s.details?.xp?.share) || 100,
        next: Number(s.details?.xp?.next) || 3,
      },
    },
    hitDice: hd,
    skills: {
      unspent: Number(s.skills?.unspent) || 0,
      levelsUnlocked:
        s.skills?.levelsUnlocked != null
          ? !!s.skills.levelsUnlocked
          : s.skills?.locked != null
            ? !s.skills.locked
            : false,
    },
    favorites: [],
    languages: Array.isArray(s.languages?.value) ? s.languages.value : [],
    casting: {
      prepared: {
        value: Number(s.spells?.prepared?.value) || 0,
        max: Number(s.spells?.prepared?.max) || 3,
      },
    },
    retainer: {
      enabled: !!s.retainer?.enabled,
      wage: String(s.retainer?.wage ?? ""),
    },
    currencyShare: Number(s.currency?.share) || 100,
    combat: { abMod },
    movement: { base: { value: Number(s.movement?.base) || 30 } },
    biography: s.details?.biography ?? "",
  };

  return { type: actor.type, system, items, effects };
}

function migrateMonster(actor) {
  const s = actor.system ?? {};
  const isWwn = !!s.hp?.hd && !s.hd;
  const items = (actor.items ?? []).map((i) => applyEmbeddedItemMigration(i));
  const effects = (actor.effects ?? []).map(migrateEffectData);

  if (!isWwn) return { type: actor.type, items, effects, system: null };

  // instinctTable "[RollTable.xyz]" -> UUID
  let instinctTable = null;
  const tableRef = s.details?.instinctTable?.table ?? "";
  const m = String(tableRef).match(/\[?(RollTable\.[a-zA-Z0-9]+)\]?/);
  if (m) instinctTable = m[1];

  const system = {
    hp: { value: Number(s.hp?.value) || 1, max: Number(s.hp?.max) || 1 },
    strain: { value: 0 },
    alienation: { value: 0 },
    stress: { value: 0 },
    hd: s.hp?.hd ?? "1d8",
    skill: Number(s.details?.skill) || 0,
    details: {
      alignment: s.details?.alignment ?? "",
      xp: Number(s.details?.xp) || 0,
      morale: Number(s.details?.morale) || 7,
      instinct: Number(s.details?.instinct) || 0,
      instinctTable,
      appearing: {
        d: String(s.details?.appearing?.d ?? ""),
        w: String(s.details?.appearing?.w ?? ""),
      },
      treasure: {
        table: String(s.details?.treasure?.table ?? ""),
        type: String(s.details?.treasure?.type ?? ""),
      },
    },
    favorites: mergeWeaponFavorites([], items) ?? [],
    notes: "",
    combat: {
      ab: Number(s.thac0?.bba ?? s.combat?.ab) || 0,
      damageBonus: Number(s.damageBonus ?? s.combat?.damageBonus) || 0,
      damageBonusHalfLevel: !!(s.combat?.damageBonusHalfLevel ?? s.warrior),
      initMod: Number(s.initiative?.mod ?? s.combat?.initMod) || 0,
      acManual: {
        melee: Number(s.aac?.value ?? s.combat?.acManual?.melee) || 10,
        ranged: Number(s.aac?.ranged ?? s.aac?.value ?? s.combat?.acManual?.ranged) || 10,
      },
    },
    saveMods: {
      base: Number(s.saves?.base?.mod ?? s.saveMods?.base) || 0,
      evasion: Number(s.saves?.evasion?.mod ?? s.saveMods?.evasion) || 0,
      mental: Number(s.saves?.mental?.mod ?? s.saveMods?.mental) || 0,
      physical: Number(s.saves?.physical?.mod ?? s.saveMods?.physical) || 0,
      luck: Number(s.saves?.luck?.mod ?? s.saveMods?.luck) || 0,
    },
    movement: { base: { value: Number(s.movement?.base?.value ?? s.movement?.base) || 30 } },
    biography: s.details?.biography ?? "",
  };

  return { type: actor.type, system, items, effects };
}
