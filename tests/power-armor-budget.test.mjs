import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sumArmorFittingBudgets,
  fittingsAreInert,
  PHASE_A_EFFECT_IDS,
} from "../module/helpers/power-armor-budget.mjs";

describe("power-armor-budget", () => {
  it("sums mass and power ignoring non-fittings and disabled", () => {
    const items = [
      { type: "armorFitting", system: { mass: 2, power: 1, cost: 5000 } },
      { type: "armorFitting", system: { mass: 4, power: 2, cost: 20000, disabled: true } },
      { type: "weapon", system: { mass: 99 } },
    ];
    const sum = sumArmorFittingBudgets(items, 7, 6);
    assert.equal(sum.massUsed, 2);
    assert.equal(sum.powerUsed, 1);
    assert.equal(sum.totalCost, 5000);
    assert.equal(sum.overBudgetMass, false);
  });

  it("ignores integral fittings for mass/power but not cost", () => {
    const items = [
      { type: "armorFitting", system: { mass: 2, power: 1, cost: 1000, integral: true } },
      { type: "armorFitting", system: { mass: 3, power: 2, cost: 5000 } },
    ];
    const sum = sumArmorFittingBudgets(items, 10, 10);
    assert.equal(sum.massUsed, 3);
    assert.equal(sum.powerUsed, 2);
    assert.equal(sum.totalCost, 6000);
  });

  it("applies plating optimization discount to other fittings when plating present", () => {
    const items = [
      { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingBasic, mass: 2, power: 0, cost: 0 } },
      { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingOptimization, mass: -1, power: -1, cost: 5000 } },
      { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.exoBasic, mass: 1, power: 1, cost: 5000 } },
    ];
    const sum = sumArmorFittingBudgets(items, 10, 10);
    // Optimization halves mass/power of fittings other than itself: plating 2→1, exo 1→1, opt -1/-1
    assert.equal(sum.massUsed, 1 + -1 + 1);
    assert.equal(sum.powerUsed, 0 + -1 + 1);
    assert.equal(sum.hasOptimization, true);
    assert.equal(sum.hasPlating, true);
  });

  it("marks fittings inert when over mass or power", () => {
    const budgets = sumArmorFittingBudgets(
      [{ type: "armorFitting", system: { mass: 5, power: 5 } }],
      4,
      4,
    );
    assert.equal(fittingsAreInert(budgets, 4, 4), true);
    assert.equal(fittingsAreInert({ massUsed: 3, powerUsed: 3 }, 4, 4), false);
  });
});
