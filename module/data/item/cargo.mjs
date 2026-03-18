/**
 * TypeDataModel for WWN cargo items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnCargoDataModel =
  TypeDataModel && fields
    ? class WwnCargoDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.HTMLField({ initial: "" }),
            quantity: new fields.NumberField({ min: 0, initial: 1 }),
            treasure: new fields.BooleanField({ initial: false }),
            personal: new fields.BooleanField({ initial: false }),
            cargo: new fields.BooleanField({ initial: true }),
            price: new fields.NumberField({ min: 0, initial: 0 }),
            weight: new fields.NumberField({ min: 0, initial: 1 }),
            roll: new fields.StringField({ initial: "" }),
            quality: new fields.StringField({ initial: "average" }),
            effects: new fields.SchemaField({
              active: new fields.BooleanField({ initial: false }),
              list: new fields.ArrayField(new fields.ObjectField(), { initial: [] }),
            }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
