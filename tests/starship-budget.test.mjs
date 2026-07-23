import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  costMultiplier,
  resourceMultiplier,
  effectiveCost,
  effectiveResource,
  sumEquipmentBudgets,
} from "../module/helpers/starship-budget.mjs";

describe("starship-budget", () => {
  it("applies PDF cost * multipliers", () => {
    assert.equal(costMultiplier("fighter"), 1);
    assert.equal(costMultiplier("frigate"), 10);
    assert.equal(costMultiplier("cruiser"), 25);
    assert.equal(costMultiplier("capital"), 100);
    assert.equal(effectiveCost(10000, true, "frigate"), 100000);
    assert.equal(effectiveCost(10000, false, "frigate"), 10000);
  });

  it("applies PDF # resource multipliers with ceil", () => {
    assert.equal(resourceMultiplier("capital"), 4);
    assert.equal(effectiveResource(1, true, "frigate"), 2);
    assert.equal(effectiveResource(0.5, true, "frigate"), 1);
  });

  it("sums power mass hardpoints and cost from ship items only", () => {
    const items = [
      { type: "shipFitting", system: { cost: 5000, power: 1, mass: 1, costScales: true, powerScales: true, massScales: true } },
      { type: "shipWeapon", system: { cost: 100000, power: 5, mass: 1, hardpoints: 1, costScales: false, powerScales: false, massScales: false } },
      { type: "item", system: { cost: 999 } },
    ];
    const sum = sumEquipmentBudgets(items, "frigate");
    assert.equal(sum.powerUsed, 2 + 5);
    assert.equal(sum.massUsed, 2 + 1);
    assert.equal(sum.hardpointsUsed, 1);
    assert.equal(sum.totalCost, 50000 + 100000);
  });
});
