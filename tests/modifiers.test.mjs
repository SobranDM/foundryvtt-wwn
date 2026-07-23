/**
 * Unit tests for ability modifier tables.
 */
import "../build/foundry-shim.mjs";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { deriveAbilityMods } from "../module/derivations/modifiers.mjs";

const settings = new Map();

beforeEach(() => {
  settings.clear();
  settings.set("attributeModType", "wwn");
  globalThis.game = {
    settings: { get: (_ns, key) => settings.get(key) },
  };
  globalThis.CONFIG.WWN = {
    modifierTables: {
      wwn: { 0: -2, 3: -2, 4: -1, 8: 0, 14: 1, 18: 2 },
      bx: { 0: -3, 4: -2, 6: -1, 9: 0, 13: 1, 16: 2, 18: 3 },
    },
  };
});

afterEach(() => {
  delete globalThis.game;
});

describe("deriveAbilityMods", () => {
  it("applies WWN table thresholds", () => {
    const abilities = {
      str: { value: 3, baseMod: 0 },
      dex: { value: 7, baseMod: 0 },
      con: { value: 10, baseMod: 0 },
      int: { value: 14, baseMod: 0 },
      wis: { value: 18, baseMod: 0 },
      cha: { value: 1, baseMod: 0 },
    };
    deriveAbilityMods(abilities);
    assert.equal(abilities.str.mod, -2);
    assert.equal(abilities.dex.mod, -1);
    assert.equal(abilities.con.mod, 0);
    assert.equal(abilities.int.mod, 1);
    assert.equal(abilities.wis.mod, 2);
    assert.equal(abilities.cha.mod, -2);
  });

  it("adds per-ability baseMod after table lookup", () => {
    const abilities = { str: { value: 14, baseMod: 1 } };
    deriveAbilityMods(abilities);
    assert.equal(abilities.str.mod, 2);
  });

  it("uses B/X table when selected", () => {
    settings.set("attributeModType", "bx");
    const abilities = { str: { value: 18, baseMod: 0 }, dex: { value: 3, baseMod: 0 } };
    deriveAbilityMods(abilities);
    assert.equal(abilities.str.mod, 3);
    assert.equal(abilities.dex.mod, -3);
  });
});
