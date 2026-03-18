/**
 * TypeDataModel for WWN skill items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnSkillDataModel =
  TypeDataModel && fields
    ? class WwnSkillDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.HTMLField({ initial: "" }),
            ownedLevel: new fields.NumberField({ initial: -1 }),
            score: new fields.StringField({ initial: "int" }),
            skillDice: new fields.StringField({ initial: "2d6" }),
            secondary: new fields.BooleanField({ initial: false }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
