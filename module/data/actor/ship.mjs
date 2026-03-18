/**
 * TypeDataModel for WWN ship actors.
 * @see module/data/README.md
 */
import { getCommonSchema } from "./schemas.mjs";

const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnShipDataModel =
  TypeDataModel && fields
    ? class WwnShipDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            ...getCommonSchema(fields),
            character: new fields.BooleanField({ initial: true }),
            warrior: new fields.BooleanField({ initial: false }),
            hp: new fields.SchemaField({
              hd: new fields.StringField({ initial: "1d6" }),
              value: new fields.NumberField({ min: 0, initial: 4 }),
              max: new fields.NumberField({ min: 0, initial: 4 }),
              injuries: new fields.NumberField({ min: 0, initial: 0 }),
              wounds: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            treasure: new fields.NumberField({ min: 0, initial: 0 }),
            personalTreasure: new fields.NumberField({ min: 0, initial: 0 }),
            cargo: new fields.SchemaField({
              max: new fields.NumberField({ min: 0, initial: 10 }),
              value: new fields.NumberField({ min: 0, initial: 0 }),
              monetaryvalue: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            weapons: new fields.SchemaField({
              max: new fields.NumberField({ min: 0, initial: 1 }),
              value: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            config: new fields.SchemaField({
              movementAuto: new fields.BooleanField({ initial: true }),
            }),
            details: new fields.SchemaField({
              biography: new fields.StringField({ initial: "" }),
              notes: new fields.StringField({ initial: "" }),
              size: new fields.StringField({ initial: "" }),
              cost: new fields.StringField({ initial: "" }),
              type: new fields.StringField({ initial: "" }),
              morale: new fields.NumberField({ initial: 0 }),
              flight: new fields.BooleanField({ initial: false }),
              grace: new fields.SchemaField({
                value: new fields.NumberField({ initial: 1 }),
                tweak: new fields.NumberField({ initial: 0 }),
              }),
              crew: new fields.SchemaField({
                current: new fields.NumberField({ min: 0, initial: 0 }),
                min: new fields.NumberField({ min: 0, initial: 1 }),
                max: new fields.NumberField({ min: 0, initial: 10 }),
                rowers: new fields.NumberField({ min: 0, initial: 0 }),
                totalstrength: new fields.NumberField({ min: 0, initial: 0 }),
                pcstrength: new fields.NumberField({ min: 0, initial: 0 }),
                totalcost: new fields.NumberField({ min: 0, initial: 0 }),
              }),
            }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
