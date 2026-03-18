/**
 * TypeDataModel for WWN ship fitting items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnFittingDataModel =
  TypeDataModel && fields
    ? class WwnFittingDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.HTMLField({ initial: "" }),
            cost: new fields.StringField({ initial: "1%" }),
            cargo: new fields.NumberField({ min: 0, initial: 0 }),
            effect: new fields.StringField({ initial: "" }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
