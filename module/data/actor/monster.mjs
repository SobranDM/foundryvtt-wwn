/**
 * TypeDataModel for WWN monster actors.
 * @see module/data/README.md
 */
import { getCommonSchema, getSpellcasterSchema, safeNumberField } from "./schemas.mjs";

const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnMonsterDataModel =
  TypeDataModel && fields
    ? class WwnMonsterDataModel extends TypeDataModel {
        static defineSchema() {
          return {
            ...getCommonSchema(fields),
            ...getSpellcasterSchema(fields),
            character: new fields.BooleanField({ initial: false }),
            damageBonus: new fields.NumberField({ initial: 0 }),
            attacks: new fields.StringField({ initial: "" }),
            hp: new fields.SchemaField({
              hd: new fields.StringField({ initial: "1d8" }),
              value: new fields.NumberField({ min: 0, initial: 4 }),
              max: new fields.NumberField({ min: 0, initial: 4 }),
            }),
            details: new fields.SchemaField({
              biography: new fields.StringField({ initial: "" }),
              alignment: new fields.StringField({ initial: "" }),
              xp: new fields.NumberField({ min: 0, initial: 0 }),
              treasure: new fields.SchemaField({
                table: new fields.StringField({ initial: "" }),
                type: new fields.StringField({ initial: "" }),
              }),
              appearing: new fields.SchemaField({
                d: safeNumberField(fields, { min: 0, initial: 0 }),
                w: safeNumberField(fields, { min: 0, initial: 0 }),
              }),
              morale: new fields.NumberField({ initial: 0 }),
              instinct: new fields.NumberField({ initial: 0 }),
              instinctTable: new fields.SchemaField({
                table: new fields.StringField({ initial: "" }),
                link: new fields.StringField({ initial: "" }),
              }),
              skill: new fields.NumberField({ initial: 0 }),
            }),
          };
        }

        prepareDerivedData() {}
      }
    : null;
