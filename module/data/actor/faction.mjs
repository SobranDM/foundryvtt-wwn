/**
 * TypeDataModel for WWN faction actors.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnFactionDataModel =
  TypeDataModel && fields
    ? class WwnFactionDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.StringField({ initial: "" }),
            health: new fields.SchemaField({
              value: new fields.NumberField({ min: 0, initial: 7 }),
              max: new fields.NumberField({ min: 0, initial: 7 }),
            }),
            forceRating: new fields.NumberField({ min: 0, initial: 1 }),
            cunningRating: new fields.NumberField({ min: 0, initial: 1 }),
            wealthRating: new fields.NumberField({ min: 0, initial: 1 }),
            magicRating: new fields.StringField({ initial: "None" }),
            facCreds: new fields.NumberField({ min: 0, initial: 0 }),
            xp: new fields.NumberField({ min: 0, initial: 0 }),
            homeworld: new fields.StringField({ initial: "" }),
            active: new fields.BooleanField({ initial: true }),
            factionGoal: new fields.StringField({ initial: "" }),
            factionGoalDesc: new fields.StringField({ initial: "" }),
            tags: new fields.ArrayField(new fields.StringField(), { initial: [] }),
            log: new fields.ArrayField(new fields.ObjectField(), { initial: [] }),
            initiative: new fields.SchemaField({
              roll: new fields.StringField({ initial: "1d8" }),
              value: new fields.NumberField({ initial: 0 }),
            }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
