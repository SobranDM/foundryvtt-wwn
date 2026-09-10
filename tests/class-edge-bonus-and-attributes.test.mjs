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
import { findSkillBySlug, planBonusSkillGrant } from "../module/helpers/bonus-skills-shared.mjs";
import { skillCreateDataFromPackDocs } from "../module/helpers/skill-set.mjs";
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

  it("plans to create a secondary skill that is not on the actor", () => {
    const actor = {
      items: [
        { type: "skill", name: "Sneak", system: { ownedLevel: -1 } },
      ],
    };
    assert.equal(findSkillBySlug(actor, "sneak")?.name, "Sneak");
    assert.equal(findSkillBySlug(actor, "biopsionics"), undefined);
    assert.deepEqual(planBonusSkillGrant(actor, "sneak"), {
      action: "grant",
      slug: "sneak",
      skill: actor.items[0],
    });
    assert.deepEqual(planBonusSkillGrant(actor, "biopsionics"), {
      action: "create",
      slug: "biopsionics",
    });
  });

  it("builds create data for a missing pack skill without keeping pack ids", () => {
    const docs = [
      {
        name: "Sneak",
        type: "skill",
        _id: "packSneak",
        folder: "skillsFolder",
        _key: "!items!packSneak",
        system: { secondary: false, ownedLevel: -1 },
      },
      {
        name: "Biopsionics",
        type: "skill",
        _id: "sGRJCGdERZt1iQHK",
        folder: "K5CjewzS46t4IezS",
        _key: "!items!sGRJCGdERZt1iQHK",
        system: { secondary: true, ownedLevel: -1, score: "int" },
      },
    ];
    const data = skillCreateDataFromPackDocs(docs, "biopsionics");
    assert.equal(data.name, "Biopsionics");
    assert.equal(data.type, "skill");
    assert.equal(data.system.secondary, true);
    assert.equal(data.system.ownedLevel, -1);
    assert.equal(data._id, undefined);
    assert.equal(data.folder, undefined);
    assert.equal(data._key, undefined);
    assert.equal(skillCreateDataFromPackDocs(docs, "missing"), null);
  });

  it("Educated any-mode needs choice", () => {
    const edge = {
      type: "classEdge",
      system: { bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: [], bonusSkillsMode: "any" },
    };
    assert.equal(powerNeedsBonusSkillChoice(edge), true);
  });

  it("resolves a listed Magic grant without a prompt", () => {
    const edge = {
      type: "classEdge",
      system: { bonusSkills: ["magic"], bonusSkillsPick: 1, bonusSkillsChosen: [], bonusSkillsMode: "" },
    };
    assert.equal(powerNeedsBonusSkillChoice(edge), false);
    assert.deepEqual(resolvePowerBonusSkillSlugs(edge), ["magic"]);
  });

  it("Vowed noncombat mode needs a pick and excludes Punch/Stab/Shoot", async () => {
    const { filterOpenBonusSkillSlugs } = await import("../module/helpers/bonus-skills-shared.mjs");
    const edge = {
      type: "classEdge",
      system: { bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: [], bonusSkillsMode: "noncombat" },
    };
    assert.equal(powerNeedsBonusSkillChoice(edge), true);
    assert.equal(resolvePowerBonusSkillSlugs(edge), null);
    assert.deepEqual(
      filterOpenBonusSkillSlugs(
        ["administer", "exert", "magic", "punch", "shoot", "stab", "survive"],
        "noncombat",
      ),
      ["administer", "exert", "magic", "survive"],
    );
    edge.system.bonusSkillsChosen = ["exert"];
    assert.equal(powerNeedsBonusSkillChoice(edge), false);
    assert.deepEqual(resolvePowerBonusSkillSlugs(edge), ["exert"]);
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
            compute: (l) => Math.floor(l / 2) + 1 + (l >= 5 ? 1 : 0),
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

  it("ignores a spurious -half-level residual left by live actor migration", () => {
    const mage = mockPc(
      [{ type: "classEdge", system: { attackProgression: "mage" } }],
      6,
    );
    mage.system.combat.abMod = -3;
    deriveAttackBonus(mage);
    assert.equal(mage.system.combat.abBase, 1);
    assert.equal(mage.system.combat.abMod, -3);
    assert.equal(mage.system.combat.ab, 1);

    const warrior = mockPc(
      [{ type: "classEdge", system: { attackProgression: "warrior" } }],
      8,
    );
    warrior.system.combat.abMod = -4;
    deriveAttackBonus(warrior);
    assert.equal(warrior.system.combat.abBase, 8);
    assert.equal(warrior.system.combat.abMod, -4);
    assert.equal(warrior.system.combat.ab, 8);
  });

  it("still applies a real attack-bonus modifier", () => {
    const actor = mockPc(
      [{ type: "classEdge", system: { attackProgression: "warrior" } }],
      8,
    );
    actor.system.combat.abMod = 2;
    deriveAttackBonus(actor);
    assert.equal(actor.system.combat.ab, 10);
    assert.equal(actor.system.combat.abMod, 2);
  });
});

describe("power/classEdge bonus grants stay rank-only", () => {
  it("never uses the focus +3 points path even at high level with setting on", async () => {
    const { computeFocusBonusGrant } = await import("../module/helpers/focus-bonus-skills.mjs");
    // Document the contract used by power-bonus-skills grantBonusSkill:
    // computeFocusBonusGrant(skill, false) — always rank, never points.
    const skill = { system: { ownedLevel: -1, pointsInvested: 0 } };
    const grant = computeFocusBonusGrant(skill, false);
    assert.equal(grant.ownedLevel, 0);

    // Contrast: focus points path at the same skill state would cascade +3.
    const pointsGrant = computeFocusBonusGrant(skill, true);
    assert.equal(pointsGrant.ownedLevel, 1);
  });
});
