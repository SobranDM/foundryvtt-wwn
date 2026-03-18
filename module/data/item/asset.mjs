/**
 * TypeDataModel for WWN asset (faction asset) items.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnAssetDataModel =
  TypeDataModel && fields
    ? class WwnAssetDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            desc: new fields.HTMLField({ initial: "" }),
            health: new fields.SchemaField({
              value: new fields.NumberField({ min: 0, initial: 1 }),
              max: new fields.NumberField({ min: 0, initial: 1 }),
            }),
            cost: new fields.NumberField({ min: 0, initial: 1 }),
            rating: new fields.NumberField({ min: 0, initial: 1 }),
            baseOfInfluence: new fields.BooleanField({ initial: false }),
            attackTarget: new fields.StringField({ initial: "" }),
            attackSource: new fields.StringField({ initial: "" }),
            attackDamage: new fields.StringField({ initial: "" }),
            counter: new fields.StringField({ initial: "" }),
            note: new fields.StringField({ initial: "" }),
            turnRoll: new fields.StringField({ initial: "" }),
            assetType: new fields.StringField({ initial: "cunning" }),
            location: new fields.StringField({ initial: "" }),
            maintenance: new fields.NumberField({ min: 0, initial: 0 }),
            income: new fields.NumberField({ min: 0, initial: 0 }),
            unusable: new fields.BooleanField({ initial: false }),
            stealthed: new fields.BooleanField({ initial: false }),
            magic: new fields.StringField({ initial: "none" }),
            subtle: new fields.BooleanField({ initial: false }),
            special: new fields.BooleanField({ initial: false }),
            locationRoll: new fields.StringField({ initial: "" }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
