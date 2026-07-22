/**
 * Node unit tests for WWN migration transforms (no Foundry runtime required).
 * Run: node --test tests/migration-transforms.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  migrateArtToPower,
  migrateSpellToPower,
  migrateAbilityToPower,
  migrateFocus,
  migrateItemData,
  migrateArmor,
  migrateActorData,
  normalizeWeightless,
  normalizeArmorType,
  applyEmbeddedItemMigration,
  isBarePlaceholderActorData,
} from "../module/migration/transforms.mjs";

describe("migrateArtToPower", () => {
  it("converts art items to power subtype art", () => {
    const out = migrateArtToPower({
      _id: "abc",
      name: "Healing Touch",
      type: "art",
      img: "icons/x.svg",
      system: { source: "Healer", time: "scene", effort: 1, description: "Heal" },
    });
    assert.equal(out.type, "power");
    assert.equal(out.system.subType, "art");
    assert.equal(out.system.resourceName, "Effort");
    assert.equal(out.system.commitmentOptions[0].length, "scene");
  });
});

describe("migrateSpellToPower", () => {
  it("converts spell items to power subtype spell", () => {
    const out = migrateSpellToPower({
      _id: "s1",
      name: "Magic Missile",
      type: "spell",
      system: { class: "Mage", lvl: 1, prepared: true, cast: 0 },
    });
    assert.equal(out.type, "power");
    assert.equal(out.system.subType, "spell");
    assert.equal(out.system.level, 1);
    assert.equal(out.system.resourceName, "Spell Slots");
    assert.equal(out.system.prepared, true);
  });
});

describe("migrateAbilityToPower", () => {
  it("converts ability items to power subtype ability", () => {
    const out = migrateAbilityToPower({
      name: "Second Wind",
      type: "ability",
      system: { description: "Once per day" },
    });
    assert.equal(out.type, "power");
    assert.equal(out.system.subType, "ability");
  });
});

describe("migrateFocus", () => {
  it("seeds Alert initiative Active Effects", () => {
    const out = migrateFocus({
      _id: "AlertParent00001",
      name: "Alert",
      type: "focus",
      system: { ownedLevel: 1, description: "" },
      effects: [],
    });
    assert.equal(out.type, "focus");
    assert.ok(out.effects.length >= 2);
    const keys = out.effects.flatMap((e) => (e.system?.changes ?? e.changes ?? []).map((c) => c.key));
    assert.ok(keys.some((k) => k.includes("initiative.individual.roll")));
    assert.ok(keys.some((k) => k.includes("immuneToSurprise")));
    assert.equal(out.effects.find((e) => e.name === "Alert (Level 1)").disabled, false);
    assert.equal(out.effects.find((e) => e.name === "Alert (Level 2)").disabled, true);
  });

  it("keeps Alert L1 enabled when ownedLevel is 2 (SRD in addition)", () => {
    const out = migrateFocus({
      _id: "AlertParent00002",
      name: "Alert",
      type: "focus",
      system: { ownedLevel: 2 },
      effects: [],
    });
    assert.equal(out.effects.find((e) => e.name === "Alert (Level 1)").disabled, false);
    assert.equal(out.effects.find((e) => e.name === "Alert (Level 2)").disabled, false);
  });

  it("seeds Vigilant individual init mod", () => {
    const out = migrateFocus({
      name: "Vigilant",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    const keys = out.effects.flatMap((e) => (e.system?.changes ?? e.changes ?? []).map((c) => c.key));
    assert.ok(keys.some((k) => k.includes("initiative.individual.mod")));
  });

  it("seeds Armsmaster damage and shock from Stab", () => {
    const out = migrateFocus({
      _id: "ArmsParent000001",
      name: "Armsmaster",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    const l1 = out.effects.find((e) => e.name === "Armsmaster (Level 1)");
    const keys = (l1.system?.changes ?? []).map((c) => c.key);
    assert.ok(keys.includes("system.combat.meleeDamage"));
    assert.ok(keys.includes("system.combat.meleeShock"));
  });

  it("does not duplicate Alert seeds on re-run", () => {
    const first = migrateFocus({
      _id: "AlertParent00001",
      name: "Alert",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    const second = migrateFocus(first);
    assert.equal(second.effects.length, first.effects.length);
    assert.ok(second.system.resourceGrant);
    for (const effect of first.effects) {
      assert.ok(effect._id);
      assert.equal(effect._key, `!items.effects!AlertParent00001.${effect._id}`);
    }
  });
});

describe("migrateItemData dispatcher", () => {
  it("routes art/spell/ability types", () => {
    assert.equal(migrateItemData({ type: "art", system: {} }).type, "power");
    assert.equal(migrateItemData({ type: "spell", system: {} }).type, "power");
    assert.equal(migrateItemData({ type: "ability", system: {} }).type, "power");
  });
});

describe("legacy physical field migration", () => {
  it("maps weightless never and armor unarmored", () => {
    assert.equal(normalizeWeightless("never"), "");
    assert.equal(normalizeWeightless("whenReadied"), "whenReadied");
    assert.equal(normalizeArmorType({ type: "unarmored" }), "light");
    assert.equal(normalizeArmorType({ isShield: true, type: "light" }), "shield");
    const armor = migrateArmor({
      _id: "a1",
      name: "Clothes",
      type: "armor",
      system: { type: "unarmored", weightless: "never", aac: { value: 10, mod: 0 } },
    });
    assert.equal(armor.system.type, "light");
    assert.equal(armor.system.weightless, "");
  });
});

describe("applyEmbeddedItemMigration", () => {
  it("converts art to power without dropping identity", () => {
    const out = applyEmbeddedItemMigration({
      _id: "art1",
      name: "Healing Touch",
      type: "art",
      system: { source: "Healer", time: "scene", effort: 1 },
    });
    assert.equal(out._id, "art1");
    assert.equal(out.type, "power");
    assert.equal(out.system.subType, "art");
  });

  it("merges partial weapon shock.ac fixes", () => {
    const out = applyEmbeddedItemMigration({
      _id: "w1",
      name: "Sword",
      type: "weapon",
      system: {
        skillId: "",
        shock: { damage: "1d4", ac: "" },
        ammoMode: "none",
        ammoFallback: "",
        charges: { value: 0, max: 0 },
      },
    });
    assert.equal(out.type, "weapon");
    assert.equal(out.system.shock.ac, 15);
  });
});

describe("isBarePlaceholderActorData", () => {
  it("treats empty actors as bare placeholders", () => {
    assert.equal(isBarePlaceholderActorData({ type: "character", items: [], effects: [] }), true);
    assert.equal(isBarePlaceholderActorData({ type: "monster", system: { scores: {} } }), true);
  });

  it("rejects actors with items or effects", () => {
    assert.equal(
      isBarePlaceholderActorData({ items: [{ _id: "1", type: "weapon", name: "Sword" }], effects: [] }),
      false
    );
    assert.equal(
      isBarePlaceholderActorData({ items: [], effects: [{ name: "Buff" }] }),
      false
    );
  });
});

describe("migrateActorData type preservation", () => {
  it("keeps character type when migrating scores shape", () => {
    const out = migrateActorData({
      type: "character",
      name: "Hero",
      system: {
        scores: {
          str: { value: 10 }, dex: { value: 10 }, con: { value: 10 },
          int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 },
        },
        hp: { value: 4, max: 4, hd: "1d6" },
        details: { level: 1 },
        thac0: { bba: 0 },
        skills: {},
        saves: {},
        aac: {},
        initiative: {},
        movement: { base: 30 },
      },
      items: [],
      effects: [],
    });
    assert.equal(out.type, "character");
    assert.ok(out.system.abilities);
  });

  it("keeps monster type when migrating legacy monster shape", () => {
    const out = migrateActorData({
      type: "monster",
      name: "Goblin",
      system: {
        hp: { value: 4, max: 4, hd: "1d6" },
        thac0: { bba: 1 },
        aac: { value: 12 },
        details: {},
        saves: {},
        initiative: {},
        movement: { base: 30 },
      },
      items: [],
      effects: [],
    });
    assert.equal(out.type, "monster");
    assert.equal(out.system.hd, "1d6");
  });
});
