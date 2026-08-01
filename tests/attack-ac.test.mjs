/**
 * Unit tests for per-attack AC ignore (firearm / TL / AP).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldIgnoreArmorPiece, resolveTargetAcForAttack } from "../module/helpers/attack-ac.mjs";
import { IGNORABLE_ARMOR_TL } from "../module/helpers/weapon-tl.mjs";

describe("shouldIgnoreArmorPiece", () => {
  it("ignores TL≤2 non-magical for firearm", () => {
    const piece = { system: { tl: IGNORABLE_ARMOR_TL, magical: false } };
    assert.deepEqual(
      shouldIgnoreArmorPiece(piece, { firearm: true, effectiveTl: 0, hasAp: false }),
      { ignore: true, reason: "firearm" }
    );
  });

  it("does not ignore TL3 armor for firearm", () => {
    const piece = { system: { tl: 3, magical: false } };
    assert.equal(
      shouldIgnoreArmorPiece(piece, { firearm: true, effectiveTl: 0, hasAp: false }).ignore,
      false
    );
  });

  it("ignores TL≤2 for TL4+ weapon", () => {
    const piece = { system: { tl: 2, magical: false } };
    assert.deepEqual(
      shouldIgnoreArmorPiece(piece, { firearm: false, effectiveTl: 4, hasAp: false }),
      { ignore: true, reason: "highTl" }
    );
  });

  it("magical blocks firearm and AP ignore", () => {
    const piece = { system: { tl: 0, magical: true } };
    assert.equal(
      shouldIgnoreArmorPiece(piece, { firearm: true, effectiveTl: 4, hasAp: true }).ignore,
      false
    );
  });

  it("AP ignores any non-magical piece regardless of TL", () => {
    const piece = { system: { tl: 5, magical: false } };
    assert.deepEqual(
      shouldIgnoreArmorPiece(piece, { firearm: false, effectiveTl: 0, hasAp: true }),
      { ignore: true, reason: "ap" }
    );
  });
});

function makeTarget({ armors = [], dex = 0, type = "character" } = {}) {
  return {
    type,
    items: armors,
    system: {
      abilities: { dex: { mod: dex } },
      combat: {
        ac: { base: 10, mod: 0, melee: { mod: 0, value: 10 }, ranged: { mod: 0, value: 10 } },
        innateAc: { min: 0 },
        acManual: { melee: 14, ranged: 14 },
      },
    },
  };
}

describe("resolveTargetAcForAttack", () => {
  it("keeps Dex when ignoring body armor", () => {
    const armor = {
      id: "a1",
      name: "Leather",
      type: "armor",
      system: { equipped: true, type: "light", tl: 0, magical: false, ac: 15, acValue: 15, mod: 0, modValue: 0 },
    };
    const target = makeTarget({ armors: [armor], dex: 2 });
    const weapon = { system: { firearm: true, tl: 3, tags: [] } };
    const result = resolveTargetAcForAttack({}, target, weapon, "ranged", { separateRanged: false });
    assert.equal(result.ignored.length, 1);
    // base 10 + dex 2
    assert.equal(result.ac, 12);
  });

  it("evaluates shield independently of body armor", () => {
    const body = {
      id: "a1",
      name: "Mail",
      type: "armor",
      system: { equipped: true, type: "medium", tl: 2, magical: false, ac: 16, acValue: 16, mod: 0, modValue: 0 },
    };
    const shield = {
      id: "s1",
      name: "Shield",
      type: "armor",
      system: { equipped: true, type: "shield", tl: 3, magical: false, ac: 10, acValue: 10, mod: 0, modValue: 0 },
    };
    const target = makeTarget({ armors: [body, shield], dex: 0 });
    const weapon = { system: { firearm: true, tl: 3, tags: [] } };
    const result = resolveTargetAcForAttack({}, target, weapon, "melee", { separateRanged: false });
    assert.equal(result.ignored.length, 1);
    assert.equal(result.ignored[0].isShield, false);
    // body ignored; shield remains: max(shieldOnly=10, base10+1) = 11
    assert.equal(result.ac, 11);
  });

  it("NPC manual AC with no gear is unchanged", () => {
    const target = makeTarget({ type: "monster", armors: [] });
    target.system.combat.ac.melee.value = 16;
    target.system.combat.ac.ranged.value = 16;
    const weapon = { system: { firearm: true, tl: 4, tags: ["AP"] } };
    const result = resolveTargetAcForAttack({}, target, weapon, "melee", { separateRanged: false });
    assert.equal(result.ac, 16);
    assert.equal(result.ignored.length, 0);
  });

  it("power-armor targets use derived suit AC without throwing", () => {
    const target = {
      type: "powerArmor",
      items: [],
      system: { ac: 16, derived: { ac: 18 } },
    };
    const weapon = { system: { firearm: true, tl: 4, tags: [] } };
    const result = resolveTargetAcForAttack({}, target, weapon, "ranged", { separateRanged: false });
    assert.equal(result.ac, 18);
    assert.equal(result.ignored.length, 0);
  });

  it("faction-like targets without combat.ac return null AC", () => {
    const target = {
      type: "faction",
      items: [],
      system: { wealth: { value: 0 } },
    };
    const weapon = { system: { firearm: false, tl: 0, tags: [] } };
    const result = resolveTargetAcForAttack({}, target, weapon, "melee", { separateRanged: false });
    assert.equal(result.ac, null);
    assert.equal(result.ignored.length, 0);
  });

  it("firearm does not ignore TL3 heavy armor", () => {
    const armor = {
      id: "a1",
      name: "Great Armor",
      type: "armor",
      system: { equipped: true, type: "heavy", tl: 3, magical: false, ac: 18, acValue: 18, mod: 0, modValue: 0 },
    };
    const target = makeTarget({ armors: [armor], dex: 0 });
    const weapon = { system: { firearm: true, tl: 3, tags: [] } };
    const result = resolveTargetAcForAttack({}, target, weapon, "ranged", { separateRanged: false });
    assert.equal(result.ignored.length, 0);
    assert.equal(result.ac, 18);
  });

  it("firearm does not ignore magical light armor", () => {
    const armor = {
      id: "a1",
      name: "Buff Coat +1",
      type: "armor",
      system: { equipped: true, type: "light", tl: 1, magical: true, ac: 12, acValue: 12, mod: 1, modValue: 1 },
    };
    const target = makeTarget({ armors: [armor], dex: 0 });
    const weapon = { system: { firearm: true, tl: 3, tags: [] } };
    const result = resolveTargetAcForAttack({}, target, weapon, "ranged", { separateRanged: false });
    assert.equal(result.ignored.length, 0);
    assert.equal(result.ac, 13);
  });
});
