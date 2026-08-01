/**
 * Node unit tests for ammo / magazine helpers.
 * Run: node --test tests/ammo.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AMMO_MODES,
  availableAmmoCount,
  usesChargeStack,
  magazineMax,
  resolveLinkedAmmo,
  planAttackAmmoSpend,
  planReload,
  planExpendGear,
  mapWeaponAmmoMigration,
  ammoNameMatches,
  ammoNameScore,
} from "../module/helpers/ammo.mjs";
import {
  repairWwnWeaponAmmo,
  migrateItemData,
  migrateGearToAmmo,
  isKnownAmmoItem,
  isKnownFirearmWeapon,
  repairWwnWeaponFirearm,
  repairWwnArmorTlMagical,
  migrateActorItems,
} from "../module/migration/transforms.mjs";
import "../build/foundry-shim.mjs";

describe("availableAmmoCount / usesChargeStack", () => {
  it("uses charges when max > 0", () => {
    assert.equal(usesChargeStack({ charges: { value: 20, max: 20 } }), true);
    assert.equal(availableAmmoCount({ charges: { value: 20, max: 20 }, quantity: 1 }), 20);
  });

  it("uses quantity when no charge max", () => {
    assert.equal(usesChargeStack({ charges: { value: 0, max: 0 }, quantity: 5 }), false);
    assert.equal(availableAmmoCount({ charges: { value: 0, max: 0 }, quantity: 5 }), 5);
  });
});

describe("ammoNameScore / ammoNameMatches", () => {
  it("scores exact and plural highest", () => {
    assert.equal(ammoNameScore("Arrow", "Arrows"), 100);
    assert.equal(ammoNameScore("Bolt", "Bolts"), 100);
    assert.equal(ammoNameScore("Bolts", "Bolt"), 100);
    assert.equal(ammoNameMatches("Arrow", "Arrows"), true);
  });

  it("scores multi-word includes and prefix compounds", () => {
    assert.equal(ammoNameScore("Type A", "Type A Energy Cell"), 80);
    assert.equal(ammoNameScore("Hurlant", "Hurlant Bolts"), 60);
  });

  it("scores token match for renamed stacks without preferring compounds", () => {
    assert.equal(ammoNameScore("Arrow", "Silver Arrows"), 40);
    assert.equal(ammoNameMatches("Arrow", "Silver Arrows"), true);
    assert.equal(ammoNameScore("Bolt", "Hurlant Bolts"), 40);
    assert.equal(ammoNameMatches("Bolt", "Hurlant Bolts"), true);
  });

  it("returns 0 for unrelated names", () => {
    assert.equal(ammoNameScore("Bolt", "Arrows"), 0);
    assert.equal(ammoNameMatches("Bolt", "Arrows"), false);
  });
});

describe("magazineMax", () => {
  it("prefers maxValue then max+maxMod", () => {
    assert.equal(magazineMax({ charges: { max: 6, maxValue: 8 } }), 8);
    assert.equal(magazineMax({ charges: { max: 6, maxMod: 2 } }), 8);
  });
});

describe("resolveLinkedAmmo", () => {
  const items = [
    { id: "a1", type: "ammo", name: "Arrows", system: { charges: { value: 20, max: 20 } } },
    { id: "b1", type: "ammo", name: "Bolts", system: { charges: { value: 10, max: 10 } } },
    { id: "h1", type: "ammo", name: "Hurlant Bolts", system: { charges: { value: 5, max: 20 } } },
    { id: "s1", type: "ammo", name: "Silver Arrows", system: { charges: { value: 12, max: 20 } } },
    { id: "g1", type: "item", name: "Legacy Bolts", system: { charges: { value: 8, max: 10 } } },
  ];

  it("resolves by id among ammo", () => {
    assert.equal(resolveLinkedAmmo(items, { ammoId: "b1", ammoFallback: "Arrow" }).id, "b1");
  });

  it("resolves by id for legacy type item", () => {
    assert.equal(resolveLinkedAmmo(items, { ammoId: "g1", ammoFallback: "Bolt" }).id, "g1");
  });

  it("falls back by name score and prefers Bolts over Hurlant Bolts", () => {
    assert.equal(resolveLinkedAmmo(items, { ammoId: "", ammoFallback: "arrow" }).id, "a1");
    assert.equal(resolveLinkedAmmo(items, { ammoId: "", ammoFallback: "Bolt" }).id, "b1");
  });

  it("matches renamed stacks via token score when no exact plural", () => {
    const onlySilver = items.filter((i) => i.id === "s1" || i.id === "h1");
    assert.equal(resolveLinkedAmmo(onlySilver, { ammoFallback: "Arrow" }).id, "s1");
  });

  it("name fallback ignores gear type", () => {
    assert.equal(
      resolveLinkedAmmo(
        [{ id: "g1", type: "item", name: "Bolts", system: {} }],
        { ammoFallback: "Bolt" }
      ),
      null
    );
  });
});

describe("planAttackAmmoSpend", () => {
  it("none mode spends nothing", () => {
    const plan = planAttackAmmoSpend({ ammoMode: AMMO_MODES.none }, null);
    assert.equal(plan.ok, true);
    assert.equal(plan.cost, 0);
  });

  it("magazine spends weapon charges; burst costs 3", () => {
    const ok = planAttackAmmoSpend(
      { ammoMode: AMMO_MODES.magazine, charges: { value: 5, max: 6 } },
      null,
      { burst: true }
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.updates[0].data["system.charges.value"], 2);

    const fail = planAttackAmmoSpend(
      { ammoMode: AMMO_MODES.magazine, charges: { value: 2, max: 6 } },
      null,
      { burst: true }
    );
    assert.equal(fail.ok, false);
  });

  it("linked spends ammo charges", () => {
    const ammo = { id: "a1", system: { charges: { value: 20, max: 20 } } };
    const plan = planAttackAmmoSpend({ ammoMode: AMMO_MODES.linked }, ammo);
    assert.equal(plan.ok, true);
    assert.equal(plan.path, "linked-charges");
    assert.equal(plan.updates[0].data["system.charges.value"], 19);
  });
});

describe("planReload", () => {
  it("transfers from charge-stack ammo into magazine up to maxValue", () => {
    const weapon = {
      ammoMode: AMMO_MODES.magazine,
      charges: { value: 1, max: 6, maxValue: 8 },
    };
    const ammo = { id: "a1", system: { charges: { value: 10, max: 20 } } };
    const plan = planReload(weapon, ammo);
    assert.equal(plan.ok, true);
    assert.equal(plan.transferred, 7);
    assert.equal(plan.updates[0].data["system.charges.value"], 8);
    assert.equal(plan.updates[1].data["system.charges.value"], 3);
  });

  it("quantity energy cell spends one unit to fill magazine", () => {
    const weapon = {
      ammoMode: AMMO_MODES.magazine,
      charges: { value: 2, max: 10, maxValue: 10 },
    };
    const ammo = { id: "c1", system: { charges: { value: 0, max: 0 }, quantity: 3 } };
    const plan = planReload(weapon, ammo);
    assert.equal(plan.ok, true);
    assert.equal(plan.updates[0].data["system.charges.value"], 10);
    assert.equal(plan.updates[1].data["system.quantity"], 2);
  });

  it("rejects non-magazine modes", () => {
    assert.equal(planReload({ ammoMode: AMMO_MODES.linked }, null).ok, false);
  });
});

describe("planExpendGear", () => {
  it("skips when expendOnUse is false", () => {
    assert.equal(planExpendGear({ expendOnUse: false, charges: { value: 1, max: 1 } }).skipped, true);
  });

  it("decrements charges when expendOnUse", () => {
    const plan = planExpendGear({ expendOnUse: true, charges: { value: 3, max: 3 } });
    assert.equal(plan.ok, true);
    assert.equal(plan.updates[0].data["system.charges.value"], 2);
  });
});

describe("mapWeaponAmmoMigration / repairWwnWeaponAmmo", () => {
  it("maps decrementOnAttack to magazine", () => {
    const m = mapWeaponAmmoMigration({
      charges: { value: 3, max: 6, decrementOnAttack: true },
      ammo: "Bullet",
    });
    assert.equal(m.ammoMode, AMMO_MODES.magazine);
    assert.equal(m.ammoFallback, "Bullet");
    assert.equal(m.charges.decrementOnAttack, undefined);
  });

  it("maps legacy ammo string to linked", () => {
    const m = mapWeaponAmmoMigration({ ammo: "Arrow", charges: { value: 0, max: 0 } });
    assert.equal(m.ammoMode, AMMO_MODES.linked);
    assert.equal(m.ammoFallback, "Arrow");
  });

  it("repairWwnWeaponAmmo patches already-new weapons", () => {
    const patch = repairWwnWeaponAmmo({
      skillId: "",
      ammoId: "",
      charges: { value: 0, max: 0, decrementOnAttack: true },
      ammo: "Shell",
    });
    assert.equal(patch.ammoMode, AMMO_MODES.magazine);
    assert.equal(patch.ammoFallback, "Shell");
  });

  it("migrateItemData repairs weapon ammo on skillId weapons", () => {
    const out = migrateItemData({
      _id: "w1",
      name: "Gun",
      type: "weapon",
      system: {
        skillId: "",
        skillFallback: "shoot",
        ammoId: "",
        charges: { value: 2, max: 6, decrementOnAttack: true },
        counter: { value: 1, max: 1 },
      },
    });
    assert.equal(out.system.ammoMode, AMMO_MODES.magazine);
    assert.equal(out.system.charges.max, 6);
  });
});

describe("migrateGearToAmmo", () => {
  it("converts known Arrows gear to ammo type", () => {
    const gear = {
      _id: "QyEzGefuNXB83shT",
      name: "Arrows",
      type: "item",
      system: {
        price: 2,
        weight: 1,
        quantity: 1,
        charges: { value: 20, max: 20 },
        treasure: false,
        expendOnUse: false,
        roll: "",
        container: { isContainer: false },
      },
    };
    assert.equal(isKnownAmmoItem(gear), true);
    const out = migrateItemData(gear);
    assert.equal(out.type, "ammo");
    assert.equal(out.system.charges.max, 20);
    assert.equal(out.system.treasure, undefined);
  });

  it("converts weapon-linked gear via migrateActorItems", () => {
    const items = [
      {
        _id: "w1",
        name: "Laser",
        type: "weapon",
        system: { ammoMode: "magazine", ammoFallback: "Type A", ammoId: "", charges: { value: 5, max: 10 } },
      },
      {
        _id: "c1",
        name: "My Type A Pack",
        type: "item",
        system: { quantity: 4, charges: { value: 0, max: 0 }, price: 10, weight: 0.25 },
      },
    ];
    const out = migrateActorItems(items);
    const cell = out.find((i) => i._id === "c1");
    assert.equal(cell.type, "ammo");
  });

  it("migrateGearToAmmo drops gear-only fields", () => {
    const out = migrateGearToAmmo({
      _id: "x",
      name: "Bolts",
      type: "item",
      system: {
        treasure: true,
        expendOnUse: true,
        roll: "1d6",
        container: { isContainer: true },
        charges: { value: 5, max: 10 },
        quantity: 1,
        price: 1,
        weight: 1,
      },
    });
    assert.equal(out.type, "ammo");
    assert.equal(out.system.treasure, undefined);
    assert.equal(out.system.expendOnUse, undefined);
    assert.equal(out.system.charges.max, 10);
  });

  it("backfills firearm on known hurlants", () => {
    const hurlant = {
      _id: "eoum0sXFmbTP5WCk",
      name: "Hurlant, Hand",
      type: "weapon",
      system: {
        skillId: "",
        ammoFallback: "Hurlant",
        ammoMode: "linked",
        firearm: false,
        shock: { damage: "1d6", ac: 15 },
        charges: { value: 1, max: 1 },
      },
    };
    assert.equal(isKnownFirearmWeapon(hurlant), true);
    assert.deepEqual(repairWwnWeaponFirearm(hurlant), { firearm: true });
    const out = migrateItemData(hurlant);
    assert.equal(out?.system?.firearm, true);
  });

  it("defaults omitted stowed to false on gear→ammo", () => {
    const out = migrateGearToAmmo({
      _id: "x",
      name: "Arrows",
      type: "item",
      system: { charges: { value: 20, max: 20 }, quantity: 1 },
    });
    assert.equal(out.system.stowed, false);
  });

  it("backfills tl on medium/heavy and magical on +N armor", () => {
    const plate = {
      _id: "p1",
      name: "Great Armor",
      type: "armor",
      system: { ac: 18, acRanged: 18, type: "heavy", tl: 0, magical: false },
    };
    assert.deepEqual(repairWwnArmorTlMagical(plate), { tl: 3 });
    const buff = {
      _id: "b1",
      name: "Buff Coat +1",
      type: "armor",
      system: { ac: 12, acRanged: 12, type: "light", tl: 0, magical: false },
      flags: { core: { sourceId: "Compendium.wwn.magic-items.jkHznizd2Qm6DoZG" } },
    };
    assert.deepEqual(repairWwnArmorTlMagical(buff), { tl: 1, magical: true });
    const migrated = migrateItemData(buff);
    assert.equal(migrated?.system?.tl, 1);
    assert.equal(migrated?.system?.magical, true);
  });
});
