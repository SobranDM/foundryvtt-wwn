/**
 * TypeDataModel for WWN weapon items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnWeaponDataModel =
  TypeDataModel && fields
    ? class WwnWeaponDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            range: new fields.SchemaField({
              short: new fields.NumberField({ min: 0, initial: 0 }),
              medium: new fields.NumberField({ min: 0, initial: 0 }),
              long: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            save: new fields.StringField({ initial: "" }),
            pattern: new fields.StringField({ initial: "transparent" }),
            description: new fields.HTMLField({ initial: "" }),
            damage: new fields.StringField({ initial: "1d6" }),
            bonus: new fields.NumberField({ initial: 0 }),
            containerId: new fields.StringField({ initial: "" }),
            skillDamage: new fields.BooleanField({ initial: false }),
            shock: new fields.SchemaField({
              damage: new fields.StringField({ initial: "1" }),
              ac: new fields.StringField({ initial: "15" }),
            }),
            trauma: new fields.SchemaField({
              die: new fields.StringField({ initial: "1d6" }),
              rating: new fields.NumberField({ initial: 2 }),
            }),
            shockTotal: new fields.NumberField({ initial: 0 }),
            skill: new fields.StringField({ initial: "stab" }),
            score: new fields.StringField({ initial: "str" }),
            tags: new fields.ArrayField(new fields.StringField(), { initial: [] }),
            slow: new fields.BooleanField({ initial: false }),
            missile: new fields.BooleanField({ initial: false }),
            melee: new fields.BooleanField({ initial: true }),
            burst: new fields.BooleanField({ initial: false }),
            price: new fields.NumberField({ min: 0, initial: 0 }),
            weight: new fields.NumberField({ min: 0, initial: 0 }),
            counter: new fields.SchemaField({
              value: new fields.NumberField({ min: 0, initial: 0 }),
              max: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            quantity: new fields.NumberField({ min: 0, initial: 1 }),
            charges: new fields.SchemaField({
              value: new fields.NumberField({ min: 0, initial: 0 }),
              max: new fields.NumberField({ min: 0, initial: 0 }),
              decrementOnAttack: new fields.BooleanField({ initial: false }),
            }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
