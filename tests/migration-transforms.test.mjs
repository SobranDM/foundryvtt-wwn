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
  migratePcCombatAb,
  inferAttackProgression,
  isModernGearSystem,
  normalizeWeightless,
  normalizeArmorType,
  applyEmbeddedItemMigration,
  migrateActorItems,
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
    assert.equal(out.system.commitmentOptions[0].cost, 1);
  });

  it("maps blank and dash time to no pool commitment", () => {
    for (const time of ["", "-", "  ", undefined]) {
      const out = migrateArtToPower({
        name: "Passive Art",
        type: "art",
        system: time === undefined ? {} : { time },
      });
      assert.deepEqual(out.system.commitmentOptions[0], { cost: 0, length: "none", note: "" }, `time=${JSON.stringify(time)}`);
    }
  });

  it("maps Active and commit time to active commitment", () => {
    for (const time of ["Active", "commit", "ACTIVE"]) {
      const out = migrateArtToPower({
        name: "Maintained Art",
        type: "art",
        system: { time },
      });
      assert.deepEqual(out.system.commitmentOptions[0], { cost: 1, length: "active", note: "" }, `time=${time}`);
    }
  });

  it("maps Scene and Day case-insensitively", () => {
    assert.equal(
      migrateArtToPower({ name: "A", type: "art", system: { time: "Scene" } }).system.commitmentOptions[0].length,
      "scene"
    );
    assert.deepEqual(
      migrateArtToPower({ name: "B", type: "art", system: { time: "Day" } }).system.commitmentOptions[0],
      { cost: 1, length: "day", note: "" }
    );
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

  it("seeds Shocking Assault unarmedShock separately from meleeShock", () => {
    const out = migrateFocus({
      _id: "ShockParent000001",
      name: "Shocking Assault",
      type: "focus",
      system: { ownedLevel: 2 },
      effects: [],
    });
    const l2 = out.effects.find((e) => e.name === "Shocking Assault (Level 2)");
    const keys = (l2.system?.changes ?? []).map((c) => c.key);
    assert.ok(keys.includes("system.combat.meleeShock"));
    assert.ok(keys.includes("system.combat.unarmedShock"));
  });

  it("drops retired art-as-armor items from actor inventories", () => {
    const out = migrateActorItems([
      { _id: "KeepArmor00000001", name: "Leather", type: "armor", system: { type: "light" } },
      { _id: "ColdFleshGear0001", name: "Cold Flesh", type: "armor", system: { type: "light", ac: 12 } },
      { _id: "PavisGear00000001", name: "Pavis of Elements", type: "armor", system: { type: "light" } },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, "Leather");
  });

  it("seeds Die Hard autoStabilize and a daily internal resource", () => {
    const out = migrateFocus({
      _id: "DieHardParent0001",
      name: "Die Hard",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    const l1 = out.effects.find((e) => e.name === "Die Hard (Level 1)");
    const keys = (l1.system?.changes ?? []).map((c) => c.key);
    assert.ok(keys.includes("system.hitDice.perLevelMod"));
    assert.ok(keys.includes("system.combat.autoStabilize"));
    assert.equal(out.system.internalResource.max, 1);
    assert.equal(out.system.resourceLength, "day");
  });

  it("patches an existing Die Hard L1 AE that lacks autoStabilize", () => {
    const out = migrateFocus({
      _id: "DieHardParent0002",
      name: "Die Hard",
      type: "focus",
      system: { ownedLevel: 1, internalResource: { value: 0, max: 1 }, resourceLength: "day" },
      effects: [
        {
          name: "Die Hard (Level 1)",
          flags: { wwn: { focusLevel: 1 } },
          system: {
            changes: [{ key: "system.hitDice.perLevelMod", type: "add", value: 2, phase: "final" }],
          },
        },
      ],
    });
    const keys = out.effects[0].system.changes.map((c) => c.key);
    assert.ok(keys.includes("system.combat.autoStabilize"));
    assert.equal(keys.filter((k) => k === "system.combat.autoStabilize").length, 1);
  });

  it("seeds Unarmed Combatant L2 punchMissDamage", () => {
    const out = migrateFocus({
      _id: "UnarmedParent0001",
      name: "Unarmed Combatant",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    const l2 = out.effects.find((e) => e.name === "Unarmed Combatant (Level 2)");
    assert.equal(l2.disabled, true);
    assert.equal(l2.flags.wwn.focusLevel, 2);
    assert.equal(l2.system.changes[0].key, "system.combat.punchMissDamage");
    assert.deepEqual(out.system.bonusSkills, ["punch"]);
  });

  it("seeds Gyre L2 mental attribute choice AEs", () => {
    const out = migrateFocus({
      _id: "GyreParent0000001",
      name: "Origin Focus: Elf, Gyre",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    const names = out.effects.map((e) => e.name);
    assert.ok(names.includes("Elf, Gyre L2 (Intelligence +1)"));
    assert.ok(names.includes("Elf, Gyre L2 (Wisdom +1)"));
    assert.ok(names.includes("Elf, Gyre L2 (Charisma +1)"));
    assert.ok(out.effects.every((e) => e.disabled && e.flags.wwn.skipFocusLevelSync));
  });

  it("seeds Half-Elf Dex+1 / Con−1 choice AE", () => {
    const out = migrateFocus({
      _id: "HalfElfParent0001",
      name: "Origin Focus: Elf, Half-Elf",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    assert.equal(out.effects.length, 1);
    assert.equal(out.effects[0].name, "Elf, Half-Elf (Dexterity +1 / Constitution −1)");
    assert.equal(out.effects[0].disabled, true);
    const keys = out.effects[0].system.changes.map((c) => `${c.key}:${c.value}`);
    assert.ok(keys.includes("system.abilities.dex.baseMod:1"));
    assert.ok(keys.includes("system.abilities.con.baseMod:-1"));
  });

  it("seeds a single enabled AE for Developed Attribute (Dexterity)", () => {
    const out = migrateFocus({
      _id: "DevDex0000000001",
      name: "Developed Attribute (Dexterity)",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [],
    });
    assert.equal(out.effects.length, 1);
    assert.equal(out.effects[0].disabled, false);
    assert.deepEqual(out.effects[0].system.changes, [
      { key: "system.abilities.dex.baseMod", type: "add", value: 1, phase: "initial" },
    ]);
  });

  it("splits a legacy combined Developed Attribute using the enabled AE", () => {
    const out = migrateFocus({
      _id: "DevLegacy0000001",
      name: "Developed Attribute",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [
        {
          name: "Developed Attribute (Strength)",
          disabled: true,
          system: { changes: [{ key: "system.abilities.str.baseMod", type: "add", value: 1, phase: "initial" }] },
        },
        {
          name: "Developed Attribute (Wisdom)",
          disabled: false,
          system: { changes: [{ key: "system.abilities.wis.baseMod", type: "add", value: 1, phase: "initial" }] },
        },
      ],
    });
    assert.equal(out.name, "Developed Attribute (Wisdom)");
    assert.equal(out.effects.length, 1);
    assert.equal(out.effects[0].disabled, false);
    assert.equal(out.effects[0].system.changes[0].key, "system.abilities.wis.baseMod");
  });

  it("splits an unpicked combined Developed Attribute using the first variant", () => {
    const out = migrateFocus({
      _id: "DevLegacy0000002",
      name: "Developed Attribute",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [
        {
          name: "Developed Attribute (Strength)",
          disabled: true,
          system: { changes: [{ key: "system.abilities.str.baseMod", type: "add", value: 1, phase: "initial" }] },
        },
        {
          name: "Developed Attribute (Wisdom)",
          disabled: true,
          system: { changes: [{ key: "system.abilities.wis.baseMod", type: "add", value: 1, phase: "initial" }] },
        },
      ],
    });
    assert.equal(out.name, "Developed Attribute (Strength)");
    assert.equal(out.effects.length, 1);
    assert.equal(out.effects[0].disabled, false);
    assert.equal(out.effects[0].system.changes[0].key, "system.abilities.str.baseMod");
  });

  it("rewrites Lizardman innate 13 to 12 and seeds AC +1", () => {
    const out = migrateFocus({
      _id: "LizardParent0001",
      name: "Origin Focus: Lizardman",
      type: "focus",
      system: { ownedLevel: 1 },
      effects: [
        {
          name: "Lizardman (Level 1)",
          flags: { wwn: { focusLevel: 1 } },
          system: {
            changes: [
              { key: "system.combat.innateAc.min", type: "upgrade", value: 13, phase: "final" },
            ],
          },
        },
      ],
    });
    const innate = out.effects.find((e) => e.name === "Lizardman (Level 1)");
    const acBonus = out.effects.find((e) => e.name === "Lizardman (AC +1)");
    assert.equal(innate.system.changes[0].value, 12);
    assert.deepEqual(acBonus.system.changes, [
      { key: "system.combat.ac.mod", type: "add", value: 1, phase: "initial" },
    ]);
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

  it("no-ops modern gear so personal/treasure are not rebuilt away", () => {
    const modern = {
      _id: "g1",
      name: "Gem",
      type: "item",
      system: {
        treasure: true,
        personal: true,
        expendOnUse: false,
        charges: { value: 0, max: 0 },
        container: { isContainer: false, isOpen: true },
        price: 50,
        quantity: 1,
      },
    };
    assert.equal(isModernGearSystem(modern.system), true);
    assert.equal(migrateItemData(modern), null);
    const again = applyEmbeddedItemMigration(modern);
    assert.equal(again.system.personal, true);
    assert.equal(again.system.treasure, true);
  });
});

describe("migratePcCombatAb merge helpers", () => {
  it("returns residual abMod without replacing other combat fields at call site", () => {
    const patch = migratePcCombatAb(
      { details: { level: 5 }, combat: { ab: 5, initiative: { mod: 2 } } },
      { progression: "expert" }
    );
    assert.ok(patch);
    assert.equal(typeof patch.combat.abMod, "number");
  });

  it("does not invent a residual when combat.ab is missing (partial updates)", () => {
    assert.equal(migratePcCombatAb({ details: { level: 8 } }), null);
    assert.equal(migratePcCombatAb({ details: { level: 6 }, combat: {} }), null);
    assert.equal(
      migratePcCombatAb({ details: { level: 8 }, combat: { initiative: { mod: 1 } } }),
      null,
    );
  });

  it("infers warrior progression from classEdge", () => {
    assert.equal(
      inferAttackProgression(
        { items: [{ type: "classEdge", system: { attackProgression: "warrior" } }] },
        {}
      ),
      "warrior"
    );
    assert.equal(inferAttackProgression({ items: [] }, {}), "expert");
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
    assert.equal(armor.system.tl, 1);
    assert.equal(armor.system.magical, false);
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
  it("does not rewrite modern PC combat on live migrate (world migrate owns residuals)", () => {
    const out = migrateActorData({
      type: "character",
      name: "Veteran",
      system: {
        abilities: { str: { value: 10, mod: 0 } },
        details: { level: 4 },
        combat: { ab: 4, initiative: { mod: 1 }, soak: 2 },
        warrior: true,
      },
      items: [],
      effects: [],
    });
    assert.equal(out.type, "character");
    assert.equal(out.system, null);
  });

  it("sweeps a spurious -half-level abMod left by live actor migration into a visible effect", () => {
    const out = migrateActorData({
      type: "character",
      name: "High Mage",
      system: {
        abilities: { int: { value: 14, mod: 1 } },
        details: { level: 6 },
        combat: { abMod: -3, initiative: { mod: 1 } },
      },
      items: [{ type: "classEdge", system: { attackProgression: "mage" } }],
      effects: [],
    });
    assert.equal(out.system.combat.abMod, 0);
    assert.equal(out.system.combat.initiative.mod, 1);
    const abEffect = out.effects.find((e) => e.name === "Migrated: Attack Bonus");
    assert.ok(abEffect, "expected a Migrated: Attack Bonus effect");
    assert.deepEqual(abEffect.system.changes, [
      { key: "system.combat.abMod", type: "add", value: -3, phase: "initial" },
    ]);
  });

  it("sweeps any stray nonzero persisted abMod (not just the -half-level fingerprint), like Decimus's pre-fix state", () => {
    const out = migrateActorData({
      type: "character",
      name: "Decimus-like",
      system: {
        abilities: { int: { value: 15, mod: 1 } },
        details: { level: 6 },
        combat: { abMod: 3, initiative: { mod: 1 } },
      },
      items: [
        { type: "classEdge", system: { attackProgression: "partialWarrior" } },
        { type: "classEdge", system: { attackProgression: "mage" } },
      ],
      effects: [],
    });
    assert.equal(out.system.combat.abMod, 0);
    assert.equal(out.system.combat.initiative.mod, 1);
    const abEffect = out.effects.find((e) => e.name === "Migrated: Attack Bonus");
    assert.ok(abEffect, "expected a Migrated: Attack Bonus effect");
    assert.deepEqual(abEffect.system.changes, [
      { key: "system.combat.abMod", type: "add", value: 3, phase: "initial" },
    ]);

    // Re-running on the swept output (abMod already 0) must be a no-op —
    // no second effect, no system rewrite. Idempotent by construction: the
    // sweep only fires while persisted abMod is nonzero.
    const again = migrateActorData({
      type: "character",
      name: "Decimus-like",
      system: {
        abilities: { int: { value: 15, mod: 1 } },
        details: { level: 6 },
        combat: out.system.combat,
      },
      items: [
        { type: "classEdge", system: { attackProgression: "partialWarrior" } },
        { type: "classEdge", system: { attackProgression: "mage" } },
      ],
      effects: [abEffect],
    });
    assert.equal(again.system, null);
    assert.equal(
      again.effects.filter((e) => e.name === "Migrated: Attack Bonus").length,
      1,
      "must not duplicate the Migrated: Attack Bonus effect"
    );
  });

  it("is a no-op for an already-clean actor (abMod already 0)", () => {
    const out = migrateActorData({
      type: "character",
      name: "Already Clean",
      system: {
        abilities: { int: { value: 15, mod: 1 } },
        details: { level: 6 },
        combat: { abMod: 0, initiative: { mod: 1 } },
      },
      items: [],
      effects: [],
    });
    assert.equal(out.system, null);
    assert.equal(out.effects.find((e) => e.name === "Migrated: Attack Bonus"), undefined);
  });

  it("converts legacy thac0.bba into a visible 'Migrated: Attack Bonus' effect, never persisted abMod", () => {
    const out = migrateActorData({
      type: "character",
      name: "Old Timer",
      system: {
        scores: {
          str: { value: 10 }, dex: { value: 10 }, con: { value: 10 },
          int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 },
        },
        hp: { value: 10, max: 10, hd: "1d6" },
        details: { level: 4 },
        thac0: { bba: 6 },
        warrior: true,
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
    // abMod must never be baked into persisted combat data.
    assert.equal(out.system.combat, undefined);
    const abEffect = out.effects.find((e) => e.name === "Migrated: Attack Bonus");
    assert.ok(abEffect, "expected a Migrated: Attack Bonus effect");
    assert.deepEqual(abEffect.system.changes, [
      { key: "system.combat.abMod", type: "add", value: 2, phase: "initial" },
    ]);
  });

  it("does not inject combat into a partial level-only migrate payload", () => {
    const out = migrateActorData({
      type: "character",
      name: "Leveling",
      system: { details: { level: 8 } },
      items: [{ type: "classEdge", system: { attackProgression: "warrior" } }],
      effects: [],
    });
    assert.equal(out.system, null);
  });

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
