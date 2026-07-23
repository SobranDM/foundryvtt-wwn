import WwnItemBase from "./base.mjs";
import { PhysicalDataMixin } from "../mixins/physical.mjs";

const fields = foundry.data.fields;

/**
 * Generic gear (item type "item"): ported from WWN `item`.
 */
export default class WwnGear extends PhysicalDataMixin(WwnItemBase) {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.treasure = new fields.BooleanField({ initial: false });
    schema.personal = new fields.BooleanField({ initial: false });
    schema.charges = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });
    schema.expendOnUse = new fields.BooleanField({ initial: false });
    schema.roll = new fields.StringField({ required: true, blank: true });
    schema.container = new fields.SchemaField({
      isContainer: new fields.BooleanField({ initial: false }),
      isOpen: new fields.BooleanField({ initial: true }),
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
