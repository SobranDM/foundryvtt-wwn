/**
 * Node unit tests for character-level gates when buying a skill rank.
 * Run: node --test tests/skill-level-req.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSkillLevelRequirement } from "../module/helpers/skill-points.mjs";

describe("evaluateSkillLevelRequirement", () => {
  it("allows untrained (-1) and skill-0 buys at any character level", () => {
    assert.equal(evaluateSkillLevelRequirement(-1, 1).ok, true);
    assert.equal(evaluateSkillLevelRequirement(0, 1).ok, true);
  });

  it("requires level 3 / 6 / 9 for skill-1 / 2 / 3 buys", () => {
    assert.deepEqual(evaluateSkillLevelRequirement(1, 2), { ok: false, reason: "levelTooLow" });
    assert.equal(evaluateSkillLevelRequirement(1, 3).ok, true);
    assert.deepEqual(evaluateSkillLevelRequirement(2, 5), { ok: false, reason: "levelTooLow" });
    assert.equal(evaluateSkillLevelRequirement(2, 6).ok, true);
    assert.deepEqual(evaluateSkillLevelRequirement(3, 8), { ok: false, reason: "levelTooLow" });
    assert.equal(evaluateSkillLevelRequirement(3, 9).ok, true);
  });

  it("blocks auto-level above skill-4", () => {
    assert.deepEqual(evaluateSkillLevelRequirement(4, 10), { ok: false, reason: "maxRank" });
  });
});
