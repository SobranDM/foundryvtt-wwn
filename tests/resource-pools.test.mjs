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
  evaluatePoolFormula,
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

describe("Vowed Effort formula", () => {
  const formula = "max(1, @maxNonCombatSkill + max(@str, @dex, @con, @int, @wis, @cha))";

  it("uses max non-combat skill rather than only exert", () => {
    const { value, valid } = evaluatePoolFormula(formula, {
      maxNonCombatSkill: 2,
      exert: 0,
      str: 1,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
    });
    assert.equal(valid, true);
    assert.equal(value, 3);
  });

  it("floors at 1 when skills and mods are low", () => {
    const { value, valid } = evaluatePoolFormula(formula, {
      maxNonCombatSkill: -1,
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
    });
    assert.equal(valid, true);
    assert.equal(value, 1);
  });
});
