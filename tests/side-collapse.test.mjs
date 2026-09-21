import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderedGroupIdsFromTurns,
  firstTurnIndexForGroup,
  isGroupFullyDefeated,
  findAdjacentGroupTurn
} from "../module/combat/side-collapse.mjs";

describe("side-collapse helpers", () => {
  const turns = [
    { id: "a1", groupId: "red", isDefeated: false },
    { id: "a2", groupId: "red", isDefeated: false },
    { id: "b1", groupId: "green", isDefeated: false },
    { id: "c1", groupId: "red*", isDefeated: false }
  ];

  it("orders unique group ids from turn order", () => {
    assert.deepEqual(orderedGroupIdsFromTurns(turns), ["red", "green", "red*"]);
  });

  it("finds first turn index for a group", () => {
    assert.equal(firstTurnIndexForGroup(turns, "green"), 2);
    assert.equal(firstTurnIndexForGroup(turns, "missing"), -1);
  });

  it("advances nextTurn to the next side, not the next combatant", () => {
    const result = findAdjacentGroupTurn({
      turns,
      currentTurnIndex: 0,
      direction: 1
    });
    assert.deepEqual(result, { kind: "turn", turnIndex: 2 });
  });

  it("goes to next round from the last side", () => {
    const result = findAdjacentGroupTurn({
      turns,
      currentTurnIndex: 3,
      direction: 1
    });
    assert.deepEqual(result, { kind: "round" });
  });

  it("goes to previous round from the first side", () => {
    const result = findAdjacentGroupTurn({
      turns,
      currentTurnIndex: 0,
      direction: -1
    });
    assert.deepEqual(result, { kind: "round" });
  });

  it("wraps around to an untouched sibling instead of ending the round, when acted groups are tracked", () => {
    // Regression: a GM manually activates the positionally-last group (e.g.
    // to break a tie) before any of its earlier siblings ever went. A pure
    // positional walk forward from "red*" (the last group) finds nothing and
    // would wrongly end the round -- skipping the untouched siblings' turns
    // entirely. With acted-tracking, it must wrap and find the first
    // untouched group by position ("red").
    const result = findAdjacentGroupTurn({
      turns,
      currentTurnIndex: 3, // "red*", the last group positionally
      direction: 1,
      actedGroupIds: new Set() // nothing has acted yet this round
    });
    assert.deepEqual(result, { kind: "turn", turnIndex: 0 }); // "red"
  });

  it("wraps to a specific still-untouched sibling, skipping ones already acted", () => {
    // Same manual-activation scenario, but "red" already had its turn this
    // round (e.g. the GM went red -> [manually jumped to] red*, skipping
    // green) -- the wrap must land on "green", not re-offer "red".
    const result = findAdjacentGroupTurn({
      turns,
      currentTurnIndex: 3, // "red*"
      direction: 1,
      actedGroupIds: new Set(["red"])
    });
    assert.deepEqual(result, { kind: "turn", turnIndex: 2 }); // "green"
  });

  it("still ends the round once every group has actually acted", () => {
    const result = findAdjacentGroupTurn({
      turns,
      currentTurnIndex: 3,
      direction: 1,
      actedGroupIds: new Set(["red", "green", "red*"])
    });
    assert.deepEqual(result, { kind: "round" });
  });

  it("omitting actedGroupIds keeps the plain positional behavior (no regression for normal sequential play)", () => {
    const result = findAdjacentGroupTurn({
      turns,
      currentTurnIndex: 3,
      direction: 1
    });
    assert.deepEqual(result, { kind: "round" });
  });

  it("skips a fully defeated side when skipDefeated is on", () => {
    const withDead = [
      { id: "a1", groupId: "red", isDefeated: false },
      { id: "b1", groupId: "green", isDefeated: true },
      { id: "b2", groupId: "green", isDefeated: true },
      { id: "c1", groupId: "blue", isDefeated: false }
    ];
    assert.equal(isGroupFullyDefeated(withDead, "green"), true);
    const result = findAdjacentGroupTurn({
      turns: withDead,
      currentTurnIndex: 0,
      direction: 1,
      skipDefeated: true
    });
    assert.deepEqual(result, { kind: "turn", turnIndex: 3 });
  });
});
