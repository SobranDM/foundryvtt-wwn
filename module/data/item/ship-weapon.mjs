import WwnShipEquipment from "./ship-equipment.mjs";

const fields = foundry.data.fields;

/**
 * A ship weapon with combat, hardpoint, and ammunition data.
 */
export default class WwnShipWeapon extends WwnShipEquipment {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.damage = new fields.StringField({ required: true, blank: true });
    schema.hardpoints = new fields.NumberField({ ...requiredInteger, min: 0, initial: 1 });
    schema.tl = new fields.NumberField({ ...requiredInteger, initial: 4 });
    schema.qualities = new fields.StringField({ required: true, blank: true });
    schema.ammo = new fields.NumberField({ required: true, nullable: true, integer: true, initial: null });
    schema.ammoCost = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 });
    schema.attackBonus = new fields.NumberField({ ...requiredInteger, initial: 0 });

    return schema;
  }
}
