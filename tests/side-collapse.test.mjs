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
