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

function makeActor({
  type = "character",
  classEdges = [],
  powers = [],
  level = 1,
  poolMaxOverrides = {},
} = {}) {
  const items = [...classEdges, ...powers];
  return {
    type,
    items: {
      filter: (fn) => items.filter(fn),
      some: (fn) => items.some(fn),
      [Symbol.iterator]: () => items[Symbol.iterator](),
    },
    getRollData: () => ({ level }),
    system: { poolMaxOverrides },
  };
}

function sharedArt({
  id = "art1",
  resourceName = "Effort",
  source = "Vowed",
  poolCommittedSum = 0,
} = {}) {
  return {
    id,
    type: "power",
    system: {
      subType: "art",
      resourceName,
      source,
      usesSharedPool: true,
      effectiveCommitmentOptions: [{ cost: 1, length: "scene" }],
      poolCommittedSum,
    },
  };
}

const vowedEdge = {
  id: "vowed",
  type: "classEdge",
  name: "Vowed",
  system: {
    poolGrant: {
      name: "Vowed Effort",
      formula: "",
      progression: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    },
    slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    preparedGrant: { progression: [] },
  },
};

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

describe("NPC pool max overrides and orphan pools", () => {
  it("applies poolMaxOverrides to ClassEdge-granted NPC pools", () => {
    const poolId = "pool-Vowed Effort".slugify();
    const actor = makeActor({
      type: "monster",
      classEdges: [vowedEdge],
      powers: [sharedArt()],
      poolMaxOverrides: { [poolId]: 7 },
    });
    deriveResourcePools(actor);
    const vowed = actor.system.resourcePools.find((p) => p.name === "Vowed Effort");
    assert.ok(vowed);
    assert.equal(vowed.max, 7);
    assert.equal(vowed.editableMax, true);
  });

  it("creates orphan NPC pools for shared-pool powers without a grant", () => {
    const poolId = "pool-Vowed Effort".slugify();
    const actor = makeActor({
      type: "monster",
      powers: [sharedArt({ poolCommittedSum: 1 })],
      poolMaxOverrides: { [poolId]: 3 },
    });
    deriveResourcePools(actor);
    const vowed = actor.system.resourcePools.find((p) => p.name === "Vowed Effort");
    assert.ok(vowed, `unexpected pools: ${JSON.stringify(actor.system.resourcePools)}`);
    assert.equal(vowed.value, 1);
    assert.equal(vowed.max, 3);
    assert.equal(vowed.editableMax, true);
  });

  it("does not create orphan pools or editableMax on PCs", () => {
    const actor = makeActor({
      type: "character",
      powers: [sharedArt()],
    });
    deriveResourcePools(actor);
    const pools = actor.system.resourcePools ?? [];
    assert.equal(pools.length, 0);
    assert.equal(pools.some((p) => p.editableMax), false);
  });
});
