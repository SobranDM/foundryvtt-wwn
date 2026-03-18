/**
 * TypeDataModel for WWN ability items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnAbilityDataModel =
  TypeDataModel && fields
    ? class WwnAbilityDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.HTMLField({ initial: "" }),
            roll: new fields.StringField({ initial: "" }),
            rollType: new fields.StringField({ initial: "result" }),
            rollTarget: new fields.NumberField({ initial: 0 }),
            blindroll: new fields.BooleanField({ initial: false }),
            save: new fields.StringField({ initial: "" }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
