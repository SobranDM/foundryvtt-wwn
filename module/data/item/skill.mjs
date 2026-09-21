import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Skill item. Roll data keys (@exert, @know, …) come from the item name.
 */
export default class WwnSkill extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.ownedLevel = new fields.NumberField({ ...requiredInteger, initial: -1, min: -1 });
    schema.score = new fields.StringField({ required: true, initial: "int" });
    schema.secondary = new fields.BooleanField({ initial: false });
    schema.pointsInvested = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }
}
