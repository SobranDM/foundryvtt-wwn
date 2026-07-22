/**
 * Unit tests for classEdge HD and prepared/cast derivation.
 * Run: node --test tests/class-edge-grants.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { combineHdGrants } from "../module/derivations/class-edge-hd.mjs";
import {
  derivePreparedMax,
  hasDualPartialSpellcasters,
  progressionAtLevel,
  resolveCastProgression,
  DUAL_PARTIAL_CAST,
  DUAL_PARTIAL_PREPARED,
} from "../module/derivations/prepared-spells.mjs";

describe("combineHdGrants", () => {
  it("returns null with no grants", () => {
    assert.equal(combineHdGrants([]), null);
    assert.equal(combineHdGrants([{ name: "Full Expert", system: { hdGrant: { die: "", perLevelMod: 0 } } }]), null);
  });

  it("takes warrior d6+2 over expert d6+0", () => {
    const result = combineHdGrants([
      { name: "Partial Expert", system: { hdGrant: { die: "d6", perLevelMod: 0 } } },
      { name: "Partial Warrior", system: { hdGrant: { die: "d6", perLevelMod: 2 } } },
    ]);
    assert.deepEqual(result, { die: "d6", perLevelMod: 2 });
  });

  it("forces d6+0 for Partial Warrior + Duelist", () => {
    const result = combineHdGrants([
      { name: "Partial Warrior", system: { hdGrant: { die: "d6", perLevelMod: 2 } } },
      { name: "Duelist", system: { hdGrant: { die: "d6", perLevelMod: 0 } } },
    ]);
    assert.deepEqual(result, { die: "d6", perLevelMod: 0 });
  });

  it("uses Full High Mage d6-1", () => {
    const result = combineHdGrants([
      { name: "Full High Mage", system: { hdGrant: { die: "d6", perLevelMod: -1 } } },
    ]);
    assert.deepEqual(result, { die: "d6", perLevelMod: -1 });
  });
});

describe("prepared / cast progression", () => {
  const fullHm = {
    name: "Full High Mage",
    system: {
      preparedGrant: { progression: [3, 3, 4, 5, 6, 7, 8, 9, 10, 12] },
      slotGrant: { enabled: false, progression: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6] },
    },
  };
  const partialHm = {
    name: "Partial High Mage",
    system: {
      preparedGrant: { progression: [2, 3, 3, 4, 5, 6, 7, 7, 8, 9] },
      slotGrant: { enabled: false, progression: [1, 1, 1, 2, 2, 3, 3, 3, 4, 4] },
    },
  };
  const partialEl = {
    name: "Partial Elementalist",
    system: {
      preparedGrant: { progression: [2, 3, 3, 4, 5, 6, 7, 7, 8, 9] },
      slotGrant: { enabled: false, progression: [1, 1, 1, 2, 2, 3, 3, 3, 4, 4] },
    },
  };

  it("detects dual partial spellcasters", () => {
    assert.equal(hasDualPartialSpellcasters([partialHm, partialEl]), true);
    assert.equal(hasDualPartialSpellcasters([fullHm]), false);
    assert.equal(hasDualPartialSpellcasters([fullHm, partialHm]), false);
  });

  it("uses dual prepared table for two partial casters", () => {
    assert.equal(derivePreparedMax([partialHm, partialEl], 5), DUAL_PARTIAL_PREPARED[4]);
    assert.deepEqual(resolveCastProgression([partialHm, partialEl]), DUAL_PARTIAL_CAST);
  });

  it("uses single tradition prepared for one caster", () => {
    assert.equal(derivePreparedMax([fullHm], 10), 12);
    assert.equal(progressionAtLevel(fullHm.system.slotGrant.progression, 10), 6);
  });
});
