/**
 * Group-initiative socket payload validation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeInitiativeUpdates,
  validateGroupInitiativePayload,
  validateGroupInitiativeRollRequest,
} from "../module/combat/group-initiative-socket.mjs";

describe("sanitizeInitiativeUpdates", () => {
  it("keeps only _id + finite initiative", () => {
    assert.deepEqual(
      sanitizeInitiativeUpdates([
        { _id: "a", initiative: 12, name: "hack" },
        { _id: "b", initiative: "nope" },
        { initiative: 3 },
        null,
      ]),
      [{ _id: "a", initiative: 12 }]
    );
  });
});

describe("validateGroupInitiativePayload", () => {
  const base = {
    combatId: "c1",
    activeCombatId: "c1",
    groupIds: ["g1"],
    combatantIds: ["x1", "x2"],
  };

  it("rejects mismatched combat id", () => {
    const r = validateGroupInitiativePayload({
      ...base,
      combatId: "other",
      combatantUpdates: [{ _id: "x1", initiative: 5 }],
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "combatId");
  });

  it("rejects unknown combatant ids", () => {
    const r = validateGroupInitiativePayload({
      ...base,
      combatantUpdates: [{ _id: "nope", initiative: 5 }],
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "unknownCombatant");
  });

  it("accepts sanitized updates for known ids", () => {
    const r = validateGroupInitiativePayload({
      ...base,
      combatantGroupUpdates: [{ _id: "g1", initiative: 10, extra: true }],
      combatantUpdates: [{ _id: "x1", initiative: 10 }],
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.combatantGroupUpdates, [{ _id: "g1", initiative: 10 }]);
    assert.deepEqual(r.combatantUpdates, [{ _id: "x1", initiative: 10 }]);
  });

  it("rejects empty sanitized payload", () => {
    const r = validateGroupInitiativePayload({
      ...base,
      combatantUpdates: [{ _id: "x1", initiative: NaN }],
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "empty");
  });
});

describe("validateGroupInitiativeRollRequest", () => {
  const base = {
    combatId: "c1",
    activeCombatId: "c1",
    combatantIds: ["x1", "x2", "x3"],
  };

  it("rejects mismatched combat id", () => {
    const r = validateGroupInitiativeRollRequest({
      ...base,
      combatId: "other",
      combatantId: "x1",
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "combatId");
  });

  it("rejects unknown combatant", () => {
    const r = validateGroupInitiativeRollRequest({
      ...base,
      combatantId: "nope",
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "unknownCombatant");
  });

  it("requires ownership of every group member", () => {
    const owned = new Set(["x1", "x2"]);
    const r = validateGroupInitiativeRollRequest({
      ...base,
      combatantId: "x1",
      canUpdateCombatant: (id) => owned.has(id),
      getGroupMemberIds: () => ["x1", "x2", "x3"],
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "permission");
  });

  it("accepts when sender owns the full group", () => {
    const r = validateGroupInitiativeRollRequest({
      ...base,
      combatantId: "x1",
      canUpdateCombatant: () => true,
      getGroupMemberIds: () => ["x1", "x2"],
    });
    assert.equal(r.ok, true);
    assert.equal(r.combatantId, "x1");
  });
});
