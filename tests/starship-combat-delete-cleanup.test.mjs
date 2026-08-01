/**
 * Node unit tests for starship cleanup when a Combat document is deleted.
 * Run: node --test tests/starship-combat-delete-cleanup.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLEAR_COMBATANT_STATE_ON_COMBAT_DELETE,
  starshipActorsToClearOnCombatDelete,
} from "../module/combat/starship/combat-delete-cleanup.mjs";

describe("starship combat delete cleanup", () => {
  it("never clears combatant flags after Combat delete (parent is already gone)", () => {
    // Updating combatant flags in _onDelete races Foundry's delete pipeline:
    // collection.delete(id) runs before _onDelete, so unsetFlag → parentUuid fetch fails.
    assert.equal(CLEAR_COMBATANT_STATE_ON_COMBAT_DELETE, false);
  });

  it("collects unique starship actors for actor-scoped cleanup before delete", () => {
    const shipA = { type: "starship", id: "a" };
    const shipB = { type: "starship", id: "b" };
    const character = { type: "character", id: "c" };
    const actors = starshipActorsToClearOnCombatDelete([
      { actor: shipA },
      { actor: character },
      { actor: shipA },
      { actor: shipB },
      { actor: null },
      {},
    ]);
    assert.deepEqual(actors, [shipA, shipB]);
  });
});
