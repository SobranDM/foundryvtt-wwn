/**
 * Node unit tests for header resource bar helpers (HP / Strain / Alienation /
 * Stress / XP).
 * Run: node --test tests/resource-bar.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { prepareResourceBars, prepareXpBar } from "../module/sheets/helpers/resource-bar.mjs";

function makeActor(overrides = {}) {
  return {
    system: {
      hp: { value: 3, max: 6 },
      strain: { value: 2, max: 4 },
      alienation: { value: 1, valueMax: 2 },
      stress: { value: 0, valueMax: 5 },
      details: { xp: { value: 150, next: 300 } },
      ...overrides,
    },
  };
}

describe("prepareResourceBars", () => {
  let originalGame;

  beforeEach(() => {
    originalGame = globalThis.game;
  });

  afterEach(() => {
    globalThis.game = originalGame;
  });

  it("always includes HP and Strain regardless of settings", () => {
    globalThis.game = { settings: { get: () => false } };
    const bars = prepareResourceBars(makeActor());
    const ids = bars.map((b) => b.id);
    assert.ok(ids.includes("hp"));
    assert.ok(ids.includes("strain"));
    assert.ok(!ids.includes("alienation"));
    assert.ok(!ids.includes("stress"));
  });

  it("gates Alienation/Stress behind their settings", () => {
    globalThis.game = {
      settings: {
        get: (_module, key) => key === "useAlienation" || key === "useStress",
      },
    };
    const bars = prepareResourceBars(makeActor());
    const ids = bars.map((b) => b.id);
    assert.ok(ids.includes("alienation"));
    assert.ok(ids.includes("stress"));
  });

  it("computes value/ceiling/pct for HP (max ceiling, editable max)", () => {
    globalThis.game = { settings: { get: () => false } };
    const [hp] = prepareResourceBars(makeActor());
    assert.equal(hp.value, 3);
    assert.equal(hp.ceiling, 6);
    assert.equal(hp.pct, 50);
    assert.equal(hp.valuePath, "system.hp.value");
    assert.equal(hp.maxPath, "system.hp.max");
    assert.equal(hp.overflow, false);
  });

  it("computes strain (max ceiling, not editable)", () => {
    globalThis.game = { settings: { get: () => false } };
    const bars = prepareResourceBars(makeActor());
    const strain = bars.find((b) => b.id === "strain");
    assert.equal(strain.value, 2);
    assert.equal(strain.ceiling, 4);
    assert.equal(strain.pct, 50);
    assert.equal(strain.maxPath, null);
    assert.equal(strain.mode, "negative");
  });

  it("flags overflow for valueMax trackers when value exceeds ceiling", () => {
    globalThis.game = { settings: { get: () => true } };
    const bars = prepareResourceBars(makeActor({ alienation: { value: 5, valueMax: 2 } }));
    const alienation = bars.find((b) => b.id === "alienation");
    assert.equal(alienation.overflow, true);
    assert.equal(alienation.pct, 100);
  });

  it("skips trackers whose data path is missing on the actor", () => {
    globalThis.game = { settings: { get: () => true } };
    const bars = prepareResourceBars(makeActor({ stress: undefined }));
    assert.ok(!bars.some((b) => b.id === "stress"));
  });

  it("assigns barClass with mode/id/overflow modifiers", () => {
    globalThis.game = { settings: { get: () => false } };
    const [hp] = prepareResourceBars(makeActor());
    assert.equal(hp.barClass, "wwn-resource-bar wwn-resource-bar--positive wwn-resource-bar--hp");
  });
});

describe("prepareXpBar", () => {
  it("computes value/next/pct for a fill bar", () => {
    const bar = prepareXpBar(makeActor());
    assert.equal(bar.id, "xp");
    assert.equal(bar.mode, "positive");
    assert.equal(bar.value, 150);
    assert.equal(bar.ceiling, 300);
    assert.equal(bar.pct, 50);
    assert.equal(bar.valuePath, "system.details.xp.value");
  });

  it("clamps pct to 100 when value exceeds next", () => {
    const bar = prepareXpBar(makeActor({ details: { xp: { value: 500, next: 300 } } }));
    assert.equal(bar.pct, 100);
  });

  it("returns pct 0 when next is 0 (avoids divide by zero)", () => {
    const bar = prepareXpBar(makeActor({ details: { xp: { value: 0, next: 0 } } }));
    assert.equal(bar.pct, 0);
  });

  it("returns null when actor has no xp data", () => {
    const bar = prepareXpBar({ system: { details: {} } });
    assert.equal(bar, null);
  });
});
