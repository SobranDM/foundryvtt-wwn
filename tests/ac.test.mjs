/**
 * Unit tests for AC / trauma derivation.
 */
import "../build/foundry-shim.mjs";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { deriveAC, deriveTraumaTarget, actorHasBodyArmor } from "../module/derivations/ac.mjs";

const settings = new Map();

function mockSettings(entries = {}) {
  settings.clear();
  for (const [k, v] of Object.entries(entries)) settings.set(k, v);
  globalThis.game = {
    settings: {
      get: (_ns, key) => settings.get(key),
    },
  };
}

function baseCombat() {
  return {
    ac: {
      base: 10,
      mod: 0,
      melee: { mod: 0, value: 0 },
      ranged: { mod: 0, value: 0 },
    },
    innateAc: { min: 0 },
    soak: 0,
  };
}

function pcActor({ items = [], abilities = { dex: { mod: 0 } }, combat = baseCombat(), skills = {} } = {}) {
  return {
    type: "character",
    items,
    system: {
      abilities,
      combat,
      skills,
      trauma: { base: 6, targetMod: 0, value: 6 },
    },
  };
}

describe("deriveAC", () => {
  beforeEach(() => {
    mockSettings({
      separateRangedAC: false,
      useTrauma: true,
      useFlatArmorPenalty: false,
    });
  });

  afterEach(() => {
    delete globalThis.game;
  });

  it("mirrors ranged to melee after innate floor when separate ranged is off", () => {
    const actor = pcActor({
      combat: { ...baseCombat(), innateAc: { min: 15 } },
    });
    deriveAC(actor);
    assert.equal(actor.system.combat.ac.melee.value, 15);
    assert.equal(actor.system.combat.ac.ranged.value, 15);
  });

  it("honors explicit ranged AC of 0 instead of falling back to melee armor AC", () => {
    mockSettings({
      separateRangedAC: true,
      useTrauma: true,
      useFlatArmorPenalty: false,
    });
    const actor = pcActor({
      items: [
        {
          type: "armor",
          system: {
            equipped: true,
            type: "medium",
            ac: 14,
            acRanged: 0,
            mod: 0,
            weight: 1,
          },
        },
      ],
    });
    deriveAC(actor);
    assert.equal(actor.system.combat.ac.melee.value, 14);
    // acRanged 0 must not truthiness-fall through to ac 14; unarmed base 10 wins Math.max.
    assert.equal(actor.system.combat.ac.ranged.value, 10);
  });

  it("adds shield bonus on top of unarmored base", () => {
    const actor = pcActor({
      items: [
        {
          type: "armor",
          system: { equipped: true, type: "shield", ac: 10, mod: 0 },
        },
      ],
    });
    deriveAC(actor);
    // shieldOnly = 10 + 0, withArmor+shield = 10 + 1 → max is 11
    assert.equal(actor.system.combat.ac.melee.value, 11);
  });

  it("detects body armor vs shield-only", () => {
    assert.equal(
      actorHasBodyArmor({
        items: [{ type: "armor", system: { equipped: true, type: "shield" } }],
      }),
      false,
    );
    assert.equal(
      actorHasBodyArmor({
        items: [{ type: "armor", system: { equipped: true, type: "light" } }],
      }),
      true,
    );
  });
});

describe("deriveTraumaTarget", () => {
  it("uses highest equipped body armor trauma target", () => {
    const actor = pcActor({
      items: [
        { type: "armor", system: { equipped: true, type: "medium", traumaTarget: 8 } },
        { type: "armor", system: { equipped: true, type: "shield", traumaTarget: 4 } },
      ],
    });
    deriveTraumaTarget(actor, true);
    assert.equal(actor.system.trauma.base, 8);
    assert.equal(actor.system.trauma.value, 8);
  });

  it("adds AE targetMod onto base (Hard To Kill)", () => {
    const actor = pcActor();
    actor.system.trauma.targetMod = 1;
    deriveTraumaTarget(actor, true);
    assert.equal(actor.system.trauma.base, 6);
    assert.equal(actor.system.trauma.value, 7);
  });

  it("stacks armor base with AE targetMod", () => {
    const actor = pcActor({
      items: [{ type: "armor", system: { equipped: true, type: "medium", traumaTarget: 8 } }],
    });
    actor.system.trauma.targetMod = 1;
    deriveTraumaTarget(actor, true);
    assert.equal(actor.system.trauma.base, 8);
    assert.equal(actor.system.trauma.value, 9);
  });
});
