/**
 * TypeDataModel for WWN generic "item" type.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnItemDataModel =
  TypeDataModel && fields
    ? class WwnItemDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            description: new fields.HTMLField({ initial: "" }),
            quantity: new fields.NumberField({ min: 0, initial: 1 }),
            treasure: new fields.BooleanField({ initial: false }),
            personal: new fields.BooleanField({ initial: false }),
            container: new fields.SchemaField({
              isContainer: new fields.BooleanField({ initial: false }),
              isOpen: new fields.BooleanField({ initial: false }),
            }),
            containerId: new fields.StringField({ initial: "" }),
            price: new fields.NumberField({ min: 0, initial: 0 }),
            weight: new fields.NumberField({ min: 0, initial: 0 }),
            weightless: new fields.StringField({ initial: "" }),
            charges: new fields.SchemaField({
              value: new fields.NumberField({ min: 0, initial: 0 }),
              max: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            roll: new fields.StringField({ initial: "" }),
            equipped: new fields.BooleanField({ initial: false }),
            stowed: new fields.BooleanField({ initial: false }),
            effects: new fields.SchemaField({
              active: new fields.BooleanField({ initial: false }),
              list: new fields.ArrayField(new fields.ObjectField(), { initial: [] }),
            }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
