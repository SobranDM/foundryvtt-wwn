/**
 * Unit tests for combat AE boolean helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceAeBoolean,
  isTruthyAeFlag,
  isImmuneToSurprise,
  hasAutoStabilize,
  isHeavyDamageSource,
} from "../module/helpers/combat-ae-flags.mjs";

describe("coerceAeBoolean", () => {
  it("treats true/1/true-string as true", () => {
    assert.equal(coerceAeBoolean(true), true);
    assert.equal(coerceAeBoolean(1), true);
    assert.equal(coerceAeBoolean("true"), true);
    assert.equal(coerceAeBoolean("1"), true);
  });

  it("treats false/0/false-string as false (not !!raw)", () => {
    assert.equal(coerceAeBoolean(false), false);
    assert.equal(coerceAeBoolean(0), false);
    assert.equal(coerceAeBoolean("false"), false);
    assert.equal(coerceAeBoolean("0"), false);
    assert.equal(coerceAeBoolean(""), false);
  });
});

describe("isTruthyAeFlag / combat readers", () => {
  it("reads immuneToSurprise and autoStabilize", () => {
    assert.equal(isImmuneToSurprise({ system: { combat: { immuneToSurprise: true } } }), true);
    assert.equal(isImmuneToSurprise({ system: { combat: { immuneToSurprise: "false" } } }), false);
    assert.equal(hasAutoStabilize({ system: { combat: { autoStabilize: "true" } } }), true);
    assert.equal(isTruthyAeFlag("false"), false);
  });
});

describe("isHeavyDamageSource", () => {
  it("detects Heavy in source labels", () => {
    assert.equal(isHeavyDamageSource("Heavy weapon"), true);
    assert.equal(isHeavyDamageSource("sword"), false);
  });
});
