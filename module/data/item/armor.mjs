/**
 * TypeDataModel for WWN armor items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnArmorDataModel =
  TypeDataModel && fields
    ? class WwnArmorDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.HTMLField({ initial: "" }),
            ac: new fields.NumberField({ initial: 9 }),
            aac: new fields.SchemaField({
              value: new fields.NumberField({ initial: 10 }),
              mod: new fields.NumberField({ initial: 0 }),
            }),
            traumaMod: new fields.NumberField({ initial: 0 }),
            armorBonus: new fields.NumberField({ initial: 0 }),
            type: new fields.StringField({ initial: "light" }),
            price: new fields.NumberField({ min: 0, initial: 0 }),
            weight: new fields.NumberField({ min: 0, initial: 0 }),
            ashesHeavy: new fields.BooleanField({ initial: false }),
            isShield: new fields.BooleanField({ initial: false }),
            containerId: new fields.StringField({ initial: "" }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
