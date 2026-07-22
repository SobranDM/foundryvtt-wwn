import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Skill item. `slug` exposes the skill in roll data (@exert, @know, ...).
 */
export default class WwnSkill extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.ownedLevel = new fields.NumberField({ ...requiredInteger, initial: -1, min: -1 });
    schema.score = new fields.StringField({ required: true, initial: "int" });
    schema.skillDice = new fields.StringField({ required: true, initial: "2d6" });
    schema.secondary = new fields.BooleanField({ initial: false });
    schema.slug = new fields.StringField({ required: true, blank: true });
    schema.pointsInvested = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    if (!this.slug) {
      this.slug = this.parent.name.slugify({ strict: true }).replace(/-/g, "");
    }
  }
}
