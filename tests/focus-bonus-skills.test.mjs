/**
 * Unit tests for skill-point cascade and focus bonus-skill resolution.
 * Run: node --test tests/focus-bonus-skills.test.mjs
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  applySkillPoints,
  nextSkillLevelCost,
  FOCUS_BONUS_SKILL_POINTS,
} from "../module/helpers/skill-points.mjs";
import {
  alwaysBonusSkills,
  openBonusMode,
  resolveBonusSkillSlugs,
  resolveChoiceBonusSkillSlugs,
  focusNeedsBonusSkillChoice,
  shouldUseFocusBonusPoints,
  computeFocusBonusGrant,
  specialistSkillBonusPatch,
  levelBonusSkills,
} from "../module/helpers/focus-bonus-skills.mjs";
import { eligibleBonusSkillRedirectTargets } from "../module/helpers/bonus-skills-shared.mjs";
import { applyFocusBonusSkillSeed } from "../module/helpers/focus-automation-seeds.mjs";
import { migrateFocus } from "../module/migration/transforms.mjs";
import "../build/foundry-shim.mjs";

describe("nextSkillLevelCost / applySkillPoints", () => {
  it("costs level+2 normally and 1 when flat", () => {
    assert.equal(nextSkillLevelCost(-1), 1);
    assert.equal(nextSkillLevelCost(0), 2);
    assert.equal(nextSkillLevelCost(2), 4);
    assert.equal(nextSkillLevelCost(2, { flatCost: true }), 1);
  });

  it("cascades untrained +3 into level 1 with no remainder", () => {
    const out = applySkillPoints(-1, 0, 3, { flatCost: false });
    assert.deepEqual(out, { ownedLevel: 1, pointsInvested: 0, levelsGained: 2 });
  });

  it("banks leftover when cost exceeds points", () => {
    const out = applySkillPoints(2, 0, 3, { flatCost: false });
    assert.deepEqual(out, { ownedLevel: 2, pointsInvested: 3, levelsGained: 0 });
  });

  it("levels exactly when cost matches", () => {
    const out = applySkillPoints(1, 0, 3, { flatCost: false });
    assert.deepEqual(out, { ownedLevel: 2, pointsInvested: 0, levelsGained: 1 });
  });

  it("with flat cost, +3 raises three ranks", () => {
    const out = applySkillPoints(0, 0, 3, { flatCost: true });
    assert.deepEqual(out, { ownedLevel: 3, pointsInvested: 0, levelsGained: 3 });
  });

  it("exports FOCUS_BONUS_SKILL_POINTS as 3", () => {
    assert.equal(FOCUS_BONUS_SKILL_POINTS, 3);
  });
});

describe("focus bonus skill resolution", () => {
  it("resolves choose-one when pick < list", () => {
    const focus = {
      name: "Close Combatant",
      system: { bonusSkills: ["stab", "punch", "shoot"], bonusSkillsPick: 1, bonusSkillsChosen: [] },
    };
    assert.equal(focusNeedsBonusSkillChoice(focus), true);
    assert.equal(resolveChoiceBonusSkillSlugs(focus), null);
    assert.equal(resolveBonusSkillSlugs(focus), null);
  });

  it("resolves grant-all when pick equals list length", () => {
    const focus = {
      name: "Origin Focus: Elf, Civilized",
      system: { bonusSkills: ["know", "magic"], bonusSkillsPick: 2, bonusSkillsChosen: [] },
    };
    assert.equal(focusNeedsBonusSkillChoice(focus), false);
    assert.deepEqual(resolveBonusSkillSlugs(focus), ["know", "magic"]);
  });

  it("Specialist / Polymath are open choice", () => {
    assert.equal(openBonusMode({ name: "Specialist" }), "specialist");
    assert.equal(openBonusMode({ name: "Polymath" }), "any");
    const focus = { name: "Specialist", system: { bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: [] } };
    assert.equal(focusNeedsBonusSkillChoice(focus), true);
    assert.equal(resolveBonusSkillSlugs(focus), null);
  });

  it("Psychic Training and Spark of Brilliance use open modes", () => {
    assert.equal(openBonusMode({ name: "Psychic Training" }), "psychic");
    assert.equal(openBonusMode({ name: "Spark of Brilliance" }), "any");
    assert.equal(openBonusMode({ name: "All Natural" }), "any");
    assert.equal(
      focusNeedsBonusSkillChoice({
        name: "Psychic Training",
        system: { bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: [] },
      }),
      true,
    );
  });

  it("Ace Driver grants Fix at ownedLevel 2", () => {
    const l1 = { name: "Ace Driver", system: { ownedLevel: 1, bonusSkills: ["drive"], bonusSkillsPick: 1, bonusSkillsChosen: [] } };
    const l2 = { name: "Ace Driver", system: { ownedLevel: 2, bonusSkills: ["drive"], bonusSkillsPick: 1, bonusSkillsChosen: [] } };
    assert.deepEqual(levelBonusSkills(l1), []);
    assert.deepEqual(levelBonusSkills(l2), ["fix"]);
    assert.deepEqual(resolveBonusSkillSlugs(l1), ["drive"]);
    assert.deepEqual(resolveBonusSkillSlugs(l2)?.sort(), ["drive", "fix"]);
  });

  it("Apex Predator grants both skills without choice", () => {
    const focus = {
      name: "Apex Predator",
      system: { bonusSkills: ["survive", "shoot"], bonusSkillsPick: 2, bonusSkillsChosen: [] },
    };
    assert.equal(focusNeedsBonusSkillChoice(focus), false);
    assert.deepEqual(resolveChoiceBonusSkillSlugs(focus), ["survive", "shoot"]);
  });

  it("Orc always grants survive plus stab/punch choice", () => {
    const focus = {
      name: "Origin Focus: Orc",
      system: { bonusSkills: ["stab", "punch"], bonusSkillsPick: 1, bonusSkillsChosen: [] },
    };
    assert.deepEqual(alwaysBonusSkills(focus), ["survive"]);
    assert.equal(resolveBonusSkillSlugs(focus), null);
    focus.system.bonusSkillsChosen = ["stab"];
    assert.deepEqual(resolveBonusSkillSlugs(focus), ["survive", "stab"]);
  });

  it("Half-Elf always grants connect plus open choice", () => {
    const focus = {
      name: "Origin Focus: Elf, Half-Elf",
      system: { bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: [] },
    };
    assert.deepEqual(alwaysBonusSkills(focus), ["connect"]);
    assert.equal(openBonusMode(focus), "any");
    focus.system.bonusSkillsChosen = ["know"];
    assert.deepEqual(resolveBonusSkillSlugs(focus), ["connect", "know"]);
  });

  it("Chattel Blighted uses nonCombatNonMagic open mode", () => {
    assert.equal(openBonusMode({ name: "Origin Focus: Chattel Blighted" }), "nonCombatNonMagic");
  });
});

describe("shouldUseFocusBonusPoints", () => {
  const originalGame = globalThis.game;

  beforeEach(() => {
    globalThis.game = {
      settings: {
        get: (_ns, key) => {
          if (key === "bonusSkillsGrantPointsAtFirstLevel") return globalThis.__focusPointsSetting;
          return false;
        },
      },
    };
    globalThis.__focusPointsSetting = false;
  });

  afterEach(() => {
    globalThis.game = originalGame;
    delete globalThis.__focusPointsSetting;
  });

  it("uses rank path at level 1 when setting is off", () => {
    assert.equal(shouldUseFocusBonusPoints({ system: { details: { level: 1 } } }), false);
  });

  it("uses points path at level 1 when setting is on", () => {
    globalThis.__focusPointsSetting = true;
    assert.equal(shouldUseFocusBonusPoints({ system: { details: { level: 1 } } }), true);
  });

  it("uses points path at level 2+", () => {
    assert.equal(shouldUseFocusBonusPoints({ system: { details: { level: 2 } } }), true);
  });
});

describe("computeFocusBonusGrant", () => {
  it("rank path trains an untrained skill to 0", () => {
    const grant = computeFocusBonusGrant({ system: { ownedLevel: -1, pointsInvested: 0 } }, false);
    assert.equal(grant.ownedLevel, 0);
    assert.equal(grant.pointsInvested, 0);
  });

  it("rank path raises an already-trained skill by one more rank", () => {
    // A second focus granting a bonus to a skill you're already trained in
    // (e.g. two different foci both choosing the same skill) is a real
    // rank increase, not a wasted no-op.
    const grant = computeFocusBonusGrant({ system: { ownedLevel: 0, pointsInvested: 0 } }, false);
    assert.equal(grant.ownedLevel, 1);
  });

  it("points path cascades", () => {
    const grant = computeFocusBonusGrant({ system: { ownedLevel: -1, pointsInvested: 0 } }, true);
    assert.equal(grant.ownedLevel, 1);
    assert.equal(grant.pointsInvested, 0);
  });

  describe("respects the character-level rank cap (evaluateSkillLevelRequirement)", () => {
    const originalGame = globalThis.game;

    afterEach(() => {
      globalThis.game = originalGame;
    });

    it("rank path: untrained -> 0 is never gated, even at level 1", () => {
      const grant = computeFocusBonusGrant({ system: { ownedLevel: -1, pointsInvested: 0 } }, false, 1);
      assert.equal(grant.ownedLevel, 0);
    });

    it("rank path: a level-1 character's already-trained (rank 0) skill can still reach rank 1", () => {
      // Rank 0 -> 1 has no level gate (matches two stacked focus grants
      // reaching rank 1 at level 1, per evaluateSkillLevelRequirement).
      const grant = computeFocusBonusGrant({ system: { ownedLevel: 0, pointsInvested: 0 } }, false, 1);
      assert.equal(grant.ownedLevel, 1);
    });

    it("rank path: a level-1 character's rank-1 skill cannot be pushed to rank 2 by a focus grant", () => {
      // This is the reported bug: rank 1 -> 2 needs character level 3.
      // A free grant must respect the same cap a manual purchase would.
      const grant = computeFocusBonusGrant({ system: { ownedLevel: 1, pointsInvested: 0 } }, false, 1);
      assert.equal(grant.ownedLevel, 1, "must stay at rank 1 -- the character isn't level 3 yet");
      assert.equal(grant.blocked, true, "blocked grants are flagged so the caller can offer a redirect");
    });

    it("rank path: an unblocked grant reports blocked: false", () => {
      const grant = computeFocusBonusGrant({ system: { ownedLevel: 0, pointsInvested: 0 } }, false, 1);
      assert.equal(grant.blocked, false);
    });

    it("rank path: the same rank-1 skill CAN advance once the character is level 3", () => {
      const grant = computeFocusBonusGrant({ system: { ownedLevel: 1, pointsInvested: 0 } }, false, 3);
      assert.equal(grant.ownedLevel, 2);
      assert.equal(grant.blocked, false);
    });

    it("rank path: the noSkillLevelReq house-rule setting bypasses the gate", () => {
      globalThis.game = { settings: { get: (_ns, key) => key === "noSkillLevelReq" } };
      const grant = computeFocusBonusGrant({ system: { ownedLevel: 1, pointsInvested: 0 } }, false, 1);
      assert.equal(grant.ownedLevel, 2);
    });

    it("points path: a level-2 character's rank-1 skill does not cascade past rank 1", () => {
      // Level 2 forces the points path (shouldUseFocusBonusPoints), but
      // rank 1 -> 2 still needs character level 3 -- the +3 points must
      // bank rather than push past the cap.
      const grant = computeFocusBonusGrant({ system: { ownedLevel: 1, pointsInvested: 0 } }, true, 2);
      assert.equal(grant.ownedLevel, 1);
      assert.equal(grant.pointsInvested, 3, "the points are banked, not spent past the gate");
    });

    it("points path: the same rank-1 skill cascades normally once the character is level 3", () => {
      const grant = computeFocusBonusGrant({ system: { ownedLevel: 1, pointsInvested: 0 } }, true, 3);
      assert.equal(grant.ownedLevel, 2);
      assert.equal(grant.pointsInvested, 0);
    });
  });
});

describe("eligibleBonusSkillRedirectTargets", () => {
  const originalGame = globalThis.game;
  afterEach(() => {
    globalThis.game = originalGame;
  });

  function makeActor(skills) {
    return {
      items: skills.map((s) => ({ id: s.id, type: "skill", system: { ownedLevel: s.ownedLevel } })),
    };
  }

  it("excludes the blocked skill itself", () => {
    const actor = makeActor([{ id: "blocked", ownedLevel: 1 }, { id: "other", ownedLevel: 0 }]);
    const targets = eligibleBonusSkillRedirectTargets(actor, ["blocked"], 1);
    assert.deepEqual(targets.map((s) => s.id), ["other"]);
  });

  it("excludes other skills that would also be blocked by the same level cap", () => {
    const actor = makeActor([
      { id: "blocked", ownedLevel: 1 },
      { id: "also-capped", ownedLevel: 1 },
      { id: "eligible", ownedLevel: 0 },
    ]);
    const targets = eligibleBonusSkillRedirectTargets(actor, ["blocked"], 1);
    assert.deepEqual(targets.map((s) => s.id), ["eligible"]);
  });

  it("returns nothing when every other skill is also capped", () => {
    const actor = makeActor([{ id: "blocked", ownedLevel: 1 }, { id: "also-capped", ownedLevel: 1 }]);
    const targets = eligibleBonusSkillRedirectTargets(actor, ["blocked"], 1);
    assert.deepEqual(targets, []);
  });

  it("allows any other skill when the noSkillLevelReq house-rule is on", () => {
    globalThis.game = { settings: { get: (_ns, key) => key === "noSkillLevelReq" } };
    const actor = makeActor([{ id: "blocked", ownedLevel: 1 }, { id: "also-rank-1", ownedLevel: 1 }]);
    const targets = eligibleBonusSkillRedirectTargets(actor, ["blocked"], 1);
    assert.deepEqual(targets.map((s) => s.id), ["also-rank-1"]);
  });

  it("excludes reserved sibling skills even when they'd otherwise be eligible", () => {
    // A sibling slug this same grant pass is also about to touch has its
    // own pending entitlement -- it must not be offered as a dumping
    // ground for a different slug's blocked grant (see the code-review
    // finding this test guards against: two declared bonus skills on one
    // focus, where the first is blocked and the second isn't yet granted).
    const actor = makeActor([
      { id: "blocked", ownedLevel: 1 },
      { id: "sibling", ownedLevel: 0 },
      { id: "unrelated", ownedLevel: 0 },
    ]);
    const targets = eligibleBonusSkillRedirectTargets(actor, ["blocked", "sibling"], 1);
    assert.deepEqual(targets.map((s) => s.id), ["unrelated"]);
  });
});

describe("specialistSkillBonusPatch", () => {
  it("sets skillBonus from chosen skill when empty", () => {
    assert.deepEqual(
      specialistSkillBonusPatch({ name: "Specialist", system: { skillBonus: "" } }, ["sneak"]),
      { "system.skillBonus": "sneak" },
    );
  });

  it("does not overwrite an existing skillBonus", () => {
    assert.equal(
      specialistSkillBonusPatch({ name: "Specialist", system: { skillBonus: "know" } }, ["sneak"]),
      null,
    );
  });

  it("ignores non-Specialist foci", () => {
    assert.equal(specialistSkillBonusPatch({ name: "Polymath", system: { skillBonus: "" } }, ["know"]), null);
  });
});

describe("applyFocusBonusSkillSeed / migrateFocus", () => {
  it("fills Specialist pick and bonusDice", () => {
    const system = { bonusSkills: [], bonusSkillsPick: 0, bonusDice: null, skillBonus: "" };
    applyFocusBonusSkillSeed(system, "Specialist");
    assert.equal(system.bonusSkillsPick, 1);
    assert.equal(system.bonusDice, 1);
  });

  it("migrateFocus seeds Gifted Chirurgeon heal dice", () => {
    const out = migrateFocus({
      _id: "ChirParent000001",
      name: "Gifted Chirurgeon",
      type: "focus",
      system: {},
      effects: [],
    });
    assert.deepEqual(out.system.bonusSkills, ["heal"]);
    assert.equal(out.system.bonusSkillsPick, 1);
    assert.equal(out.system.bonusDice, 1);
    assert.equal(out.system.skillBonus, "heal");
  });

  it("migrateFocus seeds Orc fixed + choice AEs", () => {
    const out = migrateFocus({
      _id: "OrcParent0000001",
      name: "Origin Focus: Orc",
      type: "focus",
      system: {},
      effects: [],
    });
    assert.deepEqual(out.system.bonusSkills, ["stab", "punch"]);
    assert.equal(out.system.bonusSkillsPick, 1);
    assert.ok(out.effects.some((e) => e.name === "Orc (Level 1)"));
    assert.ok(out.effects.some((e) => e.name === "Orc (Strength +1)" && e.disabled));
  });

  it("migrateFocus does not duplicate Orc seeds", () => {
    const first = migrateFocus({
      _id: "OrcParent0000001",
      name: "Origin Focus: Orc",
      type: "focus",
      system: {},
      effects: [],
    });
    const second = migrateFocus(first);
    assert.equal(second.effects.length, first.effects.length);
  });
});
