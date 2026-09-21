/**
 * Tests for sheet-legacy-bridge remaps, migrateCharacter Tweaks→AE, encumbrance weights.
 */
import "../build/foundry-shim.mjs";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyLegacySheetAliases,
  remapLegacySubmitData,
} from "../module/helpers/sheet-legacy-bridge.mjs";
import { migrateActorData } from "../module/migration/transforms.mjs";
import { physicalItemWeight, deriveEncumbrance } from "../module/derivations/encumbrance.mjs";

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

describe("deriveEncumbrance (party-carried parity)", () => {
  const originalGame = globalThis.game;
  afterEach(() => {
    globalThis.game = originalGame;
  });

  function pcActor({ uuid, items, str = 10 }) {
    return {
      type: "character",
      uuid,
      items,
      system: { abilities: { str: { value: str } } },
    };
  }

  it("an identical gold stack encumbers the same whether owned directly or carried for the party", () => {
    globalThis.game = { settings: { get: () => false }, actors: [] };

    const direct = pcActor({
      uuid: "Actor.direct",
      items: [{ type: "currency", system: { carried: 500, perSlot: 100 } }],
    });
    deriveEncumbrance(direct);

    const carrier = pcActor({ uuid: "Actor.carrier", items: [] });
    globalThis.game.actors = [
      {
        type: "party",
        items: [{ id: "c1", type: "currency", system: { carried: 500, perSlot: 100 } }],
        system: { carrierAssignments: { c1: "Actor.carrier" } },
      },
    ];
    deriveEncumbrance(carrier);

    assert.equal(direct.system.encumbrance.stowed.value, carrier.system.encumbrance.stowed.value);
    assert.equal(carrier.system.encumbrance.partyCarried, direct.system.encumbrance.stowed.value);
  });

  it("an identical physical item encumbers the same whether owned directly or carried for the party", () => {
    globalThis.game = { settings: { get: () => true }, actors: [] }; // roundWeight on

    const direct = pcActor({
      uuid: "Actor.direct",
      items: [{ type: "item", system: { weight: 1.5, quantity: 1, stowed: true, equipped: false } }],
    });
    deriveEncumbrance(direct);

    const carrier = pcActor({ uuid: "Actor.carrier", items: [] });
    globalThis.game.actors = [
      {
        type: "party",
        items: [{ id: "i1", type: "item", system: { weight: 1.5, quantity: 1 } }],
        system: { carrierAssignments: { i1: "Actor.carrier" } },
      },
    ];
    deriveEncumbrance(carrier);

    assert.equal(direct.system.encumbrance.stowed.value, carrier.system.encumbrance.stowed.value);
  });

  it("party-carried weight is zero when nothing is assigned to this actor", () => {
    globalThis.game = {
      settings: { get: () => false },
      actors: [
        {
          type: "party",
          items: [{ id: "i1", type: "item", system: { weight: 5, quantity: 1 } }],
          system: { carrierAssignments: { i1: "Actor.other" } },
        },
      ],
    };
    const actor = pcActor({ uuid: "Actor.pc1", items: [] });
    deriveEncumbrance(actor);
    assert.equal(actor.system.encumbrance.stowed.value, 0);
    assert.equal(actor.system.encumbrance.partyCarried, 0);
  });

  it("sums many small party-carried items raw instead of rounding each one up individually", () => {
    globalThis.game = {
      settings: { get: () => true }, // roundWeight on
      actors: [
        {
          type: "party",
          items: [
            { id: "i1", type: "item", system: { weight: 0.4, quantity: 1 } },
            { id: "i2", type: "item", system: { weight: 0.4, quantity: 1 } },
            { id: "i3", type: "item", system: { weight: 0.4, quantity: 1 } },
          ],
          system: { carrierAssignments: { i1: "Actor.pc1", i2: "Actor.pc1", i3: "Actor.pc1" } },
        },
      ],
    };
    const actor = pcActor({ uuid: "Actor.pc1", items: [] });
    deriveEncumbrance(actor);
    // Per-item rounding would give ceil(0.4)*3 = 3; raw-summed-then-rounded-
    // once gives ceil(1.2) = 2.
    assert.equal(actor.system.encumbrance.stowed.value, 2);
  });

  it("a party-assigned coin rides along for free once the PC's own currency already rounds up a slot", () => {
    globalThis.game = {
      settings: { get: () => true }, // roundWeight on
      actors: [
        {
          type: "party",
          items: [{ id: "c1", type: "currency", system: { carried: 5, perSlot: 100 } }], // 0.05 slots
          system: { carrierAssignments: { c1: "Actor.pc1" } },
        },
      ],
    };
    // Own currency: 5/100 = 0.05 slots -- already rounds up to occupy 1 slot by itself.
    const actor = pcActor({
      uuid: "Actor.pc1",
      items: [{ type: "currency", system: { carried: 5, perSlot: 100 } }],
    });
    deriveEncumbrance(actor);
    assert.equal(actor.system.encumbrance.stowed.value, 1);
    // The raw display number still honestly reflects the party's own tiny
    // slice, even though it changed nothing about the rounded total above.
    assert.equal(actor.system.encumbrance.partyCarried, 0.05);
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
