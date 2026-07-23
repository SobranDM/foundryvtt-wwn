/**
 * Unit tests for encumbrance-tier movement derivation.
 */
import "../build/foundry-shim.mjs";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { deriveMovement } from "../module/derivations/movement.mjs";

const settings = new Map();

beforeEach(() => {
  settings.clear();
  settings.set("showMovement", true);
  settings.set("movementRate", "movewwn");
  globalThis.game = {
    settings: { get: (_ns, key) => settings.get(key) },
  };
  globalThis.CONFIG.WWN = {
    movementRates: {
      movewwn: [30, 20, 15],
      movebx: [40, 30, 20],
    },
  };
});

afterEach(() => {
  delete globalThis.game;
});

function pc({ readied, stowed, bonus = 0 }) {
  return {
    type: "character",
    system: {
      movement: {
        base: { value: 30 },
        bonus,
        combat: 0,
        exploration: 0,
        daily: 0,
      },
      encumbrance: {
        readied: { value: readied, max: 5 },
        stowed: { value: stowed, max: 10 },
      },
    },
  };
}

describe("deriveMovement", () => {
  it("uses full speed when within both maxes", () => {
    const actor = pc({ readied: 5, stowed: 10 });
    deriveMovement(actor);
    assert.equal(actor.system.movement.combat, 30);
    assert.equal(actor.system.movement.exploration, 90);
    assert.equal(actor.system.movement.daily, 6);
  });

  it("drops to mid tier when readied is +1..+2 over max", () => {
    const actor = pc({ readied: 7, stowed: 10 });
    deriveMovement(actor);
    assert.equal(actor.system.movement.combat, 20);
  });

  it("drops to slow tier at heavier overload", () => {
    const actor = pc({ readied: 7, stowed: 14 });
    deriveMovement(actor);
    assert.equal(actor.system.movement.combat, 15);
  });

  it("zeros movement when overload exceeds all tiers", () => {
    const actor = pc({ readied: 20, stowed: 30 });
    deriveMovement(actor);
    assert.equal(actor.system.movement.combat, 0);
  });

  it("ignores encumbrance for NPCs", () => {
    const actor = {
      type: "monster",
      system: {
        movement: { base: { value: 40 }, bonus: 0, combat: 0, exploration: 0, daily: 0 },
        encumbrance: {
          readied: { value: 99, max: 1 },
          stowed: { value: 99, max: 1 },
        },
      },
    };
    deriveMovement(actor);
    assert.equal(actor.system.movement.combat, 40);
  });
});
