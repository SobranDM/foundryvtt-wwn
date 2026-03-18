/**
 * Shared schema field definitions for WWN actor TypeDataModels.
 * Composed into character, monster, ship (common + optional spellcaster).
 *
 * SafeNumberField: coerces non-finite values (e.g. from dice strings like "1d6" or missing data) to initial
 * so existing world data validates.
 */
/**
 * Returns a NumberField that coerces non-finite values (NaN/Infinity) to initial.
 * Use for fields where legacy data may have dice strings (e.g. appearing.d/w) or missing values.
 */
export function safeNumberField(fields, options = {}) {
  const initial = options.initial ?? 0;
  class SafeNumberField extends fields.NumberField {
    _cleanType(value, opts) {
      const result = super._cleanType(value, opts);
      if (typeof result === "number" && !Number.isFinite(result)) return this.initial;
      return result;
    }
  }
  return new SafeNumberField({ ...options, initial });
}

function safeNumber(options = {}) {
  return (fields) => safeNumberField(fields, options);
}

export function getCommonSchema(fields) {
  const safe = (opts) => safeNumber(opts)(fields);
  return {
    retainer: new fields.SchemaField({
      enabled: new fields.BooleanField({ initial: false }),
      wage: new fields.StringField({ initial: "" }),
    }),
    ac: new fields.SchemaField({
      value: new fields.NumberField({ initial: 0 }),
      mod: new fields.NumberField({ initial: 0 }),
    }),
    aac: new fields.SchemaField({
      value: new fields.NumberField({ initial: 0 }),
      mod: new fields.NumberField({ initial: 0 }),
    }),
    thac0: new fields.SchemaField({
      value: new fields.NumberField({ initial: 19 }),
      bba: new fields.NumberField({ initial: 0 }),
      mod: new fields.SchemaField({
        missile: new fields.NumberField({ initial: 0 }),
        melee: new fields.NumberField({ initial: 0 }),
      }),
    }),
    trauma: new fields.SchemaField({
      value: new fields.NumberField({ initial: 6 }),
      bonus: new fields.NumberField({ initial: 0 }),
      targetBonus: new fields.NumberField({ initial: 0 }),
    }),
    saves: new fields.SchemaField({
      evasion: new fields.SchemaField({ value: new fields.NumberField({ initial: 0 }), mod: new fields.NumberField({ initial: 0 }) }),
      mental: new fields.SchemaField({ value: new fields.NumberField({ initial: 0 }), mod: new fields.NumberField({ initial: 0 }) }),
      physical: new fields.SchemaField({ value: new fields.NumberField({ initial: 0 }), mod: new fields.NumberField({ initial: 0 }) }),
      luck: new fields.SchemaField({ value: new fields.NumberField({ initial: 0 }), mod: new fields.NumberField({ initial: 0 }) }),
      baseSave: new fields.SchemaField({ value: new fields.NumberField({ nullable: true, initial: null }), mod: new fields.NumberField({ initial: 0 }) }),
    }),
    movement: new fields.SchemaField({
      base: safe({ initial: 30 }),
      exploration: safe({ initial: 90 }),
      overland: safe({ initial: 24 }),
      bonus: safe({ initial: 0 }),
    }),
    initiative: new fields.SchemaField({
      value: new fields.NumberField({ initial: 0 }),
      mod: new fields.NumberField({ initial: 0 }),
      roll: new fields.StringField({ initial: "1d8" }),
      alertTwo: new fields.BooleanField({ initial: false }),
    }),
    currency: new fields.SchemaField({
      cp: new fields.NumberField({ min: 0, initial: 0 }),
      sp: new fields.NumberField({ min: 0, initial: 0 }),
      ep: new fields.NumberField({ min: 0, initial: 0 }),
      gp: new fields.NumberField({ min: 0, initial: 0 }),
      pp: new fields.NumberField({ min: 0, initial: 0 }),
      bank: new fields.NumberField({ min: 0, initial: 0 }),
      total: new fields.NumberField({ min: 0, initial: 0 }),
      share: new fields.NumberField({ min: 0, initial: 100 }),
    }),
  };
}

const slotLevels = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function getSpellcasterSchema(fields) {
  const slotSchema = {};
  for (const k of slotLevels) {
    slotSchema[k] = new fields.SchemaField({ used: new fields.NumberField({ min: 0, initial: 0 }), max: new fields.NumberField({ min: 0, initial: 0 }) });
  }
  return {
    spells: new fields.SchemaField({
      enabled: new fields.BooleanField({ initial: false }),
      artsEnabled: new fields.BooleanField({ initial: false }),
      spellsEnabled: new fields.BooleanField({ initial: false }),
      leveledSlots: new fields.BooleanField({ initial: false }),
      perDay: new fields.SchemaField({ value: new fields.NumberField({ min: 0, initial: 0 }), max: new fields.NumberField({ min: 0, initial: 0 }) }),
      slots: new fields.SchemaField(slotSchema),
      prepared: new fields.SchemaField({ value: new fields.NumberField({ min: 0, initial: 0 }), max: new fields.NumberField({ min: 0, initial: 3 }) }),
      spellList: new fields.ObjectField({ initial: {} }),
      artsList: new fields.ObjectField({ initial: {} }),
    }),
    classes: new fields.ObjectField({ initial: {} }),
  };
}

export function scoreSchema(fields) {
  return {
    value: new fields.NumberField({ min: 0, initial: 0 }),
    bonus: new fields.NumberField({ initial: 0 }),
    mod: new fields.NumberField({ initial: 0 }),
    tweak: new fields.NumberField({ initial: 0 }),
  };
}
