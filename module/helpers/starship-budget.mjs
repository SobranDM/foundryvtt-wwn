/**
 * Starship equipment budget helpers (class multipliers, effective cost/power/mass).
 * Pure helpers for unit tests; no Foundry imports.
 */

export const HULL_CLASS_ORDER = { fighter: 0, frigate: 1, cruiser: 2, capital: 3 };

const COST_MULTIPLIERS = { fighter: 1, frigate: 10, cruiser: 25, capital: 100 };
const RESOURCE_MULTIPLIERS = { fighter: 1, frigate: 2, cruiser: 3, capital: 4 };

/** @param {string} hullClass */
export function costMultiplier(hullClass) {
  return COST_MULTIPLIERS[hullClass] ?? 1;
}

/** @param {string} hullClass */
export function resourceMultiplier(hullClass) {
  return RESOURCE_MULTIPLIERS[hullClass] ?? 1;
}

/** @param {number} baseCost @param {boolean} costScales @param {string} hullClass */
export function effectiveCost(baseCost, costScales, hullClass) {
  return costScales ? baseCost * costMultiplier(hullClass) : baseCost;
}

/** @param {number} base @param {boolean} scales @param {string} hullClass */
export function effectiveResource(base, scales, hullClass) {
  return scales ? Math.ceil(base * resourceMultiplier(hullClass)) : base;
}

const SHIP_EQUIPMENT_TYPES = new Set(["shipFitting", "shipWeapon", "shipDefense"]);

/**
 * @param {Array<{ type?: string, system?: object }>} items
 * @param {string} hullClass
 * @returns {{ powerUsed: number, massUsed: number, hardpointsUsed: number, totalCost: number }}
 */
export function sumEquipmentBudgets(items, hullClass) {
  let powerUsed = 0;
  let massUsed = 0;
  let hardpointsUsed = 0;
  let totalCost = 0;

  for (const item of items) {
    if (!SHIP_EQUIPMENT_TYPES.has(item.type)) continue;
    const system = item.system ?? {};
    powerUsed += effectiveResource(system.power ?? 0, system.powerScales ?? false, hullClass);
    massUsed += effectiveResource(system.mass ?? 0, system.massScales ?? false, hullClass);
    hardpointsUsed += system.hardpoints ?? 0;
    totalCost += effectiveCost(system.cost ?? 0, system.costScales ?? false, hullClass);
  }

  return { powerUsed, massUsed, hardpointsUsed, totalCost };
}
