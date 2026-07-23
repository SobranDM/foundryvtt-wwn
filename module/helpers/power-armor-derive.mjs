/**
 * Phase A modular power armor derive helpers (plating, exo, efficiency, mounts).
 * Pure helpers; no Foundry imports.
 */

import { PHASE_A_EFFECT_IDS, armorFittingItems, fittingsAreInert } from "./power-armor-budget.mjs";

/** Default runtime minutes on a Type B cell with no Efficiency Core. */
export const DEFAULT_RUNTIME_MINUTES = 30;

const PLATING = {
  [PHASE_A_EFFECT_IDS.platingImprovised]: {
    ac: 16,
    soak: 15,
    traumaTargetBonus: 1,
    shockImmune: false,
    immuneWeaponTl: 2,
  },
  [PHASE_A_EFFECT_IDS.platingBasic]: {
    ac: 18,
    soak: 20,
    traumaTargetBonus: 1,
    shockImmune: true,
    immuneWeaponTl: 3,
  },
  [PHASE_A_EFFECT_IDS.platingAdvanced]: {
    ac: 20,
    soak: 25,
    traumaTargetBonus: 2,
    shockImmune: true,
    immuneWeaponTl: 3,
  },
  [PHASE_A_EFFECT_IDS.platingPretech]: {
    ac: 22,
    soak: 30,
    traumaTargetBonus: 2,
    shockImmune: true,
    immuneWeaponTl: 3,
    traumaOnlyVehicles: true,
  },
};

const EXO = {
  // Basic: effective Strength 18 for encumbrance / ability modifiers (mod +4 on WWN table).
  [PHASE_A_EFFECT_IDS.exoBasic]: { strength: 18, strengthMod: 4, stowedAsReadied: false, liftCars: false },
  // Advanced: as Basic, but Str mod +3 and Stowed counts as Readied.
  [PHASE_A_EFFECT_IDS.exoAdvanced]: { strength: 18, strengthMod: 3, stowedAsReadied: true, liftCars: false },
  // Pretech: as Advanced, but Str 22 for encumbrance (mod +5 on WWN table) + lift cars.
  [PHASE_A_EFFECT_IDS.exoPretech]: { strength: 22, strengthMod: 5, stowedAsReadied: true, liftCars: true },
};

// Re-read PDF for Advanced: "effective Strength modifier is +3" — not score 18.
// Basic: "effective Strength score is 18"
// Advanced: "As Basic ... but their effective Strength modifier is +3, and all of their Stowed Encumbrance can be used as if it was Readied."
// So Advanced is still based on Basic (Str 18) but mod is +3 instead of the table mod for 18?
// Actually "As Basic Exoskeletal Boost, but their effective Strength modifier is +3" — so Str score still 18 territory but mod forced to +3.
// Pretech: "effective Strength is 22 for Encumbrance purposes"

const EFFICIENCY = {
  [PHASE_A_EFFECT_IDS.efficiencyBasic]: { runtimeMinutes: 120, perpetual: false, maintenanceDays: null },
  [PHASE_A_EFFECT_IDS.efficiencyAdvanced]: { runtimeMinutes: 480, perpetual: false, maintenanceDays: null },
  [PHASE_A_EFFECT_IDS.efficiencyPretech]: { runtimeMinutes: 1440, perpetual: false, maintenanceDays: null },
  [PHASE_A_EFFECT_IDS.efficiencyDirectorate]: { runtimeMinutes: null, perpetual: true, maintenanceDays: 30 },
};

const MOUNT = {
  [PHASE_A_EFFECT_IDS.weaponMountBasic]: { attackBonus: 2, damageBonus: 2, allowsHeavy: false, magazines: 2 },
  [PHASE_A_EFFECT_IDS.weaponMountAdvanced]: { attackBonus: 3, damageBonus: 3, allowsHeavy: true, magazines: 4 },
  [PHASE_A_EFFECT_IDS.weaponMountHeavy]: { attackBonus: 3, damageBonus: 0, allowsHeavy: true, magazines: 3, vehicleWeapon: true },
};

/**
 * @param {Array<{ type?: string, system?: object }>} items
 * @param {object} [options]
 * @param {boolean} [options.powered=true]
 * @param {number} [options.massMax=0]
 * @param {number} [options.powerMax=0]
 * @param {number} [options.runtimeMultiplier=1] Tarnkappe = 0.2
 * @param {boolean} [options.forbidEfficiency=false] Culverin
 * @param {boolean} [options.perpetualFrame=false] Long Rifle
 * @returns {object}
 */
export function derivePowerArmorEffects(items, options = {}) {
  const {
    powered = true,
    massMax = 0,
    powerMax = 0,
    runtimeMultiplier = 1,
    forbidEfficiency = false,
    perpetualFrame = false,
  } = options;

  const fittings = armorFittingItems(items);
  const budgets = {
    massUsed: 0,
    powerUsed: 0,
  };
  // Caller should pass precomputed inert flag; recompute simply via mass/power from items without optimization detail
  // Use full budget helper when available via import cycle — call sum in tests separately.
  // Here we accept `inert` override or compute from crude sums.
  let inert = options.inert;
  if (inert === undefined) {
    // Lazy import avoided: parent passes inert from sumArmorFittingBudgets + fittingsAreInert
    inert = false;
  }

  const active = powered && !inert;

  /** @type {object|null} */
  let plating = null;
  /** @type {object|null} */
  let exo = null;
  /** @type {object|null} */
  let efficiency = null;
  const mounts = [];

  if (active) {
    for (const item of fittings) {
      const id = item.system?.effectId;
      if (PLATING[id]) {
        // Only one plating; last wins if homebrew duplicates
        plating = { ...PLATING[id], effectId: id, name: item.name };
      }
      if (EXO[id]) {
        exo = { ...EXO[id], effectId: id, name: item.name };
      }
      if (EFFICIENCY[id] && !forbidEfficiency) {
        efficiency = { ...EFFICIENCY[id], effectId: id, name: item.name };
      }
      if (MOUNT[id]) {
        mounts.push({ ...MOUNT[id], effectId: id, name: item.name, itemId: item._id ?? item.id });
      }
    }
  } else if (!powered && !inert) {
    // Depowered: plating AC/Soak only
    for (const item of fittings) {
      const id = item.system?.effectId;
      if (PLATING[id]) {
        plating = { ...PLATING[id], effectId: id, name: item.name };
      }
    }
  }

  let runtimeMax = DEFAULT_RUNTIME_MINUTES;
  let perpetual = perpetualFrame;
  let maintenanceDays = null;

  if (perpetualFrame) {
    runtimeMax = null;
    perpetual = true;
  } else if (active && efficiency) {
    if (efficiency.perpetual) {
      runtimeMax = null;
      perpetual = true;
      maintenanceDays = efficiency.maintenanceDays;
    } else {
      runtimeMax = Math.max(1, Math.floor((efficiency.runtimeMinutes ?? DEFAULT_RUNTIME_MINUTES) * runtimeMultiplier));
    }
  } else if (active) {
    runtimeMax = Math.max(1, Math.floor(DEFAULT_RUNTIME_MINUTES * runtimeMultiplier));
  }

  // Plating optimization: AC -2, soak halved ceil — only when active and plating present
  if (active && plating) {
    const hasOpt = fittings.some((f) => f.system?.effectId === PHASE_A_EFFECT_IDS.platingOptimization);
    if (hasOpt) {
      plating = {
        ...plating,
        ac: plating.ac - 2,
        soak: Math.ceil(plating.soak / 2),
        optimized: true,
      };
    }
  }

  let soakMax = plating?.soak ?? 0;
  let stealthBonus = 0;
  let emergencyCells = 0;

  if (active) {
    for (const item of fittings) {
      const id = item.system?.effectId;
      if (id === PHASE_A_EFFECT_IDS.regenerativeForceField) {
        soakMax += 10;
      }
      if (id === PHASE_A_EFFECT_IDS.camoSkinAdvanced || id === PHASE_A_EFFECT_IDS.camoSkinBasic) {
        stealthBonus = Math.max(stealthBonus, 2);
      }
      if (id === PHASE_A_EFFECT_IDS.emergencyPowerCell) {
        emergencyCells += 1;
      }
    }
  }

  return {
    active,
    inert: !!inert,
    powered: !!powered,
    plating,
    exo,
    efficiency,
    mounts,
    ac: plating?.ac ?? 10,
    soakMax,
    traumaTargetBonus: plating?.traumaTargetBonus ?? 0,
    shockImmune: !!plating?.shockImmune,
    immuneWeaponTl: plating?.immuneWeaponTl ?? null,
    traumaOnlyVehicles: !!plating?.traumaOnlyVehicles,
    effectiveStrength: exo?.strength ?? null,
    effectiveStrengthMod: exo?.strengthMod ?? null,
    stowedAsReadied: !!exo?.stowedAsReadied,
    liftCars: !!exo?.liftCars,
    runtimeMax,
    perpetual,
    maintenanceDays,
    stealthBonus,
    emergencyCells,
  };
}

/**
 * Mount attack/damage bonus for a weapon linked to a mount fitting effectId.
 * @param {string} mountEffectId
 */
export function weaponMountBonuses(mountEffectId) {
  return MOUNT[mountEffectId] ?? { attackBonus: 0, damageBonus: 0 };
}

export { fittingsAreInert, PLATING, EXO, EFFICIENCY, MOUNT };
