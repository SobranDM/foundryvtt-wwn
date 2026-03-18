/**
 * TypeDataModel for WWN ship weapon items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnShipweaponDataModel =
  TypeDataModel && fields
    ? class WwnShipweaponDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            range: new fields.StringField({ initial: "Near" }),
            save: new fields.StringField({ initial: "" }),
            ship: new fields.BooleanField({ initial: true }),
            pattern: new fields.StringField({ initial: "transparent" }),
            description: new fields.HTMLField({ initial: "" }),
            damage: new fields.StringField({ initial: "1d6" }),
            bonus: new fields.NumberField({ initial: 0 }),
            containerId: new fields.StringField({ initial: "" }),
            skillDamage: new fields.BooleanField({ initial: false }),
            size: new fields.StringField({ initial: "small" }),
            price: new fields.NumberField({ min: 0, initial: 0 }),
            weight: new fields.NumberField({ min: 0, initial: 0 }),
            quantity: new fields.NumberField({ min: 0, initial: 1 }),
            crew: new fields.NumberField({ min: 0, initial: 0 }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
