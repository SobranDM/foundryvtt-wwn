import assert from "node:assert/strict";
import test from "node:test";

class TestField {
  constructor(options = {}) {
    this.options = options;
  }
}

globalThis.foundry = {
  abstract: {
    DataModel: class DataModel {
      static defineSchema() {
        return {};
      }
    },
    TypeDataModel: class TypeDataModel {
      static defineSchema() {
        return {};
      }
    },
  },
  data: {
    fields: {
      NumberField: TestField,
      StringField: TestField,
      BooleanField: TestField,
      HTMLField: TestField,
    },
  },
};

const { default: WwnShipFitting } = await import("../module/data/item/ship-fitting.mjs");
const { default: WwnShipWeapon } = await import("../module/data/item/ship-weapon.mjs");
const { default: WwnShipDefense } = await import("../module/data/item/ship-defense.mjs");

test("ship fittings and defenses share the equipment schema", () => {
  for (const Model of [WwnShipFitting, WwnShipDefense]) {
    const schema = Model.defineSchema();

    assert.deepEqual(schema.cost.options, { required: true, nullable: false, integer: true, min: 0, initial: 0 });
    assert.deepEqual(schema.power.options, { required: true, nullable: false, initial: 0 });
    assert.deepEqual(schema.mass.options, { required: true, nullable: false, initial: 0 });
    assert.deepEqual(schema.minClass.options, {
      required: true,
      choices: ["fighter", "frigate", "cruiser", "capital"],
      initial: "fighter",
    });
    assert.equal(schema.costScales.options.initial, false);
    assert.equal(schema.powerScales.options.initial, false);
    assert.equal(schema.massScales.options.initial, false);
    assert.equal(schema.disabled.options.initial, false);
    assert.equal(schema.specialCost.options.initial, false);
  }
});

test("ship weapons add their combat and ammunition schema", () => {
  const schema = WwnShipWeapon.defineSchema();

  assert.deepEqual(schema.damage.options, { required: true, blank: true });
  assert.deepEqual(schema.hardpoints.options, { required: true, nullable: false, integer: true, min: 0, initial: 1 });
  assert.deepEqual(schema.tl.options, { required: true, nullable: false, integer: true, initial: 4 });
  assert.deepEqual(schema.qualities.options, { required: true, blank: true });
  assert.deepEqual(schema.ammo.options, { required: true, nullable: true, integer: true, initial: null });
  assert.deepEqual(schema.ammoCost.options, { required: true, nullable: false, integer: true, min: 0, initial: 0 });
  assert.deepEqual(schema.attackBonus.options, { required: true, nullable: false, integer: true, initial: 0 });
});
