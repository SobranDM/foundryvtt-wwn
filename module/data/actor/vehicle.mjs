/**
 * TypeDataModel for WWN vehicle actors.
 * @see module/data/README.md
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnVehicleDataModel =
  TypeDataModel && fields
    ? class WwnVehicleDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            details: new fields.ObjectField({ initial: {} }),
            encumbranceMax: new fields.NumberField({ nullable: true, initial: null }),
            encumbrance: new fields.SchemaField({
              value: new fields.NumberField({ min: 0, initial: 0 }),
              max: new fields.NumberField({ nullable: true, initial: null }),
            }),
            currency: new fields.SchemaField({
              cp: new fields.NumberField({ min: 0, initial: 0 }),
              sp: new fields.NumberField({ min: 0, initial: 0 }),
              ep: new fields.NumberField({ min: 0, initial: 0 }),
              gp: new fields.NumberField({ min: 0, initial: 0 }),
              pp: new fields.NumberField({ min: 0, initial: 0 }),
              bank: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            treasure: new fields.NumberField({ min: 0, initial: 0 }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
