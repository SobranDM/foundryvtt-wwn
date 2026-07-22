/**
 * Unit tests for class field → classEdge pre-check heuristics.
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  precheckClassEdgesFromClassField,
  tokenizeClassField,
} from "../module/helpers/class-assignment-guess.mjs";
import {
  isRetiredClassAbilityName,
  isLikelyPlayablePc,
  shouldFlagPackPcClassAssignment,
} from "../module/migration/class-ability-cleanup.mjs";

describe("tokenizeClassField", () => {
  it("splits on slash and and", () => {
    assert.deepEqual(tokenizeClassField("Warrior/Expert"), ["Warrior", "Expert"]);
    assert.deepEqual(tokenizeClassField("Healer and Vowed"), ["Healer", "Vowed"]);
  });

  it("splits juxtaposed class names without separators", () => {
    assert.deepEqual(tokenizeClassField("Warrior Vowed"), ["Warrior", "Vowed"]);
  });
});

describe("precheckClassEdgesFromClassField", () => {
  it("maps single Warrior to Full Warrior", () => {
    assert.deepEqual(precheckClassEdgesFromClassField("Warrior"), ["Full Warrior"]);
  });

  it("maps Warrior/Expert to Partials", () => {
    assert.deepEqual(precheckClassEdgesFromClassField("Warrior/Expert").sort(), [
      "Partial Expert",
      "Partial Warrior",
    ]);
  });

  it("maps Warrior Vowed to Partial Warrior and Vowed", () => {
    assert.deepEqual(precheckClassEdgesFromClassField("Warrior Vowed").sort(), [
      "Partial Warrior",
      "Vowed",
    ]);
  });

  it("maps High Mage to Full High Mage", () => {
    assert.deepEqual(precheckClassEdgesFromClassField("High Mage"), ["Full High Mage"]);
  });

  it("maps Partial High Mage explicitly", () => {
    assert.deepEqual(precheckClassEdgesFromClassField("Partial High Mage"), ["Partial High Mage"]);
  });

  it("maps Healer", () => {
    assert.deepEqual(precheckClassEdgesFromClassField("Healer"), ["Healer"]);
  });
});

describe("isRetiredClassAbilityName", () => {
  it("matches retired foci", () => {
    assert.equal(isRetiredClassAbilityName("Class Ability: Killing Blow"), true);
    assert.equal(isRetiredClassAbilityName("Alert"), false);
  });
});

describe("isLikelyPlayablePc", () => {
  it("rejects empty / gear-only placeholders", () => {
    assert.equal(isLikelyPlayablePc({ items: [] }), false);
    assert.equal(isLikelyPlayablePc({ items: [{ type: "weapon" }, { type: "armor" }] }), false);
  });

  it("accepts actors with skills, foci, or powers", () => {
    assert.equal(isLikelyPlayablePc({ items: [{ type: "skill" }] }), true);
    assert.equal(isLikelyPlayablePc({ items: [{ type: "focus" }] }), true);
    assert.equal(isLikelyPlayablePc({ items: [{ type: "power" }] }), true);
  });
});

describe("shouldFlagPackPcClassAssignment", () => {
  it("never flags when a classEdge is already owned", () => {
    assert.equal(
      shouldFlagPackPcClassAssignment({ items: [{ type: "classEdge" }, { type: "skill" }] }, 2),
      false
    );
  });

  it("flags after archiving Class Abilities even without remaining skills", () => {
    assert.equal(shouldFlagPackPcClassAssignment({ items: [{ type: "weapon" }] }, 1), true);
  });

  it("flags playable pack PCs and skips bare placeholders", () => {
    assert.equal(shouldFlagPackPcClassAssignment({ items: [{ type: "skill" }] }, 0), true);
    assert.equal(shouldFlagPackPcClassAssignment({ items: [] }, 0), false);
  });
});
