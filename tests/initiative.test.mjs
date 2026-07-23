/**
 * Unit tests for initiative derivation helpers.
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveInitiative, getSideGroupInitiativeMod } from "../module/derivations/initiative.mjs";

describe("deriveInitiative", () => {
  it("folds DEX into PC individual and group values", () => {
    const actor = {
      type: "character",
      system: {
        abilities: { dex: { mod: 2 } },
        combat: {
          initiative: {
            individual: { mod: 1, value: 0, roll: "1d8" },
            group: { mod: 0, value: 0 },
          },
        },
      },
    };
    deriveInitiative(actor);
    assert.equal(actor.system.combat.initiative.individual.value, 3);
    assert.equal(actor.system.combat.initiative.group.value, 2);
    assert.equal(actor.system.combat.initiative.value, 3);
  });

  it("uses NPC initMod without DEX", () => {
    const actor = {
      type: "monster",
      system: {
        abilities: { dex: { mod: 5 } },
        combat: {
          initMod: 1,
          initiative: {
            individual: { mod: 0, value: 0, roll: "1d8" },
            group: { mod: 0, value: 0 },
          },
        },
      },
    };
    deriveInitiative(actor);
    assert.equal(actor.system.combat.initiative.individual.value, 1);
  });
});

describe("getSideGroupInitiativeMod", () => {
  it("takes the highest group mod and does not stack", () => {
    const members = [
      { actor: { system: { combat: { initiative: { group: { mod: 1 } } } } } },
      { actor: { system: { combat: { initiative: { group: { mod: 1 } } } } } },
      { actor: { system: { combat: { initiative: { group: { mod: 0 } } } } } },
    ];
    assert.equal(getSideGroupInitiativeMod(members), 1);
  });
});
