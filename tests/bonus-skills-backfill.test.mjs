/**
 * Unit tests for the 2.0.0-beta4 bonus-skill-grant backfill (no Foundry
 * runtime beyond shim).
 * Run: node --test tests/bonus-skills-backfill.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  needsBonusSkillsBackfill,
  computeBackfillSlugs,
} from "../module/migration/bonus-skills-backfill.mjs";

function mockItem({ type, name = "", flags = {}, system = {} }) {
  return {
    type,
    name,
    system,
    getFlag: (ns, key) => flags?.[ns]?.[key],
  };
}

describe("needsBonusSkillsBackfill", () => {
  it("is false when the item never granted anything (no legacy flag)", () => {
    const focus = mockItem({ type: "focus", flags: {}, system: {} });
    assert.equal(needsBonusSkillsBackfill(focus), false);
  });

  it("is true for a focus with the legacy granted flag but no new array", () => {
    const focus = mockItem({
      type: "focus",
      flags: { wwn: { focusBonusGranted: true } },
      system: {},
    });
    assert.equal(needsBonusSkillsBackfill(focus), true);
  });

  it("is false once the new bonusSkillsGranted array already exists", () => {
    const focus = mockItem({
      type: "focus",
      flags: { wwn: { focusBonusGranted: true, bonusSkillsGranted: ["talk"] } },
      system: {},
    });
    assert.equal(needsBonusSkillsBackfill(focus), false);
  });

  it("checks the matching legacy flag for power and classEdge", () => {
    const power = mockItem({ type: "power", flags: { wwn: { powerBonusGranted: true } }, system: {} });
    const edge = mockItem({ type: "classEdge", flags: { wwn: { classEdgeBonusGranted: true } }, system: {} });
    assert.equal(needsBonusSkillsBackfill(power), true);
    assert.equal(needsBonusSkillsBackfill(edge), true);

    const wrongFlag = mockItem({ type: "power", flags: { wwn: { classEdgeBonusGranted: true } }, system: {} });
    assert.equal(needsBonusSkillsBackfill(wrongFlag), false);
  });

  it("ignores item types with no bonus-skill grant path", () => {
    const skill = mockItem({ type: "skill", flags: { wwn: { focusBonusGranted: true } }, system: {} });
    assert.equal(needsBonusSkillsBackfill(skill), false);
  });
});

describe("computeBackfillSlugs", () => {
  it("Diplomat (declared-only, single skill) resolves to its always-granted skill", () => {
    const focus = mockItem({
      type: "focus",
      system: { bonusSkills: ["talk"], bonusSkillsPick: 1, bonusSkillsChosen: [] },
    });
    // The focus is literally named "Diplomat" in FOCUS_BONUS_SKILL_SEEDS-driven data —
    // resolution here is by resolveChoiceBonusSkillSlugs's own declared-list logic,
    // not the focus name, so any single-declared-skill focus behaves the same way.
    assert.deepEqual(computeBackfillSlugs(focus), ["talk"]);
  });

  it("Specialist (open choice, already chosen) resolves to the chosen skill", () => {
    const focus = mockItem({
      type: "focus",
      system: { bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: ["talk"] },
      name: "Specialist",
    });
    assert.deepEqual(computeBackfillSlugs(focus), ["talk"]);
  });

  it("Orc combines its always-granted and chosen skills", () => {
    const focus = mockItem({
      type: "focus",
      name: "Origin Focus: Orc",
      system: { bonusSkills: ["stab", "punch"], bonusSkillsPick: 1, bonusSkillsChosen: ["stab"] },
    });
    assert.deepEqual(computeBackfillSlugs(focus).sort(), ["stab", "survive"]);
  });

  it("classEdge/power resolve through resolvePowerBonusSkillSlugs", () => {
    const edge = mockItem({
      type: "classEdge",
      system: { bonusSkills: ["stab"], bonusSkillsPick: 1, bonusSkillsChosen: [], bonusSkillsMode: "" },
    });
    assert.deepEqual(computeBackfillSlugs(edge), ["stab"]);
  });

  it("returns an empty list for a focus with no bonus-skill config at all", () => {
    const focus = mockItem({ type: "focus", system: { bonusSkills: [], bonusSkillsPick: 0, bonusSkillsChosen: [] } });
    assert.deepEqual(computeBackfillSlugs(focus), []);
  });
});
