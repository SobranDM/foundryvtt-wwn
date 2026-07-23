/**
 * Modular power armor mass/power budget helpers.
 * Pure helpers for unit tests; no Foundry imports.
 */

export const PHASE_A_EFFECT_IDS = Object.freeze({
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
});

const PLATING_IDS = new Set([
  PHASE_A_EFFECT_IDS.platingImprovised,
  PHASE_A_EFFECT_IDS.platingBasic,
  PHASE_A_EFFECT_IDS.platingAdvanced,
  PHASE_A_EFFECT_IDS.platingPretech,
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
    (f) => f.system?.effectId === PHASE_A_EFFECT_IDS.platingOptimization,
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

    // Optimization discounts other fittings when plating is present; optimization itself uses table mass/power (-1/-1).
    if (
      hasOptimization
      && hasPlating
      && system.effectId !== PHASE_A_EFFECT_IDS.platingOptimization
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
