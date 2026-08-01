/**
 * Class/Edge attack bonus progressions (WWN tables).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ATTACK_PROGRESSIONS } from "../module/config/attack-progression.mjs";

describe("ATTACK_PROGRESSIONS", () => {
  it("matches Warrior / Expert / Mage tables", () => {
    const { warrior, expert, mage } = ATTACK_PROGRESSIONS;
    assert.deepEqual(
      [1, 2, 5, 10].map((l) => warrior.compute(l)),
      [1, 2, 5, 10]
    );
    assert.deepEqual(
      [1, 2, 5, 10].map((l) => expert.compute(l)),
      [0, 1, 2, 5]
    );
    assert.deepEqual(
      [1, 4, 5, 10].map((l) => mage.compute(l)),
      [0, 0, 1, 2]
    );
  });

  it("matches Partial Warrior / Adventurer AB table", () => {
    const { partialWarrior } = ATTACK_PROGRESSIONS;
    // L1–10: +1,+2,+2,+3,+4,+5,+5,+6,+6,+7
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => partialWarrior.compute(l)),
      [1, 2, 2, 3, 4, 5, 5, 6, 6, 7]
    );
  });
});
