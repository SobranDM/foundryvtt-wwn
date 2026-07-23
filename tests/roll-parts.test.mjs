import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RollParts,
  normalizeRollPart,
  resolveSkillDiceFormula,
  skillDiceCount,
} from "../module/dice/roll-parts.mjs";

describe("resolveSkillDiceFormula", () => {
  it("keeps real dice formulas", () => {
    assert.equal(resolveSkillDiceFormula("2d6"), "2d6");
    assert.equal(resolveSkillDiceFormula("3d6kh2"), "3d6kh2");
    assert.equal(resolveSkillDiceFormula("4d6kh2"), "4d6kh2");
    assert.equal(resolveSkillDiceFormula(" 3d6dl1 "), "3d6dl1");
  });

  it("maps bare dice counts onto skill-dice options", () => {
    assert.equal(resolveSkillDiceFormula(2), "2d6");
    assert.equal(resolveSkillDiceFormula("2"), "2d6");
    assert.equal(resolveSkillDiceFormula("3"), "3d6kh2");
    assert.equal(resolveSkillDiceFormula(4), "4d6kh2");
    assert.equal(resolveSkillDiceFormula("1"), "1d6");
  });

  it("defaults blank or invalid values to 2d6", () => {
    assert.equal(resolveSkillDiceFormula(""), "2d6");
    assert.equal(resolveSkillDiceFormula(null), "2d6");
    assert.equal(resolveSkillDiceFormula(undefined), "2d6");
    assert.equal(resolveSkillDiceFormula("nope"), "2d6");
  });
});

describe("skillDiceCount", () => {
  it("reads dice count from formulas and bare tiers", () => {
    assert.equal(skillDiceCount("2d6"), 2);
    assert.equal(skillDiceCount("3d6kh2"), 3);
    assert.equal(skillDiceCount("4"), 4);
    assert.equal(skillDiceCount(""), 2);
  });
});

describe("RollParts + skill dice", () => {
  it("does not coerce 2d6 into a flat modifier", () => {
    assert.equal(normalizeRollPart("2d6"), "2d6");
    const parts = new RollParts();
    parts.add(resolveSkillDiceFormula("2d6"), "Skill Dice");
    parts.add(2, "Pilot");
    parts.add(1, "INT");
    assert.equal(parts.formula(), "2d6 + 2 + 1");
  });

  it("bare skillDice counts become a dice pool, not a flat +2/+3", () => {
    const parts = new RollParts();
    parts.add(resolveSkillDiceFormula("3"), "Skill Dice");
    parts.add(1, "Pilot");
    assert.equal(parts.formula(), "3d6kh2 + 1");
    assert.match(parts.breakdown(), /3d6kh2/);
  });

  it("breakdown uses minus for negative modifiers", () => {
    const parts = new RollParts();
    parts.add("1d20", "Die");
    parts.add(-2, "Armor Penalty");
    parts.add(1, "DEX");
    assert.equal(parts.breakdown(), "1d20 (Die) - 2 (Armor Penalty) + 1 (DEX)");
    assert.equal(parts.formula(), "1d20 - 2 + 1");
  });
});
