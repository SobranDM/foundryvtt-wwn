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
} from "../module/helpers/ammo.mjs";
import { repairWwnWeaponAmmo, migrateItemData } from "../module/migration/transforms.mjs";
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

describe("magazineMax", () => {
  it("prefers maxValue then max+maxMod", () => {
    assert.equal(magazineMax({ charges: { max: 6, maxValue: 8 } }), 8);
    assert.equal(magazineMax({ charges: { max: 6, maxMod: 2 } }), 8);
  });
});

describe("resolveLinkedAmmo", () => {
  const items = [
    { id: "a1", type: "item", name: "Arrows", system: { charges: { value: 20, max: 20 } } },
    { id: "b1", type: "item", name: "Bolts", system: { charges: { value: 10, max: 10 } } },
  ];

  it("resolves by id first", () => {
    assert.equal(resolveLinkedAmmo(items, { ammoId: "b1", ammoFallback: "Arrow" }).id, "b1");
  });

  it("falls back to name includes", () => {
    assert.equal(resolveLinkedAmmo(items, { ammoId: "", ammoFallback: "arrow" }).id, "a1");
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
  it("transfers from linked ammo into magazine up to maxValue", () => {
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
