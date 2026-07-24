/**
 * Unit tests for starship combat bonus HP helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCombatBonusHp,
  applyDamageThroughCombatBonus,
} from "../module/helpers/starship-combat-hp.mjs";

describe("computeCombatBonusHp", () => {
  it("rounds 20% of max HP", () => {
    assert.equal(computeCombatBonusHp(50, 20), 10);
    assert.equal(computeCombatBonusHp(0, 20), 0);
    assert.equal(computeCombatBonusHp(50, 0), 0);
  });
});

describe("applyDamageThroughCombatBonus", () => {
  it("drains bonus before hull", () => {
    assert.deepEqual(applyDamageThroughCombatBonus(7, 10), {
      hullDamage: 0,
      bonusRemaining: 3,
      bonusTaken: 7,
    });
    assert.deepEqual(applyDamageThroughCombatBonus(12, 10), {
      hullDamage: 2,
      bonusRemaining: 0,
      bonusTaken: 10,
    });
  });
});
