/**
 * Unit tests for focus skill-dice bonuses.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getFocusSkillDiceBonus } from "../module/helpers/focus-skill-dice.mjs";

describe("getFocusSkillDiceBonus", () => {
  it("returns zeros with no matching focus", () => {
    assert.deepEqual(
      getFocusSkillDiceBonus({ items: [] }, "stab"),
      { extraDice: 0, dropLowest: 0 },
    );
  });

  it("takes the highest matching bonusDice", () => {
    const actor = {
      items: [
        { type: "focus", name: "A", system: { ownedLevel: 1, skillBonus: "stab", bonusDice: 1 } },
        { type: "focus", name: "B", system: { ownedLevel: 1, skillBonus: "stab", bonusDice: 2 } },
      ],
    };
    assert.deepEqual(getFocusSkillDiceBonus(actor, "stab"), { extraDice: 2, dropLowest: 2 });
  });

  it("floors Specialist L2 to at least 2 extra dice", () => {
    const actor = {
      items: [
        {
          type: "focus",
          name: "Specialist",
          system: { ownedLevel: 2, skillBonus: "know", bonusDice: 1 },
        },
      ],
    };
    assert.deepEqual(getFocusSkillDiceBonus(actor, "know"), { extraDice: 2, dropLowest: 2 });
  });

  it("ignores foci below ownedLevel 1", () => {
    const actor = {
      items: [
        { type: "focus", name: "A", system: { ownedLevel: 0, skillBonus: "stab", bonusDice: 2 } },
      ],
    };
    assert.deepEqual(getFocusSkillDiceBonus(actor, "stab"), { extraDice: 0, dropLowest: 0 });
  });
});
