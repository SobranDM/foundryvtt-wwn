/**
 * Unit tests for hit-dice display and roll formula assembly.
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveHitDice, hitDiceRollFormula } from "../module/derivations/hit-dice.mjs";

describe("deriveHitDice", () => {
  it("builds display from die, CON, and static mod", () => {
    const actor = {
      type: "character",
      items: [],
      system: {
        details: { level: 3 },
        abilities: { con: { mod: 1 } },
        hitDice: { die: "d6", perLevelMod: 0, staticMod: 2 },
      },
    };
    deriveHitDice(actor);
    assert.equal(actor.system.hitDice.perLevelTotal, 1);
    assert.equal(actor.system.hitDice.display, "3d6+5");
  });

  it("overlays classEdge HD grants", () => {
    const actor = {
      type: "character",
      items: [{ type: "classEdge", name: "Partial Warrior", system: { hdGrant: { die: "d6", perLevelMod: 2 } } }],
      system: {
        details: { level: 2 },
        abilities: { con: { mod: 0 } },
        hitDice: { die: "d4", perLevelMod: 0, staticMod: 0 },
      },
    };
    deriveHitDice(actor);
    assert.equal(actor.system.hitDice.fromEdges, true);
    assert.equal(actor.system.hitDice.die, "d6");
    assert.equal(actor.system.hitDice.perLevelMod, 2);
    assert.equal(actor.system.hitDice.display, "2d6+4");
  });
});

describe("hitDiceRollFormula", () => {
  it("repeats clamped per-level terms and appends static mod", () => {
    const actor = {
      system: {
        details: { level: 2 },
        hitDice: { die: "d6", perLevelTotal: 1, staticMod: 2 },
      },
    };
    assert.equal(hitDiceRollFormula(actor), "max(1d6+1, 1) + max(1d6+1, 1) + 2");
  });

  it("handles negative per-level and static mods", () => {
    const actor = {
      system: {
        details: { level: 1 },
        hitDice: { die: "d6", perLevelTotal: -1, staticMod: -2 },
      },
    };
    assert.equal(hitDiceRollFormula(actor), "max(1d6-1, 1) - 2");
  });
});
