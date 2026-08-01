import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractChatRollTotal,
  stationCheckSucceeded,
  opposedCheckSucceeded,
  pickFlakShot,
  cloudDefenderIds,
  STARSHIP_ACTION_DC,
} from "../module/combat/starship/roll-resolve.mjs";
import { endTurnState, startTurnState } from "../module/combat/starship/cp.mjs";

describe("extractChatRollTotal", () => {
  it("reads rolls from a message-like object", () => {
    assert.equal(extractChatRollTotal({ rolls: [{ total: 11 }, { total: 7 }] }), 11);
    assert.equal(extractChatRollTotal({ rolls: [{ total: 11 }, { total: 7 }] }, 1), 7);
  });

  it("reads a bare rolls array", () => {
    assert.equal(extractChatRollTotal([{ total: 9 }]), 9);
  });

  it("returns null when missing", () => {
    assert.equal(extractChatRollTotal(null), null);
    assert.equal(extractChatRollTotal({}), null);
    assert.equal(extractChatRollTotal({ rolls: [{}] }), null);
  });
});

describe("stationCheckSucceeded", () => {
  it("meets or beats DC", () => {
    assert.equal(stationCheckSucceeded(9, STARSHIP_ACTION_DC.aboveAndBeyond), true);
    assert.equal(stationCheckSucceeded(8, STARSHIP_ACTION_DC.aboveAndBeyond), false);
    assert.equal(stationCheckSucceeded(null, 8), false);
  });
});

describe("opposedCheckSucceeded", () => {
  it("attacker wins on tie", () => {
    assert.equal(opposedCheckSucceeded(10, 10), true);
    assert.equal(opposedCheckSucceeded(9, 10), false);
  });
});

describe("pickFlakShot", () => {
  it("keeps the higher attack and its paired damage", () => {
    const r = pickFlakShot({ attack: 8, damage: 4 }, { attack: 12, damage: 2 });
    assert.deepEqual(r, { attack: 12, damage: 2, usedSecond: true });
    const r2 = pickFlakShot({ attack: 14, damage: 6 }, { attack: 10, damage: 9 });
    assert.deepEqual(r2, { attack: 14, damage: 6, usedSecond: false });
  });
});

describe("cloudDefenderIds", () => {
  it("filters to fighter combatants that attacked last round", () => {
    const ids = cloudDefenderIds(["a", "b", "c"], [
      { id: "a", actor: { system: { hullClass: "fighter" } } },
      { id: "b", actor: { system: { hullClass: "frigate" } } },
      { id: "c", actor: { system: { hullClass: "fighter" } } },
      { id: "d", actor: { system: { hullClass: "fighter" } } },
    ]);
    assert.deepEqual(ids, ["a", "c"]);
  });
});

describe("cloud attacker rotation", () => {
  it("endTurnState moves this-round attackers to last-round", () => {
    const next = endTurnState({
      cp: 3,
      flags: {
        attackedByThisRound: ["foe1", "foe2"],
        attackedByLastRound: ["old"],
      },
    }, { roundNumber: 2 });
    assert.deepEqual(next.flags.attackedByLastRound, ["foe1", "foe2"]);
    assert.deepEqual(next.flags.attackedByThisRound, []);
  });

  it("startTurnState preserves last-round list for Cloud fire", () => {
    const afterEnd = endTurnState({
      flags: { attackedByThisRound: ["f1"], attackedByLastRound: [] },
    }, { roundNumber: 1 });
    const afterStart = startTurnState(afterEnd, { pcCrew: true, npcCp: 4 });
    assert.deepEqual(afterStart.flags.attackedByLastRound, ["f1"]);
  });
});
