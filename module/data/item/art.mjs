/**
 * TypeDataModel for WWN art (psychic power) items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnArtDataModel =
  TypeDataModel && fields
    ? class WwnArtDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            pattern: new fields.StringField({ initial: "white" }),
            roll: new fields.StringField({ initial: "" }),
            rollType: new fields.StringField({ initial: "result" }),
            rollTarget: new fields.NumberField({ initial: 0 }),
            blindroll: new fields.BooleanField({ initial: false }),
            containerId: new fields.StringField({ initial: "" }),
            description: new fields.HTMLField({ initial: "" }),
            save: new fields.StringField({ initial: "" }),
            source: new fields.StringField({ initial: "High Mage" }),
            effort: new fields.NumberField({ min: 0, initial: 0 }),
            time: new fields.StringField({ initial: "Scene" }),
            range: new fields.StringField({ initial: "" }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
