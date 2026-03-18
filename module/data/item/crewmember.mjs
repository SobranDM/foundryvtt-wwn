/**
 * TypeDataModel for WWN crewmember items (ship crew).
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnCrewmemberDataModel =
  TypeDataModel && fields
    ? class WwnCrewmemberDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            cost: new fields.NumberField({ min: 0, initial: 0 }),
            description: new fields.HTMLField({ initial: "" }),
            quantity: new fields.NumberField({ min: 0, initial: 0 }),
            strength: new fields.NumberField({ min: 0, initial: 0 }),
            ispc: new fields.BooleanField({ initial: false }),
            isrower: new fields.BooleanField({ initial: false }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
