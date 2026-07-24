/**
 * Unit tests for PC compendium sync fingerprints (no Foundry runtime beyond shim).
 * Run: node --test tests/pc-compendium-sync.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  itemSyncKey,
  effectsFingerprint,
  classEdgeGrantsFingerprint,
  powerShapeFingerprint,
  itemShapeFingerprint,
  extractPreservedFields,
  buildReplacementData,
  needsCompendiumSwap,
} from "../module/migration/pc-compendium-sync.mjs";

describe("itemSyncKey", () => {
  it("keys focus and classEdge by type and lowercased name", () => {
    assert.equal(itemSyncKey({ type: "focus", name: " Alert " }), "focus::alert");
    assert.equal(itemSyncKey({ type: "classEdge", name: "Warrior" }), "classEdge::warrior");
  });

  it("keys powers by subtype and name", () => {
    assert.equal(
      itemSyncKey({ type: "power", name: "Shattering Strike", system: { subType: "art" } }),
      "power::art::shattering strike"
    );
  });

  it("returns null for unsupported types", () => {
    assert.equal(itemSyncKey({ type: "skill", name: "Exert" }), null);
  });
});

describe("effectsFingerprint", () => {
  it("is order-independent over change tuples", () => {
    const a = {
      effects: [
        {
          system: {
            changes: [
              { key: "system.combat.ac.mod", type: "add", value: 1, phase: "initial" },
              { key: "system.movement.bonus", type: "add", value: 2, phase: "initial" },
            ],
          },
        },
      ],
    };
    const b = {
      effects: [
        {
          system: {
            changes: [
              { key: "system.movement.bonus", type: "add", value: 2, phase: "initial" },
              { key: "system.combat.ac.mod", type: "add", value: 1, phase: "initial" },
            ],
          },
        },
      ],
    };
    assert.equal(effectsFingerprint(a), effectsFingerprint(b));
  });

  it("differs when a change is missing", () => {
    const withAe = {
      effects: [
        {
          system: {
            changes: [
              { key: "system.combat.initiative.individual.roll", type: "override", value: "2d8kh", phase: "initial" },
            ],
          },
        },
      ],
    };
    const bare = { effects: [] };
    assert.notEqual(effectsFingerprint(withAe), effectsFingerprint(bare));
  });
});

describe("classEdgeGrantsFingerprint", () => {
  it("ignores poolGrant.value", () => {
    const a = classEdgeGrantsFingerprint({
      attackProgression: "warrior",
      poolGrant: { name: "Effort", formula: "1+@level", value: 3 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    const b = classEdgeGrantsFingerprint({
      attackProgression: "warrior",
      poolGrant: { name: "Effort", formula: "1+@level", value: 0 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    assert.equal(a, b);
  });

  it("changes when formula changes", () => {
    const a = classEdgeGrantsFingerprint({
      attackProgression: "none",
      poolGrant: { name: "Effort", formula: "1", value: 0 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    const b = classEdgeGrantsFingerprint({
      attackProgression: "none",
      poolGrant: { name: "Effort", formula: "2", value: 0 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    assert.notEqual(a, b);
  });
});

describe("powerShapeFingerprint", () => {
  it("ignores poolCommitted and prepared", () => {
    const a = powerShapeFingerprint({
      damageRoll: "(@level)d12",
      healing: false,
      activation: { roll: "" },
      poolCommitted: { scene: 2 },
      prepared: true,
    });
    const b = powerShapeFingerprint({
      damageRoll: "(@level)d12",
      healing: false,
      activation: { roll: "" },
      poolCommitted: { scene: 0 },
      prepared: false,
    });
    assert.equal(a, b);
  });

  it("changes when damageRoll moves from activation", () => {
    const owned = powerShapeFingerprint({
      damageRoll: "",
      activation: { roll: "1d12" },
    });
    const pack = powerShapeFingerprint({
      damageRoll: "(@level)d12",
      activation: { roll: "" },
    });
    assert.notEqual(owned, pack);
  });
});

describe("itemShapeFingerprint / needsCompendiumSwap", () => {
  it("detects stale Alert without AEs", () => {
    const owned = { type: "focus", name: "Alert", effects: [], system: { ownedLevel: 2 } };
    const pack = {
      type: "focus",
      name: "Alert",
      effects: [
        {
          system: {
            changes: [
              { key: "system.combat.initiative.individual.roll", type: "override", value: "2d8kh", phase: "initial" },
            ],
          },
        },
      ],
      system: { ownedLevel: 1 },
    };
    assert.notEqual(itemShapeFingerprint(owned), itemShapeFingerprint(pack));
    assert.equal(needsCompendiumSwap(owned, pack), true);
  });

  it("detects stale power roll placement", () => {
    const owned = {
      type: "power",
      name: "Shattering Strike",
      effects: [],
      system: { subType: "art", damageRoll: "", activation: { roll: "1d12" } },
    };
    const pack = {
      type: "power",
      name: "Shattering Strike",
      effects: [],
      system: { subType: "art", damageRoll: "(@level)d12", activation: { roll: "" } },
    };
    assert.equal(needsCompendiumSwap(owned, pack), true);
  });

  it("does not swap when fingerprints match", () => {
    const item = {
      type: "focus",
      name: "Alert",
      effects: [
        {
          system: {
            changes: [{ key: "system.combat.immuneToSurprise", type: "override", value: "true", phase: "initial" }],
          },
        },
      ],
      system: {},
    };
    assert.equal(needsCompendiumSwap(item, foundry.utils.deepClone(item)), false);
  });
});

describe("extractPreservedFields / buildReplacementData", () => {
  it("preserves focus progress onto pack definition", () => {
    const owned = {
      type: "focus",
      name: "Alert",
      system: {
        ownedLevel: 2,
        bonusSkillsChosen: ["notice"],
        internalResource: { value: 1, max: 2 },
        bonusDice: 1,
      },
    };
    const preserved = extractPreservedFields(owned);
    assert.equal(preserved.ownedLevel, 2);
    assert.deepEqual(preserved.bonusSkillsChosen, ["notice"]);

    const pack = {
      _id: "packid",
      _key: "!items!packid",
      type: "focus",
      name: "Alert",
      system: {
        ownedLevel: 1,
        bonusSkillsChosen: [],
        internalResource: { value: 0, max: 0 },
        description: "New text",
      },
      effects: [{ _id: "e1", _key: "x", system: { changes: [] } }],
    };
    const created = buildReplacementData(pack, preserved);
    assert.equal(created._id, undefined);
    assert.equal(created.system.ownedLevel, 2);
    assert.deepEqual(created.system.bonusSkillsChosen, ["notice"]);
    assert.equal(created.system.description, "New text");
    assert.equal(created.effects[0]._id, undefined);
  });

  it("preserves classEdge poolGrant.value only", () => {
    const owned = {
      type: "classEdge",
      name: "Mage",
      system: {
        poolGrant: { name: "Effort", formula: "old", value: 4 },
        attackProgression: "mage",
      },
    };
    const preserved = extractPreservedFields(owned);
    const pack = {
      type: "classEdge",
      name: "Mage",
      system: {
        poolGrant: { name: "Effort", formula: "1+@level", value: 0 },
        attackProgression: "mage",
      },
      effects: [],
    };
    const created = buildReplacementData(pack, preserved);
    assert.equal(created.system.poolGrant.value, 4);
    assert.equal(created.system.poolGrant.formula, "1+@level");
  });

  it("preserves power spend and technique level", () => {
    const owned = {
      type: "power",
      name: "Psychic Succor",
      system: {
        subType: "psychic",
        poolCommitted: { none: 0, active: 0, scene: 0, day: 1 },
        prepared: false,
        isActive: true,
        internalResource: { value: 2, max: 3 },
        level: 2,
      },
    };
    const preserved = extractPreservedFields(owned);
    const pack = {
      type: "power",
      name: "Psychic Succor",
      system: {
        subType: "psychic",
        damageRoll: "1d6+1",
        healing: true,
        poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
        prepared: true,
        isActive: false,
        internalResource: { value: 0, max: 0 },
        level: 0,
      },
      effects: [],
    };
    const created = buildReplacementData(pack, preserved);
    assert.equal(created.system.poolCommitted.day, 1);
    assert.equal(created.system.isActive, true);
    assert.equal(created.system.level, 2);
    assert.equal(created.system.damageRoll, "1d6+1");
    assert.equal(created.system.healing, true);
  });
});
