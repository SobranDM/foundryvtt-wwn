import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBelowZeroWoundFormula,
  computeHpDamage,
  computeWoundPointsAfterExcess,
  normalizeInjuryResistance,
} from "../../module/local-mechanics.mjs";

test("HP damage computes clamped HP and positive excess", () => {
  assert.deepEqual(
    computeHpDamage({ hpValue: 5, hpMax: 10, amount: 8, multiplier: 1 }),
    {
      rawAmount: 8,
      appliedAmount: 8,
      preDamageHp: { value: 5, max: 10 },
      excessDamage: 3,
      nextHp: 0,
    },
  );
});

test("healing clamps to maximum HP and creates no excess", () => {
  assert.deepEqual(
    computeHpDamage({ hpValue: 7, hpMax: 10, amount: 8, multiplier: -1 }),
    {
      rawAmount: 8,
      appliedAmount: -8,
      preDamageHp: { value: 7, max: 10 },
      excessDamage: 0,
      nextHp: 10,
    },
  );
});

test("excess damage reduces wound points without going below zero", () => {
  assert.equal(
    computeWoundPointsAfterExcess({ wpValue: 2, wpMax: 5, excessDamage: 7 }),
    0,
  );
});

test("injury resistance normalizes invalid values to zero", () => {
  assert.equal(normalizeInjuryResistance("2.9"), 2);
  assert.equal(normalizeInjuryResistance("-1"), 0);
  assert.equal(normalizeInjuryResistance("bad"), 0);
});

test("below-zero wound formula subtracts injury resistance", () => {
  assert.equal(
    buildBelowZeroWoundFormula({ currentInjuries: 1, excessDamage: 4, injuryResistance: 2 }),
    "1d12 + 1 + 4 - 2",
  );
});
