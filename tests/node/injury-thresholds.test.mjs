import test from "node:test";
import assert from "node:assert/strict";

import {
  THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
  computeDamageRange,
  computeEdge,
  computeInjuryTargetNumber,
  evaluateInjuryDie,
  evaluateUpperHalfDamageGate,
  isPositiveNormalAttackDamage,
  maxWeaponDamage,
} from "../../module/injury-thresholds.mjs";

test("natural 20 grants edge 3 without auto-triggering", () => {
  assert.deepEqual(
    computeEdge({ attackTotal: 3, targetAac: 20, naturalD20: 20 }),
    { eligible: true, edge: 3, source: "natural20", margin: null },
  );
  assert.equal(evaluateInjuryDie({ dieResult: 4, targetNumber: 5 }), false);
});

test("attack margin maps to edge and misses are ineligible", () => {
  assert.deepEqual(
    computeEdge({ attackTotal: 15, targetAac: 10, naturalD20: 12 }),
    { eligible: true, edge: 1, source: "margin5", margin: 5 },
  );
  assert.deepEqual(
    computeEdge({ attackTotal: 20, targetAac: 10, naturalD20: 12 }),
    { eligible: true, edge: 2, source: "margin10", margin: 10 },
  );
  assert.deepEqual(
    computeEdge({ attackTotal: 9, targetAac: 10, naturalD20: 12 }),
    { eligible: false, edge: 0, source: "miss", margin: -1, reason: "attack-margin-below-aac" },
  );
});

test("injury resistance can push target number beyond a d10", () => {
  assert.equal(computeInjuryTargetNumber({ injuryResistance: 3, edge: 0 }), 11);
  assert.equal(evaluateInjuryDie({ dieResult: 10, targetNumber: 11 }), false);
});

test("only positive normal attack damage is threshold eligible", () => {
  assert.equal(isPositiveNormalAttackDamage({
    actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
    damageKind: "normal",
    amount: 6,
    multiplier: 0.5,
  }), true);
  assert.equal(isPositiveNormalAttackDamage({
    actionFamily: "shock",
    damageKind: "shock",
    amount: 6,
    multiplier: 1,
  }), false);
  assert.equal(isPositiveNormalAttackDamage({
    actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
    damageKind: "normal",
    amount: 6,
    multiplier: -1,
  }), false);
});

test("weapon pressure parser handles dice and flat modifiers", () => {
  assert.equal(maxWeaponDamage("1d6+2"), 8);
  assert.equal(maxWeaponDamage("2d4 - 1"), 7);
  assert.equal(maxWeaponDamage("ceil(1d6 / 2)"), null);
});

test("damage ranges include dice minimums and static modifiers", () => {
  assert.deepEqual(
    computeDamageRange("1d8 + 1"),
    { supported: true, formula: "1d8 + 1", min: 2, max: 9, upperHalfCutoff: 6 },
  );
  assert.deepEqual(
    computeDamageRange("2d6"),
    { supported: true, formula: "2d6", min: 2, max: 12, upperHalfCutoff: 7 },
  );
  assert.deepEqual(
    computeDamageRange("2d4 - 1"),
    { supported: true, formula: "2d4 - 1", min: 1, max: 7, upperHalfCutoff: 4 },
  );
  assert.deepEqual(
    computeDamageRange("1d6 + 2 + 1"),
    { supported: true, formula: "1d6 + 2 + 1", min: 4, max: 9, upperHalfCutoff: 7 },
  );
  assert.deepEqual(
    computeDamageRange("d6 + 1"),
    { supported: true, formula: "d6 + 1", min: 2, max: 7, upperHalfCutoff: 5 },
  );
  assert.deepEqual(
    computeDamageRange("1d6 + 4"),
    { supported: true, formula: "1d6 + 4", min: 5, max: 10, upperHalfCutoff: 8 },
  );
});

test("upper-half damage gate qualifies inclusive cutoff rolls", () => {
  const range = computeDamageRange("1d8 + 1");
  assert.deepEqual(
    evaluateUpperHalfDamageGate({ rolledTotal: 6, range }),
    { eligible: true, reason: null, rolledTotal: 6, range },
  );
  assert.deepEqual(
    evaluateUpperHalfDamageGate({ rolledTotal: 5, range }),
    { eligible: false, reason: "lower-half-damage-roll", rolledTotal: 5, range },
  );

  const damageWithBonusRange = computeDamageRange("1d6 + 4");
  assert.deepEqual(
    evaluateUpperHalfDamageGate({ rolledTotal: 5, range: damageWithBonusRange }),
    { eligible: false, reason: "lower-half-damage-roll", rolledTotal: 5, range: damageWithBonusRange },
  );
  assert.deepEqual(
    evaluateUpperHalfDamageGate({ rolledTotal: 8, range: damageWithBonusRange }),
    { eligible: true, reason: null, rolledTotal: 8, range: damageWithBonusRange },
  );
});

test("unsupported damage formulas fail closed", () => {
  const range = computeDamageRange("ceil(1d6 / 2)");
  assert.equal(range.supported, false);
  assert.equal(
    evaluateUpperHalfDamageGate({ rolledTotal: 4, range }).reason,
    "unsupported-damage-formula",
  );
});
