/**
 * Unit tests for spell-slot pool derivation gates.
 * Run: node --test tests/resource-pools.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getActorSpellSlotMode,
  deriveResourcePools,
} from "../module/derivations/resource-pools.mjs";

function makeActor({ classEdges = [], powers = [], level = 1 } = {}) {
  const items = [...classEdges, ...powers];
  return {
    items: {
      filter: (fn) => items.filter(fn),
      some: (fn) => items.some(fn),
      [Symbol.iterator]: () => items[Symbol.iterator](),
    },
    getRollData: () => ({ level }),
    system: {},
  };
}

describe("getActorSpellSlotMode", () => {
  it("returns null when slotGrant.enabled with empty leveledProgression", () => {
    const actor = makeActor({
      classEdges: [
        {
          id: "edge1",
          type: "classEdge",
          system: {
            slotGrant: { enabled: true, progression: [], leveledProgression: [] },
            poolGrant: {},
          },
        },
      ],
    });
    assert.equal(getActorSpellSlotMode(actor), null);
  });

  it("returns leveled when enabled with a non-empty matrix", () => {
    const actor = makeActor({
      classEdges: [
        {
          id: "edge1",
          type: "classEdge",
          system: {
            slotGrant: {
              enabled: true,
              progression: [],
              leveledProgression: [[1, 0], [2, 1]],
            },
            poolGrant: {},
          },
        },
      ],
    });
    assert.equal(getActorSpellSlotMode(actor), "leveled");
  });
});

describe("deriveResourcePools Spell Slots gate", () => {
  it("does not create Spell Slots for enabled+empty leveledProgression", () => {
    const actor = makeActor({
      classEdges: [
        {
          id: "edge1",
          type: "classEdge",
          name: "Migrated Warrior",
          system: {
            slotGrant: { enabled: true, progression: [], leveledProgression: [] },
            poolGrant: {},
            preparedGrant: { progression: [] },
          },
        },
      ],
    });
    deriveResourcePools(actor);
    const pools = actor.system.resourcePools ?? [];
    assert.equal(
      pools.some((p) => p.name === "Spell Slots"),
      false,
      `unexpected pools: ${JSON.stringify(pools)}`
    );
  });
});
