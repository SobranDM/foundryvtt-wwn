import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Focus: WWN foci. Combat/stat modifiers use transferred Active Effects;
 * resource grants flow through derivations/focus-resources.mjs.
 */
export default class WwnFocus extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.ownedLevel = new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 });

    schema.resourceGrant = new fields.SchemaField({
      targetName: new fields.StringField({ required: true, blank: true }),
      targetSource: new fields.StringField({ required: true, blank: true }),
      bonusMax: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.internalResource = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.resourceLength = new fields.StringField({
      required: true,
      choices: ["none", "active", "scene", "day"],
      initial: "none",
    });

    schema.bonusSkills = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    schema.bonusSkillsPick = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.bonusSkillsChosen = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    schema.bonusDice = new fields.NumberField({ required: false, nullable: true, integer: true, min: 0, initial: null });
    schema.skillBonus = new fields.StringField({ required: true, blank: true, initial: "" });

    return schema;
  }
}
