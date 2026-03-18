/**
 * TypeDataModel for WWN spell items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnSpellDataModel =
  TypeDataModel && fields
    ? class WwnSpellDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            lvl: new fields.NumberField({ min: 0, initial: 1 }),
            class: new fields.StringField({ initial: "High Mage" }),
            duration: new fields.StringField({ initial: "" }),
            range: new fields.StringField({ initial: "" }),
            roll: new fields.StringField({ initial: "" }),
            description: new fields.HTMLField({ initial: "" }),
            prepared: new fields.BooleanField({ initial: false }),
            containerId: new fields.StringField({ initial: "" }),
            cast: new fields.NumberField({ min: 0, initial: 0 }),
            memorized: new fields.NumberField({ min: 0, initial: 0 }),
            save: new fields.StringField({ initial: "" }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
