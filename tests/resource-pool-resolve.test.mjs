/**
 * Unit tests for Effort pool name resolution (generic "Effort" → "Vowed Effort").
 * Run: node --test tests/resource-pool-resolve.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findPoolGrantEdge,
  findNamedResourcePool,
} from "../module/helpers/resource-pool-resolve.mjs";
import { deriveResourcePools } from "../module/derivations/resource-pools.mjs";

function makeActor({ classEdges = [], powers = [], level = 1, pools = null } = {}) {
  const items = [...classEdges, ...powers];
  const actor = {
    items: {
      filter: (fn) => items.filter(fn),
      some: (fn) => items.some(fn),
      [Symbol.iterator]: () => items[Symbol.iterator](),
    },
    getRollData: () => ({
      level,
      exert: 1,
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      magic: 1,
    }),
    system: {},
  };
  if (pools) actor.system.resourcePools = pools;
  return actor;
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

const highMageEdge = {
  id: "hm",
  type: "classEdge",
  name: "Full High Mage",
  system: {
    poolGrant: {
      name: "High Mage Effort",
      formula: "",
      progression: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    },
    slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    preparedGrant: { progression: [] },
  },
};

describe("findPoolGrantEdge", () => {
  it("maps generic Effort + source Vowed onto Vowed Effort grant", () => {
    const actor = makeActor({ classEdges: [vowedEdge] });
    const edge = findPoolGrantEdge(actor, { resourceName: "Effort", source: "Vowed" });
    assert.equal(edge?.id, "vowed");
  });

  it("keeps exact pool names", () => {
    const actor = makeActor({ classEdges: [vowedEdge] });
    const edge = findPoolGrantEdge(actor, {
      resourceName: "Vowed Effort",
      source: "",
    });
    assert.equal(edge?.id, "vowed");
  });

  it("uses unique Effort grant when source is missing", () => {
    const actor = makeActor({ classEdges: [vowedEdge] });
    const edge = findPoolGrantEdge(actor, { resourceName: "Effort", source: "" });
    assert.equal(edge?.id, "vowed");
  });

  it("returns null when Effort is ambiguous across two grants", () => {
    const actor = makeActor({ classEdges: [vowedEdge, highMageEdge] });
    const edge = findPoolGrantEdge(actor, { resourceName: "Effort", source: "" });
    assert.equal(edge, null);
  });

  it("disambiguates dual Effort grants via source", () => {
    const actor = makeActor({ classEdges: [vowedEdge, highMageEdge] });
    assert.equal(
      findPoolGrantEdge(actor, { resourceName: "Effort", source: "Vowed" })?.id,
      "vowed"
    );
    assert.equal(
      findPoolGrantEdge(actor, { resourceName: "Effort", source: "High Mage" })?.id,
      "hm"
    );
  });
});

describe("deriveResourcePools Effort resolution", () => {
  it("does not create a phantom Effort 0/0 beside Vowed Effort", () => {
    const art = {
      id: "art1",
      type: "power",
      system: {
        subType: "art",
        resourceName: "Effort",
        source: "Vowed",
        usesSharedPool: true,
        effectiveCommitmentOptions: [{ cost: 1, length: "scene" }],
        poolCommittedSum: 0,
      },
    };
    const actor = makeActor({ classEdges: [vowedEdge], powers: [art] });
    deriveResourcePools(actor);
    const pools = actor.system.resourcePools ?? [];
    assert.equal(pools.some((p) => p.name === "Effort"), false);
    const vowed = pools.find((p) => p.name === "Vowed Effort");
    assert.ok(vowed);
    assert.equal(vowed.max, 4);
    assert.equal(vowed.value, 0);
  });
});

describe("findNamedResourcePool", () => {
  it("finds Vowed Effort when power asks for Effort", () => {
    const actor = makeActor({
      classEdges: [vowedEdge],
      pools: [{ name: "Vowed Effort", level: null, value: 0, max: 4 }],
    });
    const pool = findNamedResourcePool(actor, {
      resourceName: "Effort",
      source: "Vowed",
    });
    assert.equal(pool?.name, "Vowed Effort");
    assert.equal(pool?.max, 4);
  });
});
