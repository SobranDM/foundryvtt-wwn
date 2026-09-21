import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RollParts, normalizeRollPart, BASE_SKILL_DICE_COUNT } from "../module/dice/roll-parts.mjs";
import { caseInsensitiveRollData } from "../module/helpers/roll-data.mjs";

describe("RollParts + skill dice", () => {
  it("exports 2 as the base skill dice count", () => {
    assert.equal(BASE_SKILL_DICE_COUNT, 2);
  });

  it("does not coerce 2d6 into a flat modifier", () => {
    assert.equal(normalizeRollPart("2d6"), "2d6");
    const parts = new RollParts();
    parts.add(`${BASE_SKILL_DICE_COUNT}d6`, "Skill Dice");
    parts.add(2, "Pilot");
    parts.add(1, "INT");
    assert.equal(parts.formula(), "2d6 + 2 + 1");
  });

  it("a focus's extra dice raise the pool above the 2d6 base", () => {
    const parts = new RollParts();
    parts.add(`${BASE_SKILL_DICE_COUNT + 1}d6dl1`, "Skill Dice");
    parts.add(1, "Pilot");
    assert.equal(parts.formula(), "3d6dl1 + 1");
    assert.match(parts.breakdown(), /3d6dl1/);
  });

  it("breakdown uses minus for negative modifiers", () => {
    const parts = new RollParts();
    parts.add("1d20", "Die");
    parts.add(-2, "Armor Penalty");
    parts.add(1, "DEX");
    assert.equal(parts.breakdown(), "1d20 (Die) - 2 (Armor Penalty) + 1 (DEX)");
    assert.equal(parts.formula(), "1d20 - 2 + 1");
  });

  it("resolves @skill in the breakdown tooltip to the numeric skill level", () => {
    const parts = new RollParts({ sunblade: 2, stab: 1 });
    parts.add("3d8 + @sunblade", "Weapon Damage");
    parts.add(1, "DEX");
    assert.equal(parts.formula(), "3d8 + 2 + 1");
    assert.equal(parts.breakdown(), "3d8 + 2 (Weapon Damage) + 1 (DEX)");
  });

  it("resolves mixed-case @Skill the same as the lowercase skill key", () => {
    const parts = new RollParts(caseInsensitiveRollData({ stab: 3 }));
    parts.add("1d6 + @Stab", "Weapon Damage");
    assert.equal(parts.breakdown(), "1d6 + 3 (Weapon Damage)");
  });
});
