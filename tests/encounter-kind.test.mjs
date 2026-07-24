/**
 * Node unit tests for combat encounter kind / type segregation.
 * Run: node --test tests/encounter-kind.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyActorType,
  encounterKindFromCombatants,
  canAddActorTypeToKind,
  canAddActorTypeToCombat,
} from "../module/combat/encounter-kind.mjs";

describe("classifyActorType", () => {
  it("maps starship and faction", () => {
    assert.equal(classifyActorType("starship"), "starship");
    assert.equal(classifyActorType("faction"), "faction");
  });

  it("maps personal types including powerArmor and aliases", () => {
    assert.equal(classifyActorType("character"), "personal");
    assert.equal(classifyActorType("pc"), "personal");
    assert.equal(classifyActorType("monster"), "personal");
    assert.equal(classifyActorType("npc"), "personal");
    assert.equal(classifyActorType("powerArmor"), "personal");
  });
});

describe("encounterKindFromCombatants", () => {
  it("returns empty for no combatants", () => {
    assert.equal(encounterKindFromCombatants([]), "empty");
    assert.equal(encounterKindFromCombatants(null), "empty");
  });

  it("detects starship / faction / personal", () => {
    assert.equal(
      encounterKindFromCombatants([{ actor: { type: "starship" } }]),
      "starship",
    );
    assert.equal(
      encounterKindFromCombatants([{ actor: { type: "faction" } }]),
      "faction",
    );
    assert.equal(
      encounterKindFromCombatants([{ actor: { type: "character" } }]),
      "personal",
    );
  });
});

describe("canAddActorTypeToKind", () => {
  it("allows anything into empty combat", () => {
    assert.equal(canAddActorTypeToKind("empty", "starship").ok, true);
    assert.equal(canAddActorTypeToKind("empty", "faction").ok, true);
    assert.equal(canAddActorTypeToKind("empty", "character").ok, true);
  });

  it("blocks starship into non-starship", () => {
    assert.equal(canAddActorTypeToKind("personal", "starship").ok, false);
    assert.equal(canAddActorTypeToKind("faction", "starship").ok, false);
    assert.equal(canAddActorTypeToKind("starship", "starship").ok, true);
  });

  it("blocks faction into non-faction", () => {
    assert.equal(canAddActorTypeToKind("personal", "faction").ok, false);
    assert.equal(canAddActorTypeToKind("starship", "faction").ok, false);
    assert.equal(canAddActorTypeToKind("faction", "faction").ok, true);
  });

  it("blocks personal into starship or faction", () => {
    assert.equal(canAddActorTypeToKind("starship", "character").ok, false);
    assert.equal(canAddActorTypeToKind("starship", "monster").ok, false);
    assert.equal(canAddActorTypeToKind("starship", "powerArmor").ok, false);
    assert.equal(canAddActorTypeToKind("faction", "character").ok, false);
    assert.equal(canAddActorTypeToKind("personal", "character").ok, true);
  });
});

describe("canAddActorTypeToCombat", () => {
  it("checks only the given combat's combatants", () => {
    const combat = {
      combatants: [{ actor: { type: "starship" } }],
    };
    assert.equal(canAddActorTypeToCombat(combat, "monster").ok, false);
    assert.equal(canAddActorTypeToCombat(combat, "starship").ok, true);
  });
});
