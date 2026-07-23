import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Modular power armor fitting.
 */
export default class WwnArmorFitting extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.tl = new fields.NumberField({ ...requiredInteger, min: 0, initial: 3 });
    schema.mass = new fields.NumberField({ required: true, nullable: false, initial: 0 });
    schema.power = new fields.NumberField({ required: true, nullable: false, initial: 0 });
    schema.cost = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 });
    schema.stackable = new fields.BooleanField({ initial: false });
    schema.disabled = new fields.BooleanField({ initial: false });
    schema.integral = new fields.BooleanField({ initial: false });
    schema.effectId = new fields.StringField({ required: true, blank: true, initial: "" });
    /** Optional mount slot link for weapons transferred onto weapon mounts. */
    schema.mountWeaponId = new fields.StringField({ required: true, blank: true, initial: "" });

    /** Chat / activation: damage formula and optional save id (e.g. "evasion"). */
    schema.damageRoll = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.save = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.healing = new fields.BooleanField({ initial: false });

    /**
     * When true, this fitting rolls as a melee weapon (e.g. Integral Ripper Bar)
     * using damageRoll + weaponBonus / shock / trauma fields.
     */
    schema.isWeapon = new fields.BooleanField({ initial: false });
    schema.weaponBonus = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.melee = new fields.BooleanField({ initial: true });
    schema.missile = new fields.BooleanField({ initial: false });
    schema.score = new fields.StringField({ required: true, blank: true, initial: "str" });
    schema.linkedSkill = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.shock = new fields.SchemaField({
      damage: new fields.StringField({ required: true, blank: true, initial: "" }),
      ac: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });
    schema.trauma = new fields.SchemaField({
      die: new fields.StringField({ required: true, blank: true, initial: "" }),
      rating: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    return schema;
  }
}
