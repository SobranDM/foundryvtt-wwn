/**
 * Example TypeDataModel schema for WWN actors.
 * Not registered by default; used as reference when implementing Phase 7 data models.
 * @see module/data/README.md
 *
 * Only defined when foundry.abstract.TypeDataModel exists (e.g. in Foundry runtime).
 */
const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const ExampleActorDataModel =
  TypeDataModel && fields
    ? class ExampleActorDataModel extends TypeDataModel {
      static defineSchema() {
        return {
          encumbranceMax: new fields.NumberField({ min: 0, initial: 0 }),
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

      prepareDerivedData() {
        // Example: computed encumbrance could be moved here when full schema exists.
      }
    }
    : null;
