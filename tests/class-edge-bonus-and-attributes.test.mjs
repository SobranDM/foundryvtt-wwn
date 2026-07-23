/**
 * Unit tests for classEdge bonus skills, attribute grants, and AB with edges.
 */
import "../build/foundry-shim.mjs";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  powerNeedsBonusSkillChoice,
  resolvePowerBonusSkillSlugs,
} from "../module/helpers/power-bonus-skills.mjs";
import {
  attributeGrantChanges,
  classEdgeNeedsAttributeChoice,
} from "../module/helpers/class-edge-attribute-grants.mjs";
import { deriveAttackBonus } from "../module/derivations/attack-bonus.mjs";

describe("classEdge bonus skill resolution", () => {
  it("resolves fixed Ghost sneak grant", () => {
    const edge = {
      type: "classEdge",
      system: { bonusSkills: ["sneak"], bonusSkillsPick: 1, bonusSkillsChosen: [], bonusSkillsMode: "" },
    };
    assert.equal(powerNeedsBonusSkillChoice(edge), false);
    assert.deepEqual(resolvePowerBonusSkillSlugs(edge), ["sneak"]);
  });

  it("requires pick for Full Psychic two-of-list", () => {
    const edge = {
      type: "classEdge",
      system: {
        bonusSkills: ["biopsionics", "telepathy", "telekinesis"],
        bonusSkillsPick: 2,
        bonusSkillsChosen: [],
        bonusSkillsMode: "",
      },
    };
    assert.equal(powerNeedsBonusSkillChoice(edge), true);
    assert.equal(resolvePowerBonusSkillSlugs(edge), null);
  });

  it("Educated any-mode needs choice", () => {
    const edge = {
      type: "classEdge",
      system: { bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: [], bonusSkillsMode: "any" },
    };
    assert.equal(powerNeedsBonusSkillChoice(edge), true);
  });
});

describe("attributeGrantChanges", () => {
  it("builds prodigy overrides", () => {
    assert.deepEqual(attributeGrantChanges("prodigy", "str"), [
      { key: "system.abilities.str.value", type: "override", value: 18, phase: "initial" },
      { key: "system.abilities.str.mod", type: "override", value: 3, phase: "final" },
    ]);
  });

  it("needs choice when mode set and chosen empty", () => {
    assert.equal(
      classEdgeNeedsAttributeChoice({
        type: "classEdge",
        system: { attributeGrant: { mode: "prodigy", chosen: "" } },
      }),
      true,
    );
    assert.equal(
      classEdgeNeedsAttributeChoice({
        type: "classEdge",
        system: { attributeGrant: { mode: "prodigy", chosen: "int" } },
      }),
      false,
    );
  });
});

describe("attack bonus with edges", () => {
  before(() => {
    globalThis.CONFIG = {
      WWN: {
        attackProgressions: {
          none: { compute: () => 0 },
          expert: { compute: (l) => Math.floor(l / 2) },
          warrior: { compute: (l) => l },
          mage: { compute: (l) => Math.floor(l / 5) },
          partialWarrior: {
            compute: (l) => Math.floor(l / 2) + Math.ceil(l / 4),
          },
        },
      },
    };
  });

  function mockPc(items, level = 5) {
    return {
      type: "character",
      items,
      system: {
        details: { level },
        combat: { abMod: 0 },
      },
    };
  }

  it("defaults to expert when only none-progression edges", () => {
    const actor = mockPc([
      { type: "classEdge", system: { attackProgression: "none" } },
      { type: "classEdge", system: { attackProgression: "none" } },
    ]);
    deriveAttackBonus(actor);
    assert.equal(actor.system.combat.abBase, 2);
    assert.equal(actor.system.combat.ab, 2);
  });

  it("On Target warrior wins over expert baseline", () => {
    const actor = mockPc([
      { type: "classEdge", system: { attackProgression: "none" } },
      { type: "classEdge", system: { attackProgression: "warrior" } },
    ]);
    deriveAttackBonus(actor);
    assert.equal(actor.system.combat.abBase, 5);
  });

  it("mage-only class is unchanged (no expert floor)", () => {
    const actor = mockPc([
      { type: "classEdge", system: { attackProgression: "mage" } },
    ]);
    deriveAttackBonus(actor);
    assert.equal(actor.system.combat.abBase, 1);
  });
});
