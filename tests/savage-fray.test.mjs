/**
 * Unit tests for Savage Fray helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldMissAfterFirstMeleeHit,
  appendAttackedThisTurn,
  adjacentShockTargets,
} from "../module/helpers/savage-fray.mjs";

describe("shouldMissAfterFirstMeleeHit", () => {
  it("allows same attacker multi-attacks; blocks other assailants", () => {
    const stored = { attackerId: "a1", round: 2 };
    assert.equal(shouldMissAfterFirstMeleeHit(stored, "a1", 2), false);
    assert.equal(shouldMissAfterFirstMeleeHit(stored, "a2", 2), true);
    assert.equal(shouldMissAfterFirstMeleeHit(stored, "a2", 3), false);
    assert.equal(shouldMissAfterFirstMeleeHit(null, "a2", 2), false);
  });
});

describe("appendAttackedThisTurn / adjacentShockTargets", () => {
  it("tracks unique targets and excludes them from EOT shock", () => {
    const ids = appendAttackedThisTurn(["t1"], "t2");
    assert.deepEqual(ids, ["t1", "t2"]);
    assert.deepEqual(appendAttackedThisTurn(ids, "t1"), ["t1", "t2"]);
    const foes = [{ id: "t1" }, { id: "t3" }];
    assert.deepEqual(adjacentShockTargets(foes, ids).map((f) => f.id), ["t3"]);
  });
});
