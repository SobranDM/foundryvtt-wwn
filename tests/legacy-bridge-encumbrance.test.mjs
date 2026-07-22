/**
 * Tests for sheet-legacy-bridge remaps, migrateCharacter Tweaks→AE, encumbrance weights.
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyLegacySheetAliases,
  remapLegacySubmitData,
} from "../module/helpers/sheet-legacy-bridge.mjs";
import { migrateActorData } from "../module/migration/transforms.mjs";
import { physicalItemWeight } from "../module/derivations/encumbrance.mjs";

describe("sheet-legacy-bridge", () => {
  it("aliases abilities to scores and builds system.ac display", () => {
    const system = {
      abilities: { dex: { value: 14, mod: 1 }, str: { value: 10, mod: 0 } },
      combat: {
        ac: { base: 10, mod: 0, melee: { value: 15, mod: 0 }, ranged: { value: 14, mod: 0 } },
        ab: 3,
        initMod: 1,
      },
    };
    applyLegacySheetAliases(system, { separateRangedAC: true });
    assert.equal(system.scores.dex.value, 14);
    assert.equal(system.ac.value, 15);
    assert.equal(system.ac.ranged, 14);
    assert.equal(system.ac.naked, 11); // base 10 + dex 1
    assert.equal(system.thac0.bba, 3);
    assert.equal(system.initiative.mod, 1);
  });

  it("remaps legacy submit keys", () => {
    const flat = {
      "system.scores.str.value": 12,
      "system.aac.mod": 1,
      "system.aac.value": 16,
      "system.details.strain.value": 2,
      "system.thac0.bba": 4,
      "system.initiative.mod": 1,
    };
    const out = remapLegacySubmitData(flat);
    assert.equal(out["system.abilities.str.value"], 12);
    assert.equal(out["system.combat.ac.mod"], 1);
    assert.equal(out["system.combat.acManual.melee"], 16);
    assert.equal(out["system.strain.value"], 2);
    assert.equal(out["system.combat.ab"], 4);
    assert.equal(out["system.combat.initMod"], 1);
    assert.equal(out["system.scores.str.value"], undefined);
  });

  it("collapses duplicate-name submit arrays and drops null numbers", () => {
    const out = remapLegacySubmitData({
      "system.combat.initMod": [1, 2],
      "system.combat.ab": [null, 3],
      "system.movement.base.value": null,
      "system.combat.damageBonus": [0, null, 4],
    });
    assert.equal(out["system.combat.initMod"], 2);
    assert.equal(out["system.combat.ab"], 3);
    assert.equal(out["system.combat.damageBonus"], 4);
    assert.equal(out["system.movement.base.value"], undefined);
  });
});

describe("physicalItemWeight (charge encumbrance)", () => {
  it("uses charge count when max is 0", () => {
    assert.equal(
      physicalItemWeight("item", { weight: 1, quantity: 1, charges: { value: 20, max: 0 } }),
      20
    );
  });

  it("uses single item weight when within max", () => {
    assert.equal(
      physicalItemWeight("item", { weight: 1, quantity: 1, charges: { value: 20, max: 20 } }),
      1
    );
  });

  it("scales weight when over max (extra magazines)", () => {
    assert.equal(
      physicalItemWeight("item", { weight: 1, quantity: 1, charges: { value: 40, max: 20 } }),
      2
    );
  });

  it("ignores charge heuristics for weapons", () => {
    assert.equal(
      physicalItemWeight("weapon", { weight: 2, quantity: 1, charges: { value: 6, max: 6 } }),
      2
    );
  });
});

describe("migrateCharacter Tweaks→AE", () => {
  it("converts score tweaks and aac.mod into Migrated: WWN Tweaks effect", () => {
    const out = migrateActorData({
      type: "character",
      name: "Hero",
      system: {
        scores: {
          str: { value: 13, tweak: 1 },
          dex: { value: 10, tweak: 0 },
          con: { value: 10, tweak: 0 },
          int: { value: 10, tweak: 0 },
          wis: { value: 10, tweak: 0 },
          cha: { value: 10, tweak: 0 },
        },
        aac: { mod: 2 },
        saves: { evasion: { mod: 1 }, physical: {}, mental: {}, luck: {}, baseSave: {} },
        initiative: { mod: 0 },
        movement: { base: 30, bonus: 0 },
        details: { level: 1, class: "Expert" },
        hp: { value: 4, max: 4, hd: "1d6" },
        skills: { unspent: 0 },
        thac0: { bba: 0 },
      },
      items: [],
      effects: [],
    });
    assert.equal(out.type, "character");
    assert.equal(out.system.abilities.str.value, 13);
    const tweaks = out.effects.find((e) => e.name === "Migrated: WWN Tweaks");
    assert.ok(tweaks);
    const keys = tweaks.system.changes.map((c) => c.key);
    assert.ok(keys.includes("system.abilities.str.baseMod"));
    assert.ok(keys.includes("system.combat.ac.mod"));
    assert.ok(keys.includes("system.saves.evasion.mod"));
  });
});
