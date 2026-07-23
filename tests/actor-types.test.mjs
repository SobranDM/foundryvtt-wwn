/**
 * Node unit tests for PC/NPC actor type helpers.
 * Run: node --test tests/actor-types.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPc, isNpc, PC_TYPES, NPC_TYPES, CREATABLE_ACTOR_TYPES } from "../module/helpers/actor-types.mjs";

describe("actor-types", () => {
  it("treats character and pc as PC", () => {
    assert.equal(isPc("character"), true);
    assert.equal(isPc("pc"), true);
    assert.equal(isPc({ type: "character" }), true);
    assert.equal(isPc("monster"), false);
  });

  it("treats monster and npc as NPC", () => {
    assert.equal(isNpc("monster"), true);
    assert.equal(isNpc("npc"), true);
    assert.equal(isNpc({ type: "npc" }), true);
    assert.equal(isNpc("character"), false);
  });

  it("exposes creatable types without reverse aliases", () => {
    assert.deepEqual([...CREATABLE_ACTOR_TYPES], ["character", "monster", "faction", "starship", "powerArmor"]);
    assert.ok(PC_TYPES.includes("character"));
    assert.ok(NPC_TYPES.includes("monster"));
  });
});
