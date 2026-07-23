import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPilotTrained,
  resolvePilot,
  buildMergedRollData,
  usesTrainingDisadvantage,
} from "../module/helpers/power-armor-pilot.mjs";
import { splitSoakDamage } from "../module/helpers/power-armor-damage.mjs";

describe("power-armor-pilot", () => {
  it("resolves actor vs unassigned vs broken", () => {
    const actors = { "Actor.abc": { id: "abc", system: { abilities: { str: { value: 10 } } } } };
    assert.equal(resolvePilot({}, () => null).mode, "unassigned");
    assert.equal(resolvePilot({ actor: "Actor.abc" }, (u) => actors[u]).mode, "actor");
    assert.equal(resolvePilot({ actor: "Actor.missing" }, (u) => actors[u]).broken, true);
  });

  it("checks trained pilot list", () => {
    assert.equal(isPilotTrained("Actor.a", ["Actor.a"]), true);
    assert.equal(isPilotTrained("Actor.b", ["Actor.a"]), false);
    assert.equal(isPilotTrained(null, ["Actor.a"]), false);
  });

  it("overlays exo strength on merged roll data without mutating pilot", () => {
    const pilot = { system: { abilities: { str: { value: 10, mod: 0 } }, hp: { value: 8, max: 8 } } };
    const merged = buildMergedRollData(
      pilot,
      { effectiveStrength: 18, effectiveStrengthMod: 4, ac: 18, soakMax: 20, powered: true, inert: false },
      { soak: { value: 20, max: 20 }, frameType: "centurion" },
    );
    assert.equal(pilot.system.abilities.str.value, 10);
    assert.equal(merged.abilities.str.value, 18);
    assert.equal(merged.abilities.str.mod, 4);
    assert.equal(merged.ac, 18);
    assert.equal(merged.hp.value, 8);
  });

  it("flags attack save skill for training disadvantage", () => {
    assert.equal(usesTrainingDisadvantage("attack"), true);
    assert.equal(usesTrainingDisadvantage("save"), true);
    assert.equal(usesTrainingDisadvantage("skill"), true);
    assert.equal(usesTrainingDisadvantage("other"), false);
  });
});

describe("power-armor-damage", () => {
  it("splits damage across soak then overflow", () => {
    assert.deepEqual(splitSoakDamage(12, 20), { soakTaken: 12, soakRemaining: 8, overflow: 0 });
    assert.deepEqual(splitSoakDamage(25, 20), { soakTaken: 20, soakRemaining: 0, overflow: 5 });
    assert.deepEqual(splitSoakDamage(5, 0), { soakTaken: 0, soakRemaining: 0, overflow: 5 });
  });
});
