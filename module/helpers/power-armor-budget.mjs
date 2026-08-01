/**
 * Modular power armor mass/power budget helpers.
 * Pure helpers for unit tests; no Foundry imports.
 */

/** All pack armor-fitting effectIds (Phase A + Phase B). */
export const POWER_ARMOR_EFFECT_IDS = Object.freeze({
  // Phase A core
  platingImprovised: "platingImprovised",
  platingBasic: "platingBasic",
  platingAdvanced: "platingAdvanced",
  platingPretech: "platingPretech",
  platingOptimization: "platingOptimization",
  exoBasic: "exoBasic",
  exoAdvanced: "exoAdvanced",
  exoPretech: "exoPretech",
  efficiencyBasic: "efficiencyBasic",
  efficiencyAdvanced: "efficiencyAdvanced",
  efficiencyPretech: "efficiencyPretech",
  efficiencyDirectorate: "efficiencyDirectorate",
  weaponMountBasic: "weaponMountBasic",
  weaponMountAdvanced: "weaponMountAdvanced",
  weaponMountHeavy: "weaponMountHeavy",
  regenerativeForceField: "regenerativeForceField",
  camoSkinBasic: "camoSkinBasic",
  camoSkinAdvanced: "camoSkinAdvanced",
  emergencyPowerCell: "emergencyPowerCell",
  // Sensors / lights (AE)
  floodlights: "floodlights",
  nightVisionSensors: "nightVisionSensors",
  multispectralOptics: "multispectralOptics",
  // Movement
  jumpJets: "jumpJets",
  hydraulicJumpDampers: "hydraulicJumpDampers",
  wallcrawlerAnchors: "wallcrawlerAnchors",
  aquaticAdaptationSuite: "aquaticAdaptationSuite",
  graviticFlightStruts: "graviticFlightStruts",
  graviticFoldFlight: "graviticFoldFlight",
  assaultChargeServos: "assaultChargeServos",
  shortRangeWarpCapacitor: "shortRangeWarpCapacitor",
  pathfinderBridgingSystem: "pathfinderBridgingSystem",
  // Stealth / probes
  ghostWalkerField: "ghostWalkerField",
  ablativeMeteorShielding: "ablativeMeteorShielding",
  weaselProbe: "weaselProbe",
  smokethrower: "smokethrower",
  // Combat
  integralRipperBar: "integralRipperBar",
  breacherFist: "breacherFist",
  fingerOfDeath: "fingerOfDeath",
  skysweeperLaserSystem: "skysweeperLaserSystem",
  linkedTargetingSystem: "linkedTargetingSystem",
  targetLockProcessor: "targetLockProcessor",
  chokeCloudSprayer: "chokeCloudSprayer",
  ricochetField: "ricochetField",
  reactiveAntipersonnelArmor: "reactiveAntipersonnelArmor",
  kineticRebukeShielding: "kineticRebukeShielding",
  stunSkin: "stunSkin",
  plagueWindGenerator: "plagueWindGenerator",
  // Defense / env
  sealedSystemsBasic: "sealedSystemsBasic",
  sealedSystemsAdvanced: "sealedSystemsAdvanced",
  thermalAblativeLayer: "thermalAblativeLayer",
  stormReinforcement: "stormReinforcement",
  deployableForceShield: "deployableForceShield",
  // VI / locks
  tsukumogamiProcessor: "tsukumogamiProcessor",
  blackOfuda: "blackOfuda",
  backseatDriverMod: "backseatDriverMod",
  identificationLock: "identificationLock",
  // Medical / recovery
  onboardMedicalUnit: "onboardMedicalUnit",
  traumaStabilizerUnit: "traumaStabilizerUnit",
  neuralBuffer: "neuralBuffer",
  // Utility / EW
  commSuiteBasic: "commSuiteBasic",
  commSuiteAdvanced: "commSuiteAdvanced",
  ecmProjector: "ecmProjector",
  qecmProjector: "qecmProjector",
  droneMount: "droneMount",
  integratedAmmoFeed: "integratedAmmoFeed",
  brainguardCap: "brainguardCap",
});

/** @deprecated Use POWER_ARMOR_EFFECT_IDS */
export const PHASE_A_EFFECT_IDS = POWER_ARMOR_EFFECT_IDS;

/** Set of all known effectId strings for pack smoke tests. */
export const POWER_ARMOR_EFFECT_ID_SET = new Set(Object.values(POWER_ARMOR_EFFECT_IDS));

const PLATING_IDS = new Set([
  POWER_ARMOR_EFFECT_IDS.platingImprovised,
  POWER_ARMOR_EFFECT_IDS.platingBasic,
  POWER_ARMOR_EFFECT_IDS.platingAdvanced,
  POWER_ARMOR_EFFECT_IDS.platingPretech,
]);

/**
 * @param {Array<{ type?: string, system?: object }>} items
 * @returns {Array<{ type?: string, system?: object }>}
 */
export function armorFittingItems(items) {
  return (items ?? []).filter((item) => item.type === "armorFitting" && !item.system?.disabled);
}

/**
 * Integral fittings cost 0 mass/power. Non-integral use stored mass/power.
 * Plating Optimization halves (ceil) mass/power of *other* fittings' contributions
 * when a plating fitting is present (PDF: decreases Mass and Power requirements of
 * other fittings; -1/-1 self cost already on the item).
 *
 * @param {Array<{ type?: string, system?: object }>} items
 * @returns {{ massUsed: number, powerUsed: number, totalCost: number, overBudgetMass: boolean, overBudgetPower: boolean, hasOptimization: boolean, hasPlating: boolean }}
 */
export function sumArmorFittingBudgets(items, massMax = 0, powerMax = 0) {
  const fittings = armorFittingItems(items);
  const hasOptimization = fittings.some(
    (f) => f.system?.effectId === POWER_ARMOR_EFFECT_IDS.platingOptimization,
  );
  const hasPlating = fittings.some((f) => PLATING_IDS.has(f.system?.effectId));

  let massUsed = 0;
  let powerUsed = 0;
  let totalCost = 0;

  for (const item of fittings) {
    const system = item.system ?? {};
    totalCost += system.cost ?? 0;
    if (system.integral) continue;

    let mass = system.mass ?? 0;
    let power = system.power ?? 0;

    if (
      hasOptimization
      && hasPlating
      && system.effectId !== POWER_ARMOR_EFFECT_IDS.platingOptimization
    ) {
      mass = Math.ceil(mass / 2);
      power = Math.ceil(power / 2);
    }

    massUsed += mass;
    powerUsed += power;
  }

  return {
    massUsed,
    powerUsed,
    totalCost,
    overBudgetMass: massUsed > massMax,
    overBudgetPower: powerUsed > powerMax,
    hasOptimization,
    hasPlating,
  };
}

/**
 * PDF: if total Mass or Power exceeds frame rating, none of the fittings work.
 * @param {{ massUsed: number, powerUsed: number, overBudgetMass?: boolean, overBudgetPower?: boolean }} budgets
 * @param {number} massMax
 * @param {number} powerMax
 */
export function fittingsAreInert(budgets, massMax, powerMax) {
  const massUsed = budgets.massUsed ?? 0;
  const powerUsed = budgets.powerUsed ?? 0;
  return massUsed > massMax || powerUsed > powerMax;
}
