/**
 * Unit tests for weapon TL / Ironhide gating.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveWeaponTl,
  targetBlocksWeapon,
  resolveWeaponTlGate,
  traumaDieFormula,
  isUnarmedWeapon,
  PRIMITIVE_IMMUNE_TL,
} from "../module/helpers/weapon-tl.mjs";

describe("effectiveWeaponTl", () => {
  it("defaults missing tl to 0", () => {
    assert.equal(effectiveWeaponTl({}, { system: {} }, "melee"), 0);
  });

  it("bumps melee/thrown to TL4 with meleeCountsAsTl4 (Armsman)", () => {
    const attacker = { system: { combat: { meleeCountsAsTl4: true } } };
    const weapon = { system: { tl: 2 }, name: "Spear" };
    assert.equal(effectiveWeaponTl(attacker, weapon, "melee"), 4);
    assert.equal(effectiveWeaponTl(attacker, weapon, "ranged"), 2);
  });

  it("does not bump Punch / unarmed", () => {
    const attacker = { system: { combat: { meleeCountsAsTl4: true } } };
    const weapon = {
      name: "Fist",
      system: { tl: 0, linkedSkill: { name: "Punch", system: { slug: "punch" } } },
    };
    assert.equal(effectiveWeaponTl(attacker, weapon, "melee"), 0);
    assert.equal(isUnarmedWeapon(weapon), true);
  });
});

describe("targetBlocksWeapon", () => {
  it("Ironhide blocks unarmed and TL<=3", () => {
    const target = { system: { combat: { immuneToPrimitiveWeapons: true } } };
    assert.equal(targetBlocksWeapon(target, 0, { isUnarmed: true }), true);
    assert.equal(targetBlocksWeapon(target, PRIMITIVE_IMMUNE_TL, { isUnarmed: false }), true);
    assert.equal(targetBlocksWeapon(target, 4, { isUnarmed: false }), false);
  });

  it("power armor derived immuneWeaponTl blocks low TL", () => {
    const target = { system: { derived: { immuneWeaponTl: 3 } } };
    assert.equal(targetBlocksWeapon(target, 3), true);
    assert.equal(targetBlocksWeapon(target, 4), false);
  });
});

describe("resolveWeaponTlGate", () => {
  it("Armsman TL4 bypasses Ironhide", () => {
    const attacker = { system: { combat: { meleeCountsAsTl4: true } } };
    const target = { system: { combat: { immuneToPrimitiveWeapons: true } } };
    const weapon = { name: "Sword", system: { tl: 2 } };
    const gate = resolveWeaponTlGate(attacker, target, weapon, "melee");
    assert.equal(gate.effectiveTl, 4);
    assert.equal(gate.blocked, false);
  });
});

describe("traumaDieFormula", () => {
  it("appends Killing Blow dieMod", () => {
    assert.equal(traumaDieFormula("1d6", 0), "1d6");
    assert.equal(traumaDieFormula("1d6", 1), "1d6+1");
    assert.equal(traumaDieFormula("1d8", "2"), "1d8+2");
  });
});
