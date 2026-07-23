/**
 * Unit tests for item formula merge / die upgrade helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeFormulaMod } from "../module/derivations/item-formulas.mjs";

describe("mergeFormulaMod add", () => {
  it("appends numeric and formula mods", () => {
    assert.equal(mergeFormulaMod("1d6", 1), "1d6 + 1");
    assert.equal(mergeFormulaMod("1d6", "1d4"), "1d6 + 1d4");
    assert.equal(mergeFormulaMod("", 2), "2");
  });
});

describe("mergeFormulaMod upgrade", () => {
  it("upgrades die size while preserving count", () => {
    assert.equal(mergeFormulaMod("2d6", "d8", "upgrade"), "2d8");
    assert.equal(mergeFormulaMod("1d6", "1d8", "upgrade"), "1d8");
    assert.equal(mergeFormulaMod("2d6 + 1", "d10", "upgrade"), "2d10 + 1");
  });

  it("keeps base when mod die is not larger", () => {
    assert.equal(mergeFormulaMod("2d8", "d6", "upgrade"), "2d8");
    assert.equal(mergeFormulaMod("1d8", "1d8", "upgrade"), "1d8");
  });
});
