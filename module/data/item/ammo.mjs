import WwnItemBase from "./base.mjs";
import { PhysicalDataMixin } from "../mixins/physical.mjs";

const fields = foundry.data.fields;

/**
 * Dedicated ammo (arrows, bolts, energy cells, spare magazines).
 * Stack encoding: charges.max > 0 → spend/reload from charges; else quantity.
 */
export default class WwnAmmo extends PhysicalDataMixin(WwnItemBase) {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.charges = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    return schema;
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    this.charges ??= {};
    this.charges.maxMod = 0;
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.parent?.applyItemActiveEffects?.("final");
    this.charges.maxValue = (this.charges?.max ?? 0) + (this.charges?.maxMod ?? 0);
  }
}
