import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Currency denomination. Replaces WWN's hardcoded currency object.
 * perSlot 0 = weightless (e.g. digital credits).
 */
export default class WwnCurrency extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.multiplier = new fields.NumberField({ required: true, nullable: false, initial: 1, min: 0 });
    schema.carried = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.banked = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.perSlot = new fields.NumberField({ ...requiredInteger, initial: 100, min: 0 });

    return schema;
  }
}
