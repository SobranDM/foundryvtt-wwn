import test from "node:test";
import assert from "node:assert/strict";

import {
  THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
  buildThresholdAttemptKey,
  computeEdge,
  computeInjuryTargetNumber,
  evaluateInjuryDie,
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

test("normal damage family shares one idempotency key", () => {
  assert.equal(
    buildThresholdAttemptKey({
      messageUuid: "ChatMessage.abc",
      targetUuid: "Scene.x.Token.y",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
    }),
    "ChatMessage%2Eabc|Scene%2Ex%2EToken%2Ey|normal-attack-damage",
  );
});

test("weapon pressure parser handles dice and flat modifiers", () => {
  assert.equal(maxWeaponDamage("1d6+2"), 8);
  assert.equal(maxWeaponDamage("2d4 - 1"), 7);
});
