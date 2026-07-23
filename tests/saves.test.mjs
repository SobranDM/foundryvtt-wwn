/**
 * Unit tests for saving throw derivation.
 */
import "../build/foundry-shim.mjs";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { deriveSaves } from "../module/derivations/saves.mjs";

const settings = new Map();

beforeEach(() => {
  settings.clear();
  settings.set("saveSet", "wwn");
  settings.set("removeLevelSave", false);
  globalThis.game = {
    settings: { get: (_ns, key) => settings.get(key) },
  };
  globalThis.CONFIG.WWN = {
    saveSets: {
      wwn: {
        label: "WWN",
        base: 16,
        npcBase: 15,
        derivation: "wwn",
        saves: {
          physical: { label: "Physical", pair: ["str", "con"] },
          evasion: { label: "Evasion", pair: ["dex", "int"] },
          mental: { label: "Mental", pair: ["wis", "cha"] },
          luck: { label: "Luck", pair: [] },
        },
      },
    },
  };
});

afterEach(() => {
  delete globalThis.game;
});

describe("deriveSaves", () => {
  it("computes PC WWN saves with level and best pair mod", () => {
    const actor = {
      type: "character",
      system: {
        details: { level: 3 },
        abilities: {
          str: { mod: 1 },
          con: { mod: 2 },
          dex: { mod: 0 },
          int: { mod: 0 },
          wis: { mod: 0 },
          cha: { mod: 0 },
        },
        saves: { base: { mod: 0 }, physical: { mod: 0 }, evasion: { mod: 0 }, mental: { mod: 0 }, luck: { mod: 0 } },
      },
    };
    deriveSaves(actor);
    // 16 + 0 + 0 - best(1,2)=2 - level 3 = 11
    assert.equal(actor.system.saves.physical.value, 11);
    // luck has no pair → best 0 → 16 - 3 = 13
    assert.equal(actor.system.saves.luck.value, 13);
  });

  it("skips level subtraction when removeLevelSave is on", () => {
    settings.set("removeLevelSave", true);
    const actor = {
      type: "character",
      system: {
        details: { level: 5 },
        abilities: {
          str: { mod: 0 },
          con: { mod: 0 },
          dex: { mod: 0 },
          int: { mod: 0 },
          wis: { mod: 0 },
          cha: { mod: 0 },
        },
        saves: { base: { mod: 0 }, physical: { mod: 0 }, evasion: { mod: 0 }, mental: { mod: 0 }, luck: { mod: 0 } },
      },
    };
    deriveSaves(actor);
    assert.equal(actor.system.saves.physical.value, 16);
  });

  it("uses HD-based NPC saves", () => {
    const actor = {
      type: "monster",
      system: {
        hd: "4",
        saveMods: {},
        saves: { base: { mod: 0 }, physical: { mod: 0 }, evasion: { mod: 0 }, mental: { mod: 0 }, luck: { mod: 0 } },
      },
    };
    deriveSaves(actor);
    // npcBase 15 - floor(4/2)=2 → 13
    assert.equal(actor.system.saves.physical.value, 13);
  });
});
