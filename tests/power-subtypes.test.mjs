/**
 * Run: node --test tests/power-subtypes.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySubtypeDefaults } from "../module/config/power-subtypes.mjs";

describe("applySubtypeDefaults", () => {
  it("sets system.subType so create does not keep the schema default art", () => {
    const system = applySubtypeDefaults("cyberware", {});
    assert.equal(system.subType, "cyberware");
    assert.equal(system.installed, false);
    assert.equal(system.alienationCost, 0);
  });

  it("overwrites a prior subType when changing types", () => {
    const system = applySubtypeDefaults("spell", { subType: "art", source: "keep-me" });
    assert.equal(system.subType, "spell");
    assert.equal(system.level, 1);
  });
});
