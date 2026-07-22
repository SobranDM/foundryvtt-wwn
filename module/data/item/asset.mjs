import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Faction asset item data model (ported from WWN `asset`).
 *
 * Assets belong to `faction` actors and carry a Force/Cunning/Wealth type,
 * hit points, purchase/maintenance economics, and attack/counter stats.
 */
export default class WwnAsset extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.desc = new fields.HTMLField({ required: true, blank: true });

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 1 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 1 }),
    });

    schema.cost = new fields.NumberField({ ...requiredInteger, initial: 1 });
    schema.rating = new fields.NumberField({ ...requiredInteger, initial: 1 });
    schema.baseOfInfluence = new fields.BooleanField({ initial: false });

    schema.attackTarget = new fields.StringField({ required: true, blank: true });
    schema.attackSource = new fields.StringField({ required: true, blank: true });
    schema.attackDamage = new fields.StringField({ required: true, blank: true });
    schema.counter = new fields.StringField({ required: true, blank: true });
    schema.note = new fields.StringField({ required: true, blank: true });
    schema.turnRoll = new fields.StringField({ required: true, blank: true });

    schema.assetType = new fields.StringField({ required: true, initial: "cunning" });
    schema.location = new fields.StringField({ required: true, blank: true });
    schema.locationRoll = new fields.StringField({ required: true, blank: true });

    schema.maintenance = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.income = new fields.NumberField({ ...requiredInteger, initial: 0 });

    schema.unusable = new fields.BooleanField({ initial: false });
    schema.stealthed = new fields.BooleanField({ initial: false });
    schema.subtle = new fields.BooleanField({ initial: false });
    schema.special = new fields.BooleanField({ initial: false });

    schema.magic = new fields.StringField({ required: true, initial: "none" });

    return schema;
  }
}
