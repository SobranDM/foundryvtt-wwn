import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Shared data schema for ship fittings, weapons, and defenses.
 */
export default class WwnShipEquipment extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.cost = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 });
    schema.power = new fields.NumberField({ required: true, nullable: false, initial: 0 });
    schema.mass = new fields.NumberField({ required: true, nullable: false, initial: 0 });
    schema.minClass = new fields.StringField({
      required: true,
      choices: ["fighter", "frigate", "cruiser", "capital"],
      initial: "fighter",
    });
    schema.costScales = new fields.BooleanField({ initial: false });
    schema.powerScales = new fields.BooleanField({ initial: false });
    schema.massScales = new fields.BooleanField({ initial: false });
    schema.disabled = new fields.BooleanField({ initial: false });
    schema.specialCost = new fields.BooleanField({ initial: false });

    return schema;
  }
}
