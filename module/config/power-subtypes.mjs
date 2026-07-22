/**
 * Power subtype presets.
 *
 * `defaults` — initial values applied on create / subtype change.
 * `visibleFields` — sheet allowlist (undefined in defaults no longer implies hidden).
 * `fixedCommitmentOptions` — shared pool tiers enforced at runtime (spell = day slots).
 *
 * Shared pool vs internal use:
 * - Paid `commitmentOptions` → actor shared pool (`poolCommitted`); multiple tiers/lengths allowed.
 * - `internalResource` + `internalResourceLength` → per-power use cap; length is scene or day only.
 * - No separate sharedResource flag; the checkbox was removed.
 */

export const COMMITMENT_LENGTHS = {
  none: "WWN.Commitment.none",
  active: "WWN.Commitment.active",
  scene: "WWN.Commitment.scene",
  day: "WWN.Commitment.day",
};

export const COMMITMENT_KEYS = ["none", "active", "scene", "day"];

/** Per-power use limits refresh on scene or day GM actions only (not pool commitment tiers). */
export const INTERNAL_USE_REFRESH_LENGTHS = {
  scene: "WWN.Commitment.scene",
  day: "WWN.Commitment.day",
};

export const INTERNAL_USE_REFRESH_KEYS = ["scene", "day"];

/** Explicit tier when a power does not draw from a shared actor pool. */
export const NO_POOL_COMMITMENT = Object.freeze([{ cost: 0, length: "none", note: "" }]);

/** @typedef {{ cost: number, length: string, note?: string }} CommitmentOption */

export const POWER_SUBTYPES = {
  art: {
    label: "WWN.PowerSubType.art",
    defaults: {
      source: "",
      resourceName: "Effort",
      commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      level: undefined,
      prepared: undefined,
      userStrain: "",
      targetStrain: "",
    },
    visibleFields: {
      source: true,
      resourceName: true,
      commitmentOptions: true,
      internalResource: "dyn",
      internalResourceLength: "dyn",
      userStrain: true,
      targetStrain: true,
      activation: true,
      activationRollType: true,
      damageRoll: true,
      healing: true,
    },
  },
  spell: {
    label: "WWN.PowerSubType.spell",
    fixedCommitmentOptions: [{ cost: 1, length: "day", note: "" }],
    defaults: {
      source: "",
      resourceName: "Spell Slots",
      commitmentOptions: [{ cost: 1, length: "day", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      level: 1,
      prepared: false,
      userStrain: "",
      targetStrain: "",
    },
    visibleFields: {
      source: true,
      level: true,
      resourceName: true,
      prepared: true,
      userStrain: true,
      targetStrain: true,
      activation: true,
      damageRoll: true,
      healing: true,
    },
  },
  ability: {
    label: "WWN.PowerSubType.ability",
    defaults: {
      commitmentOptions: [{ cost: 0, length: "none", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      userStrain: "",
      targetStrain: "",
    },
    visibleFields: {
      internalResource: true,
      internalResourceLength: "dyn",
      userStrain: true,
      targetStrain: true,
      activation: true,
      damageRoll: true,
      healing: true,
    },
  },
  psychic: {
    label: "WWN.PowerSubType.psychic",
    defaults: {
      source: "",
      resourceName: "Effort",
      commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      level: 1,
      userStrain: "",
      targetStrain: "",
    },
    visibleFields: {
      source: true,
      level: true,
      resourceName: true,
      commitmentOptions: true,
      internalResource: "dyn",
      internalResourceLength: "dyn",
      userStrain: true,
      targetStrain: true,
      activation: true,
      damageRoll: true,
      healing: true,
    },
  },
  cyberware: {
    label: "WWN.PowerSubType.cyberware",
    defaults: {
      commitmentOptions: [{ cost: 0, length: "none", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      permanentStrain: 0,
      userStrain: "",
      targetStrain: "",
      installed: false,
      alienationCost: 0,
    },
    visibleFields: {
      commitmentOptions: true,
      permanentStrain: true,
      userStrain: true,
      targetStrain: true,
      installed: true,
      alienationCost: true,
      activation: true,
      damageRoll: true,
      healing: true,
    },
  },
  mutation: {
    label: "WWN.PowerSubType.mutation",
    defaults: {
      commitmentOptions: [{ cost: 0, length: "none", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      userStrain: "",
      targetStrain: "",
    },
    visibleFields: {
      commitmentOptions: true,
      userStrain: true,
      targetStrain: true,
      activation: true,
      damageRoll: true,
      healing: true,
    },
  },
  gift: {
    label: "WWN.PowerSubType.gift",
    defaults: {
      source: "",
      resourceName: "Effort",
      commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      userStrain: "",
      targetStrain: "",
    },
    visibleFields: {
      source: true,
      resourceName: true,
      commitmentOptions: true,
      internalResource: "dyn",
      internalResourceLength: "dyn",
      userStrain: true,
      targetStrain: true,
      activation: true,
      damageRoll: true,
      healing: true,
    },
  },
  custom: {
    label: "WWN.PowerSubType.custom",
    showAllFields: true,
    defaults: {
      customTypeName: "",
      source: "",
      resourceName: "",
      commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      level: 1,
      permanentStrain: 0,
      userStrain: "",
      targetStrain: "",
      installed: false,
      alienationCost: 0,
    },
    visibleFields: {
      customTypeName: true,
      source: true,
      level: true,
      resourceName: true,
      commitmentOptions: true,
      internalResource: true,
      internalResourceLength: true,
      permanentStrain: true,
      userStrain: true,
      targetStrain: true,
      installed: true,
      alienationCost: true,
      activation: true,
      damageRoll: true,
      healing: true,
    },
  },
};

/** Display order for Powers tab sections (custom grouped separately). */
export const POWER_SECTION_ORDER = [
  "art",
  "spell",
  "cyberware",
  "psychic",
  "mutation",
  "gift",
  "ability",
  "custom",
];

const ALL_FIELD_KEYS = [
  "customTypeName", "source", "level", "resourceName",
  "commitmentOptions", "internalResource", "internalResourceLength",
  "prepared", "permanentStrain", "userStrain", "targetStrain", "installed", "alienationCost",
  "activation", "activationRollType", "damageRoll", "healing",
];

const PANEL_FIELDS = {
  type: ["customTypeName", "source", "level"],
  sharedPool: ["resourceName", "commitmentOptions"],
  useLimits: ["internalResource", "internalResourceLength"],
  strain: ["permanentStrain", "userStrain", "targetStrain"],
  traits: ["prepared", "installed", "alienationCost"],
  activation: ["activation", "activationRollType", "damageRoll", "healing"],
};

/**
 * Normalize commitmentOptions from form expandObject (array or `{0: {...}}`).
 * @param {unknown} raw
 * @returns {object[]|null}
 */
export function coerceCommitmentOptionsArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const entries = Object.entries(raw).filter(([k]) => /^\d+$/.test(k));
    if (!entries.length) return null;
    return entries
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, v]) => v);
  }
  return null;
}

/** @param {string} subType @param {object} system @returns {CommitmentOption[]} */
export function ensureCommitmentOptions(subType, system) {
  const cfg = POWER_SUBTYPES[subType];
  if (cfg?.fixedCommitmentOptions?.length) {
    return foundry.utils.deepClone(cfg.fixedCommitmentOptions);
  }

  const options = coerceCommitmentOptionsArray(system.commitmentOptions) ?? system.commitmentOptions;
  if (Array.isArray(options) && options.length > 0) {
    return foundry.utils.deepClone(options);
  }

  return foundry.utils.deepClone(NO_POOL_COMMITMENT);
}

/** @param {object} system @returns {CommitmentOption[]} */
export function resolveCommitmentOptions(subType, system) {
  return ensureCommitmentOptions(subType, system);
}

/** True when this power commits from an actor-wide pool (paid commitment options). */
export function usesSharedPool(subType, system) {
  return resolveCommitmentOptions(subType, system).some((o) => o.cost > 0);
}

/** @param {string} subType @param {object} system */
export function hasSceneOrDayCommitment(subType, system) {
  return resolveCommitmentOptions(subType, system).some(
    (o) => o.cost > 0 && (o.length === "scene" || o.length === "day")
  );
}

/** @param {string} subType @param {object} system */
export function hasActiveCommitment(subType, system) {
  return resolveCommitmentOptions(subType, system).some(
    (o) => o.cost > 0 && o.length === "active"
  );
}

export const EFFECT_APPLICATION_CHOICES = {
  self: "WWN.Power.EffectApplicationSelf",
  targets: "WWN.Power.EffectApplicationTargets",
};

/** @param {string} [length] @returns {"scene"|"day"} */
export function normalizeInternalResourceLength(length) {
  return length === "day" ? "day" : "scene";
}

/** @param {string} subType @param {object} system */
export function getInternalCommitment(subType, system) {
  const max = system.internalResource?.max ?? 0;
  if (max <= 0) return "none";
  return normalizeInternalResourceLength(system.internalResourceLength);
}

function resolveFieldVisible(key, cfg, subType, system) {
  if (cfg.showAllFields) {
    if (key === "customTypeName") return subType === "custom";
    if (key === "activationRollType") return subType === "custom" || subType === "art";
    if (key === "prepared") return subType === "spell";
    if (key === "internalResourceLength") return (system.internalResource?.max ?? 0) > 0;
    return true;
  }

  if (key === "prepared") return subType === "spell" && cfg.visibleFields?.prepared === true;

  const vis = cfg.visibleFields?.[key];
  if (vis === true) return true;
  if (vis === false || vis === undefined) return false;
  if (vis === "dyn") {
    const max = system.internalResource?.max ?? 0;
    if (key === "internalResource") return true;
    if (key === "internalResourceLength") return max > 0;
  }
  return false;
}

/** @param {string} subType @param {object} system */
export function getPowerSheetVisibility(subType, system) {
  const cfg = POWER_SUBTYPES[subType] ?? {};
  const show = {};
  for (const key of ALL_FIELD_KEYS) {
    show[key] = resolveFieldVisible(key, cfg, subType, system);
  }

  const showPanel = {};
  for (const [panel, keys] of Object.entries(PANEL_FIELDS)) {
    showPanel[panel] = keys.some((k) => show[k]);
  }
  show.effectApplication = hasSceneOrDayCommitment(subType, system);
  return { show, showPanel };
}

/** Apply subtype defaults onto a flat system object (create / subtype change). */
export function applySubtypeDefaults(subType, system = {}) {
  const defaults = POWER_SUBTYPES[subType]?.defaults ?? {};
  const out = foundry.utils.deepClone(system);
  out.subType = subType;
  for (const [key, value] of Object.entries(defaults)) {
    if (value !== undefined) foundry.utils.setProperty(out, key, foundry.utils.deepClone(value));
  }
  if (POWER_SUBTYPES[subType]?.fixedCommitmentOptions?.length) {
    out.commitmentOptions = foundry.utils.deepClone(POWER_SUBTYPES[subType].fixedCommitmentOptions);
  } else {
    out.commitmentOptions = ensureCommitmentOptions(subType, out);
  }
  out.poolCommitted ??= { none: 0, active: 0, scene: 0, day: 0 };
  out.internalResourceLength = normalizeInternalResourceLength(out.internalResourceLength);
  if (!Array.isArray(out.commitmentOptions)) {
    out.commitmentOptions = foundry.utils.deepClone(NO_POOL_COMMITMENT);
  }
  return out;
}
