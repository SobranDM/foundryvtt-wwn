/**
 * TypeDataModel for WWN character actors.
 * Registered as CONFIG.Actor.dataModels["character"] when Foundry provides TypeDataModel.
 * @see module/data/README.md
 */
import { getCommonSchema, getSpellcasterSchema, scoreSchema } from "./schemas.mjs";

const TypeDataModel = typeof foundry !== "undefined" && foundry.abstract?.TypeDataModel;
const fields = typeof foundry !== "undefined" && foundry.data?.fields;

export const WwnCharacterDataModel =
  TypeDataModel && fields
    ? class WwnCharacterDataModel extends TypeDataModel {
        static defineSchema() {
          const scores = {};
          for (const ab of ["str", "int", "wis", "dex", "con", "cha"]) {
            scores[ab] = new fields.SchemaField(scoreSchema(fields));
          }
          return {
            ...getCommonSchema(fields),
            ...getSpellcasterSchema(fields),
            character: new fields.BooleanField({ initial: true }),
            warrior: new fields.BooleanField({ initial: false }),
            damageBonus: new fields.NumberField({ initial: 0 }),
            treasure: new fields.NumberField({ min: 0, initial: 0 }),
            personalTreasure: new fields.NumberField({ min: 0, initial: 0 }),
            hp: new fields.SchemaField({
              hd: new fields.StringField({ initial: "1d6" }),
              value: new fields.NumberField({ min: 0, initial: 4 }),
              max: new fields.NumberField({ min: 0, initial: 4 }),
              injuries: new fields.NumberField({ min: 0, initial: 0 }),
              wounds: new fields.NumberField({ min: 0, initial: 0 }),
            }),
            scores: new fields.SchemaField(scores),
            details: new fields.SchemaField({
              biography: new fields.StringField({ initial: "" }),
              notes: new fields.StringField({ initial: "" }),
              class: new fields.StringField({ initial: "" }),
              background: new fields.StringField({ initial: "" }),
              alignment: new fields.StringField({ initial: "" }),
              morale: new fields.NumberField({ initial: 0 }),
              level: new fields.NumberField({ min: 0, initial: 1 }),
              xp: new fields.SchemaField({
                share: new fields.NumberField({ min: 0, initial: 100 }),
                next: new fields.NumberField({ min: 0, initial: 3 }),
                value: new fields.NumberField({ min: 0, initial: 0 }),
                bonus: new fields.NumberField({ initial: 0 }),
              }),
              strain: new fields.SchemaField({ value: new fields.NumberField({ min: 0, initial: 0 }), max: new fields.NumberField({ min: 0, initial: 10 }) }),
              renown: new fields.SchemaField({ value: new fields.NumberField({ min: 0, initial: 0 }), spent: new fields.NumberField({ min: 0, initial: 0 }), total: new fields.NumberField({ min: 0, initial: 0 }) }),
              resources: new fields.SchemaField({ rations: new fields.NumberField({ min: 0, initial: 0 }), torches: new fields.NumberField({ min: 0, initial: 0 }), oil: new fields.NumberField({ min: 0, initial: 0 }) }),
            }),
            skills: new fields.SchemaField({
              unspent: new fields.NumberField({ min: 0, initial: 0 }),
              exertPenalty: new fields.NumberField({ initial: 0 }),
              sneakPenalty: new fields.NumberField({ initial: 0 }),
            }),
            encumbrance: new fields.SchemaField({
              readied: new fields.SchemaField({ value: new fields.NumberField({ min: 0, initial: 0 }), max: new fields.NumberField({ min: 0, initial: 5 }) }),
              stowed: new fields.SchemaField({ value: new fields.NumberField({ min: 0, initial: 0 }), max: new fields.NumberField({ min: 0, initial: 10 }) }),
            }),
            languages: new fields.SchemaField({ value: new fields.ArrayField(new fields.StringField(), { initial: [] }) }),
            config: new fields.SchemaField({
              movementAuto: new fields.BooleanField({ initial: true }),
              skillsEditMode: new fields.BooleanField({ initial: false }),
            }),
          };
        }

        prepareDerivedData() {
          // Computed values (e.g. from module/actor/types/character.mjs) can be moved here over time.
        }
      }
    : null;
