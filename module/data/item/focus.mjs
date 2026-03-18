/**
 * TypeDataModel for WWN focus items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnFocusDataModel =
  TypeDataModel && fields
    ? class WwnFocusDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.HTMLField({ initial: "" }),
            ownedLevel: new fields.NumberField({ min: 0, initial: 1 }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
