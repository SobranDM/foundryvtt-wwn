/**
 * Unit tests for party-carried encumbrance/roster helpers (no Foundry
 * runtime beyond shim).
 * Run: node --test tests/party-treasury.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  partyCarriedRawWeight,
  partiesCarryingFor,
  buildCarrierClearUpdate,
  getPartyActors,
} from "../module/helpers/party-treasury.mjs";

function partyActor(uuid, items, carrierAssignments = {}) {
  return { uuid, items, system: { carrierAssignments } };
}

describe("partyCarriedRawWeight", () => {
  it("sums physical item weight assigned to the given PC, ignoring other carriers", () => {
    const party = partyActor(
      "Actor.party1",
      [
        { id: "i1", type: "item", system: { weight: 2, quantity: 1 } },
        { id: "i2", type: "item", system: { weight: 5, quantity: 1 } },
        { id: "i3", type: "weapon", system: { weight: 3 } },
      ],
      { i1: "Actor.pc1", i2: "Actor.pc2", i3: "Actor.pc1" }
    );
    assert.equal(partyCarriedRawWeight("Actor.pc1", [party]), 5);
  });

  it("ignores unassigned items (no entry, or an explicit null entry)", () => {
    const party = partyActor(
      "Actor.party1",
      [
        { id: "i1", type: "item", system: { weight: 10, quantity: 1 } },
        { id: "i2", type: "item", system: { weight: 10, quantity: 1 } },
      ],
      { i1: null }
    );
    assert.equal(partyCarriedRawWeight("Actor.pc1", [party]), 0);
  });

  it("honors weightless: whenStowed (party-carried items are always 'stowed')", () => {
    const party = partyActor(
      "Actor.party1",
      [{ id: "i1", type: "item", system: { weight: 10, quantity: 1, weightless: "whenStowed" } }],
      { i1: "Actor.pc1" }
    );
    assert.equal(partyCarriedRawWeight("Actor.pc1", [party]), 0);
  });

  it("never rounds -- sums many small fractional items raw instead of rounding each one up", () => {
    // Three 0.4-weight items: per-item rounding would give ceil(0.4)*3 = 3;
    // this must return the raw sum (1.2) and let the caller round once.
    const party = partyActor(
      "Actor.party1",
      [
        { id: "i1", type: "item", system: { weight: 0.4, quantity: 1 } },
        { id: "i2", type: "item", system: { weight: 0.4, quantity: 1 } },
        { id: "i3", type: "item", system: { weight: 0.4, quantity: 1 } },
      ],
      { i1: "Actor.pc1", i2: "Actor.pc1", i3: "Actor.pc1" }
    );
    assert.ok(Math.abs(partyCarriedRawWeight("Actor.pc1", [party]) - 1.2) < 1e-9);
  });

  it("combines physical items and currency slots into one raw number", () => {
    const party = partyActor(
      "Actor.party1",
      [
        { id: "i1", type: "item", system: { weight: 2, quantity: 1 } },
        { id: "c1", type: "currency", system: { carried: 150, perSlot: 100 } },
      ],
      { i1: "Actor.pc1", c1: "Actor.pc1" }
    );
    assert.equal(partyCarriedRawWeight("Actor.pc1", [party]), 3.5);
  });

  it("sums across multiple party actors", () => {
    const partyA = partyActor("Actor.partyA", [{ id: "i1", type: "item", system: { weight: 2, quantity: 1 } }], {
      i1: "Actor.pc1",
    });
    const partyB = partyActor("Actor.partyB", [{ id: "i1", type: "item", system: { weight: 3, quantity: 1 } }], {
      i1: "Actor.pc1",
    });
    assert.equal(partyCarriedRawWeight("Actor.pc1", [partyA, partyB]), 5);
  });

  it("treats missing/empty party list, or a party with no assignments map, as zero", () => {
    assert.equal(partyCarriedRawWeight("Actor.pc1", []), 0);
    assert.equal(partyCarriedRawWeight("Actor.pc1", undefined), 0);
    const bare = { uuid: "Actor.party1", items: [{ id: "i1", type: "item", system: { weight: 5, quantity: 1 } }] };
    assert.equal(partyCarriedRawWeight("Actor.pc1", [bare]), 0);
  });
});

describe("partiesCarryingFor", () => {
  it("returns only parties whose assignment map points at the given PC", () => {
    const carries = partyActor("Actor.carries", [{ id: "i1", type: "item", system: {} }], { i1: "Actor.pc1" });
    const doesNot = partyActor("Actor.doesNot", [{ id: "i1", type: "item", system: {} }], { i1: "Actor.pc2" });
    assert.deepEqual(partiesCarryingFor("Actor.pc1", [carries, doesNot]), [carries]);
  });

  it("returns an empty list when nothing matches", () => {
    const party = partyActor("Actor.party1", [{ id: "i1", type: "item", system: {} }], { i1: null });
    assert.deepEqual(partiesCarryingFor("Actor.pc1", [party]), []);
  });

  it("returns every party a PC carries for when it carries for more than one", () => {
    const partyA = partyActor("Actor.partyA", [{ id: "i1", type: "item", system: {} }], { i1: "Actor.pc1" });
    const partyB = partyActor("Actor.partyB", [{ id: "i1", type: "currency", system: {} }], { i1: "Actor.pc1" });
    assert.deepEqual(partiesCarryingFor("Actor.pc1", [partyA, partyB]), [partyA, partyB]);
  });

  it("ignores a stale assignment entry pointing at a since-removed item", () => {
    // i2's assignment lingers in carrierAssignments but the item itself is
    // gone from `items` -- partyCarriedRawWeight already ignores this case
    // (it iterates items, not assignments); this must agree, not report the
    // party as carrying anything for pc1.
    const party = partyActor("Actor.party1", [{ id: "i1", type: "item", system: {} }], {
      i1: "Actor.pc2",
      i2: "Actor.pc1",
    });
    assert.deepEqual(partiesCarryingFor("Actor.pc1", [party]), []);
  });
});

describe("buildCarrierClearUpdate", () => {
  it("builds a dotted-path update payload clearing only the removed member's assignments", () => {
    const assignments = { i1: "Actor.pc1", i2: "Actor.pc2", i3: "Actor.pc1" };
    assert.deepEqual(buildCarrierClearUpdate(assignments, "Actor.pc1"), {
      "system.carrierAssignments.i1": null,
      "system.carrierAssignments.i3": null,
    });
  });

  it("returns an empty object when nothing matches or no uuid is given", () => {
    const assignments = { i1: "Actor.pc2" };
    assert.deepEqual(buildCarrierClearUpdate(assignments, "Actor.pc1"), {});
    assert.deepEqual(buildCarrierClearUpdate(assignments, null), {});
    assert.deepEqual(buildCarrierClearUpdate(undefined, "Actor.pc1"), {});
  });
});

describe("getPartyActors", () => {
  const originalGame = globalThis.game;
  afterEach(() => {
    globalThis.game = originalGame;
  });

  it("returns every party-type actor from game.actors, always read fresh", () => {
    const party = { type: "party", uuid: "Actor.party1" };
    const pc = { type: "character", uuid: "Actor.pc1" };
    globalThis.game = { actors: [party, pc] };
    assert.deepEqual(getPartyActors(), [party]);

    // A later call must reflect a since-changed world, not a stale snapshot
    // from the first call (e.g. that party deleted, a different one created).
    const secondParty = { type: "party", uuid: "Actor.party2" };
    globalThis.game = { actors: [pc, secondParty] };
    assert.deepEqual(getPartyActors(), [secondParty]);
  });

  it("returns an empty array when there are no actors", () => {
    globalThis.game = { actors: [] };
    assert.deepEqual(getPartyActors(), []);
  });
});
