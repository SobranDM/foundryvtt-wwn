/**
 * Modular power armor derive helpers (plating, exo, efficiency, mounts, Phase B passives).
 * Pure helpers; no Foundry imports.
 */

import { POWER_ARMOR_EFFECT_IDS, armorFittingItems, fittingsAreInert } from "./power-armor-budget.mjs";

/** Default runtime minutes on a Type B cell with no Efficiency Core. */
export const DEFAULT_RUNTIME_MINUTES = 30;

const E = POWER_ARMOR_EFFECT_IDS;

const PLATING = {
  [E.platingImprovised]: {
    ac: 16,
    soak: 15,
    traumaTargetBonus: 1,
    shockImmune: false,
    immuneWeaponTl: 2,
  },
  [E.platingBasic]: {
    ac: 18,
    soak: 20,
    traumaTargetBonus: 1,
    shockImmune: true,
    immuneWeaponTl: 3,
  },
  [E.platingAdvanced]: {
    ac: 20,
    soak: 25,
    traumaTargetBonus: 2,
    shockImmune: true,
    immuneWeaponTl: 3,
  },
  [E.platingPretech]: {
    ac: 22,
    soak: 30,
    traumaTargetBonus: 2,
    shockImmune: true,
    immuneWeaponTl: 3,
    traumaOnlyVehicles: true,
  },
};

const EXO = {
  [E.exoBasic]: { strength: 18, strengthMod: 4, stowedAsReadied: false, liftCars: false },
  [E.exoAdvanced]: { strength: 18, strengthMod: 3, stowedAsReadied: true, liftCars: false },
  [E.exoPretech]: { strength: 22, strengthMod: 5, stowedAsReadied: true, liftCars: true },
};

const EFFICIENCY = {
  [E.efficiencyBasic]: { runtimeMinutes: 120, perpetual: false, maintenanceDays: null },
  [E.efficiencyAdvanced]: { runtimeMinutes: 480, perpetual: false, maintenanceDays: null },
  [E.efficiencyPretech]: { runtimeMinutes: 1440, perpetual: false, maintenanceDays: null },
  [E.efficiencyDirectorate]: { runtimeMinutes: null, perpetual: true, maintenanceDays: 30 },
};

const MOUNT = {
  [E.weaponMountBasic]: { attackBonus: 2, damageBonus: 2, allowsHeavy: false, magazines: 2 },
  [E.weaponMountAdvanced]: { attackBonus: 3, damageBonus: 3, allowsHeavy: true, magazines: 4 },
  [E.weaponMountHeavy]: { attackBonus: 3, damageBonus: 0, allowsHeavy: true, magazines: 3, vehicleWeapon: true },
};

/**
 * Passive capability flags derived from fitted effectIds when active.
 * @param {Set<string>} ids
 */
function deriveCapabilities(ids) {
  const sealed = ids.has(E.sealedSystemsAdvanced)
    ? "advanced"
    : (ids.has(E.sealedSystemsBasic) ? "basic" : null);
  return {
    sealed,
    thermalAblative: ids.has(E.thermalAblativeLayer),
    stormReinforcement: ids.has(E.stormReinforcement),
    aquatic: ids.has(E.aquaticAdaptationSuite),
    wallcrawl: ids.has(E.wallcrawlerAnchors),
    jumpDampers: ids.has(E.hydraulicJumpDampers),
    flight: ids.has(E.graviticFoldFlight)
      ? "fold"
      : (ids.has(E.graviticFlightStruts) ? "struts" : null),
    brainguard: ids.has(E.brainguardCap),
    neuralBuffer: ids.has(E.neuralBuffer),
    comms: ids.has(E.commSuiteAdvanced)
      ? "advanced"
      : (ids.has(E.commSuiteBasic) ? "basic" : null),
    ecm: ids.has(E.qecmProjector) ? "qecm" : (ids.has(E.ecmProjector) ? "ecm" : null),
    droneMount: ids.has(E.droneMount),
    traumaStabilizer: ids.has(E.traumaStabilizerUnit),
    tsukumogami: ids.has(E.tsukumogamiProcessor),
    blackOfuda: ids.has(E.blackOfuda),
    backseatDriver: ids.has(E.backseatDriverMod),
    identificationLock: ids.has(E.identificationLock),
    linkedTargeting: ids.has(E.linkedTargetingSystem),
    targetLock: ids.has(E.targetLockProcessor),
    integratedAmmoFeed: ids.has(E.integratedAmmoFeed),
    skysweeper: ids.has(E.skysweeperLaserSystem),
    kineticRebuke: ids.has(E.kineticRebukeShielding),
    stunSkin: ids.has(E.stunSkin),
    floodlights: ids.has(E.floodlights),
    camoBasic: ids.has(E.camoSkinBasic),
    camoAdvanced: ids.has(E.camoSkinAdvanced),
  };
}

/**
 * Human-readable capability badge keys for the sheet.
 * @param {object} capabilities
 * @returns {{ id: string, labelKey: string }[]}
 */
export function listCapabilityBadges(capabilities = {}) {
  const badges = [];
  const push = (cond, id, labelKey) => {
    if (cond) badges.push({ id, labelKey });
  };
  push(capabilities.sealed, "sealed", "WWN.PowerArmor.Cap.sealed");
  push(capabilities.thermalAblative, "thermal", "WWN.PowerArmor.Cap.thermal");
  push(capabilities.stormReinforcement, "storm", "WWN.PowerArmor.Cap.storm");
  push(capabilities.aquatic, "aquatic", "WWN.PowerArmor.Cap.aquatic");
  push(capabilities.wallcrawl, "wallcrawl", "WWN.PowerArmor.Cap.wallcrawl");
  push(capabilities.jumpDampers, "jumpDampers", "WWN.PowerArmor.Cap.jumpDampers");
  push(capabilities.flight, "flight", "WWN.PowerArmor.Cap.flight");
  push(capabilities.brainguard, "brainguard", "WWN.PowerArmor.Cap.brainguard");
  push(capabilities.neuralBuffer, "neuralBuffer", "WWN.PowerArmor.Cap.neuralBuffer");
  push(capabilities.comms, "comms", "WWN.PowerArmor.Cap.comms");
  push(capabilities.ecm, "ecm", "WWN.PowerArmor.Cap.ecm");
  push(capabilities.droneMount, "drone", "WWN.PowerArmor.Cap.drone");
  return badges;
}

/**
 * @param {Array<{ type?: string, system?: object }>} items
 * @param {object} [options]
 * @returns {object}
 */
export function derivePowerArmorEffects(items, options = {}) {
  const {
    powered = true,
    runtimeMultiplier = 1,
    forbidEfficiency = false,
    perpetualFrame = false,
  } = options;

  const fittings = armorFittingItems(items);
  let inert = options.inert;
  if (inert === undefined) inert = false;

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
      if (PLATING[id]) plating = { ...PLATING[id], effectId: id, name: item.name };
      if (EXO[id]) exo = { ...EXO[id], effectId: id, name: item.name };
      if (EFFICIENCY[id] && !forbidEfficiency) {
        efficiency = { ...EFFICIENCY[id], effectId: id, name: item.name };
      }
      if (MOUNT[id]) {
        mounts.push({ ...MOUNT[id], effectId: id, name: item.name, itemId: item._id ?? item.id });
      }
    }
  } else if (!powered && !inert) {
    for (const item of fittings) {
      const id = item.system?.effectId;
      if (PLATING[id]) plating = { ...PLATING[id], effectId: id, name: item.name };
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

  if (active && plating) {
    const hasOpt = fittings.some((f) => f.system?.effectId === E.platingOptimization);
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
  let stealthBonusRangeM = null;
  let emergencyCells = 0;
  const idSet = new Set();

  if (active) {
    for (const item of fittings) {
      const id = item.system?.effectId;
      if (!id) continue;
      idSet.add(id);
      if (id === E.regenerativeForceField) soakMax += 10;
      if (id === E.camoSkinAdvanced || id === E.camoSkinBasic) {
        stealthBonus = Math.max(stealthBonus, 2);
      }
      if (id === E.emergencyPowerCell) emergencyCells += 1;
    }
    if (idSet.has(E.camoSkinAdvanced)) stealthBonusRangeM = null;
    else if (idSet.has(E.camoSkinBasic)) stealthBonusRangeM = 20;
  }

  const capabilities = active ? deriveCapabilities(idSet) : deriveCapabilities(new Set());

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
    /** When set, camo Stealth bonus only applies within this many meters. */
    stealthBonusRangeM,
    emergencyCells,
    capabilities,
    capabilityBadges: listCapabilityBadges(capabilities),
  };
}

/**
 * Mount attack/damage bonus for a weapon linked to a mount fitting effectId.
 * @param {string} mountEffectId
 */
export function weaponMountBonuses(mountEffectId) {
  return MOUNT[mountEffectId] ?? { attackBonus: 0, damageBonus: 0 };
}

/**
 * Effective trauma target for a power-armor (or other) defender.
 * @param {object} targetActor
 * @param {object} [weapon]
 * @returns {{ traumaTarget: number, blocked: boolean, reason?: string }}
 */
export function resolvePowerArmorTraumaGate(targetActor, weapon = null) {
  const base = targetActor?.system?.trauma?.value ?? 6;
  const bonus = targetActor?.system?.derived?.traumaTargetBonus ?? 0;
  const traumaTarget = base + bonus;
  if (targetActor?.type === "powerArmor" && targetActor?.system?.derived?.traumaOnlyVehicles) {
    const vehicleWeapon = !!weapon?.system?.vehicleWeapon
      || !!weapon?.flags?.wwn?.vehicleWeapon
      || /vehicle|heavy|vehicleWeapon/i.test(weapon?.system?.qualities ?? "");
    const mountHeavy = weapon?.flags?.wwn?.armorMountEffectId === E.weaponMountHeavy;
    if (!vehicleWeapon && !mountHeavy) {
      return { traumaTarget, blocked: true, reason: "traumaOnlyVehicles" };
    }
  }
  return { traumaTarget, blocked: false };
}

/**
 * Whether shock is suppressed by power-armor plating (or combat.immuneToShock).
 * @param {object} targetActor
 */
export function isShockImmuneTarget(targetActor) {
  if (!targetActor) return false;
  if (targetActor.system?.combat?.immuneToShock) return true;
  return !!targetActor.system?.derived?.shockImmune;
}

/**
 * Camo stealth bonus considering optional range gate.
 * @param {object} derived
 * @param {number|null} [distanceM]
 */
export function resolveCamoStealthBonus(derived, distanceM = null) {
  const bonus = derived?.stealthBonus ?? 0;
  if (!bonus) return 0;
  const range = derived?.stealthBonusRangeM;
  if (range == null) return bonus;
  if (distanceM == null) return bonus;
  return distanceM <= range ? bonus : 0;
}

export { fittingsAreInert, PLATING, EXO, EFFICIENCY, MOUNT };
