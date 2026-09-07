/**
 * Pure starship weapon hit/damage outcome (no Foundry runtime).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeShipWeaponOutcome } from "../module/combat/starship/weapon-outcome.mjs";

describe("computeShipWeaponOutcome", () => {
  function ship({ ac = 10, armor = 5, hullClass = "frigate" } = {}) {
    return {
      type: "starship",
      system: { ac, armor, hullClass },
      items: [],
    };
  }

  function combatant(actor, id = "c1") {
    return {
      id,
      actor,
      getFlag: () => null,
    };
  }

  function weapon({ qualities = "", ammo = null } = {}) {
    return {
      name: "Laser",
      system: { qualities, ammo },
    };
  }

  it("misses when attack is below AC", () => {
    const target = ship({ ac: 15 });
    const r = computeShipWeaponOutcome({
      attacker: combatant(ship(), "atk"),
      defender: combatant(target, "def"),
      weapon: weapon(),
      attackTotal: 10,
      damageTotal: 8,
    });
    assert.equal(r.hit, false);
    assert.equal(r.finalDamage, 0);
  });

  it("hits and applies armor to damage", () => {
    const target = ship({ ac: 10, armor: 5 });
    const r = computeShipWeaponOutcome({
      attacker: combatant(ship(), "atk"),
      defender: combatant(target, "def"),
      weapon: weapon(),
      attackTotal: 12,
      damageTotal: 10,
    });
    assert.equal(r.hit, true);
    assert.equal(r.finalDamage, 5);
  });

  it("notes when a hit fails to penetrate armor", () => {
    const target = ship({ ac: 10, armor: 10 });
    const r = computeShipWeaponOutcome({
      attacker: combatant(ship(), "atk"),
      defender: combatant(target, "def"),
      weapon: weapon(),
      attackTotal: 12,
      damageTotal: 6,
    });
    assert.equal(r.hit, true);
    assert.equal(r.finalDamage, 0);
    assert.ok(r.notices.includes("WWN.Starship.DamageInsufficientArmor"));
  });

  it("does not note insufficient penetration when damage gets through", () => {
    const target = ship({ ac: 10, armor: 5 });
    const r = computeShipWeaponOutcome({
      attacker: combatant(ship(), "atk"),
      defender: combatant(target, "def"),
      weapon: weapon(),
      attackTotal: 12,
      damageTotal: 10,
    });
    assert.ok(!r.notices.includes("WWN.Starship.DamageInsufficientArmor"));
  });

  it("AP reduces effective armor before computing final damage", () => {
    const target = ship({ ac: 10, armor: 10 });
    const r = computeShipWeaponOutcome({
      attacker: combatant(ship(), "atk"),
      defender: combatant(target, "def"),
      weapon: weapon({ qualities: "AP 10" }),
      attackTotal: 12,
      damageTotal: 17,
    });
    assert.equal(r.hit, true);
    assert.equal(r.finalDamage, 17);
  });
});
