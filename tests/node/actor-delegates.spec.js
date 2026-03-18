/**
 * Tests for actor type-delegate modules (Phase 2 chunking).
 */
import { describe, it } from "mocha";
import { assert } from "chai";
import * as character from "../../module/actor/types/character.mjs";
import * as creature from "../../module/actor/types/creature.mjs";
import * as faction from "../../module/actor/types/faction.mjs";
import * as monster from "../../module/actor/types/monster.mjs";
import * as ship from "../../module/actor/types/ship.mjs";
import * as vehicle from "../../module/actor/types/vehicle.mjs";

describe("WWN: Actor type delegates", () => {
  it("character exports prepare and compute helpers", () => {
    assert.isFunction(character.prepare);
    assert.isFunction(character.computeAC);
    assert.isFunction(character.computeEncumbrance);
    assert.isFunction(character.setXP);
  });
  it("creature exports computeModifiers, computeSaves, computeInit, prepare", () => {
    assert.isFunction(creature.computeModifiers);
    assert.isFunction(creature.computeSaves);
    assert.isFunction(creature.computeInit);
    assert.isFunction(creature.prepare);
  });
  it("faction exports prepare and getHealth", () => {
    assert.isFunction(faction.prepare);
    assert.isFunction(faction.getHealth);
    assert.strictEqual(faction.getHealth(1), 1);
    assert.strictEqual(faction.getHealth(8), 20);
  });
  it("monster exports prepare", () => {
    assert.isFunction(monster.prepare);
  });
  it("ship exports prepare and ship compute helpers", () => {
    assert.isFunction(ship.prepare);
    assert.isFunction(ship.computeEncumbranceShip);
    assert.isFunction(ship.computeCrewStrength);
  });
  it("vehicle exports prepare and computeEncumbranceVehicle", () => {
    assert.isFunction(vehicle.prepare);
    assert.isFunction(vehicle.computeEncumbranceVehicle);
  });
});
