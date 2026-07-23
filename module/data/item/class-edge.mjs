import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * ClassEdge: SWN/WWN classes and CWN/AWN edges.
 *
 * Optional poolGrant (named shared pools: Effort, Psychic Effort, …) and
 * optional slotGrant (leveled Spell Slots only). Both may be set on one item.
 */
export default class WwnClassEdge extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.edgeType = new fields.StringField({
      required: true,
      choices: ["class", "edge"],
      initial: "class",
    });

    schema.attackProgression = new fields.StringField({
      required: true,
      choices: ["none", "warrior", "expert", "mage", "partialWarrior"],
      initial: "none",
    });

    schema.skillPointsPerLevel = new fields.NumberField({
      ...requiredInteger,
      initial: 3,
      min: 0,
    });

    schema.poolGrant = new fields.SchemaField({
      name: new fields.StringField({ required: true, blank: true }),
      formula: new fields.StringField({ required: true, blank: true }),
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      /** Optional base maximum by character level (e.g. Invoker Spell Points before Int). */
      progression: new fields.ArrayField(
        new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        { required: true, initial: [] }
      ),
    });

    schema.slotGrant = new fields.SchemaField({
      enabled: new fields.BooleanField({ required: true, initial: false }),
      progression: new fields.ArrayField(
        new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        { required: true, initial: [] }
      ),
      leveledProgression: new fields.ArrayField(
        new fields.ArrayField(
          new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 })
        ),
        { required: true, initial: [] }
      ),
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    /** Hit die grant applied when owned (combined across classEdges). */
    schema.hdGrant = new fields.SchemaField({
      die: new fields.StringField({
        required: true,
        blank: true,
        choices: ["", "d4", "d6", "d8", "d10", "d12", "d20"],
        initial: "",
      }),
      perLevelMod: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    /** Spells Prepared maximum by character level (1-indexed). */
    schema.preparedGrant = new fields.SchemaField({
      progression: new fields.ArrayField(
        new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        { required: true, initial: [] }
      ),
    });

    /* Bonus skills (same grant path as powers; rank-only). */
    schema.bonusSkills = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    schema.bonusSkillsPick = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.bonusSkillsChosen = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    /** Empty = listed skills only; `"any"` = open primary-skill pick when list empty and pick > 0. */
    schema.bonusSkillsMode = new fields.StringField({
      required: true,
      choices: ["", "any"],
      initial: "",
      blank: true,
    });

    /**
     * Optional attribute grant requiring a player pick.
     * - modPlus1Cap2: +1 to chosen ability mod
     * - prodigy: chosen non-Con score → 18, mod → +3
     * - modMinus1: −1 to chosen ability mod
     */
    schema.attributeGrant = new fields.SchemaField({
      mode: new fields.StringField({
        required: true,
        choices: ["", "modPlus1Cap2", "prodigy", "modMinus1"],
        initial: "",
        blank: true,
      }),
      /** Ability keys excluded from the pick (e.g. ["con"] for Prodigy). */
      exclude: new fields.ArrayField(new fields.StringField(), { required: true, initial: [] }),
      chosen: new fields.StringField({ required: true, blank: true, initial: "" }),
    });

    /**
     * Optional companion item names (powers/foci) granted on add.
     * When non-empty, overrides CLASS_EDGE_COMPANIONS[name].
     */
    schema.companions = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });

    return schema;
  }

  /**
   * Ensure grant sub-objects exist for classEdges created before hdGrant/preparedGrant.
   * @override
   */
  static migrateData(source) {
    source = super.migrateData(source);
    if (!source || typeof source !== "object") return source;
    source.hdGrant ??= {};
    if (source.hdGrant.die === undefined || source.hdGrant.die === null) source.hdGrant.die = "";
    if (source.hdGrant.perLevelMod === undefined || source.hdGrant.perLevelMod === null) {
      source.hdGrant.perLevelMod = 0;
    }
    source.preparedGrant ??= {};
    if (!Array.isArray(source.preparedGrant.progression)) source.preparedGrant.progression = [];
    source.poolGrant ??= {};
    if (!Array.isArray(source.poolGrant.progression)) source.poolGrant.progression = [];
    if (!Array.isArray(source.bonusSkills)) source.bonusSkills = [];
    if (source.bonusSkillsPick === undefined || source.bonusSkillsPick === null) source.bonusSkillsPick = 0;
    if (!Array.isArray(source.bonusSkillsChosen)) source.bonusSkillsChosen = [];
    if (source.bonusSkillsMode === undefined || source.bonusSkillsMode === null) source.bonusSkillsMode = "";
    source.attributeGrant ??= {};
    if (source.attributeGrant.mode === undefined || source.attributeGrant.mode === null) {
      source.attributeGrant.mode = "";
    }
    if (!Array.isArray(source.attributeGrant.exclude)) source.attributeGrant.exclude = [];
    if (source.attributeGrant.chosen === undefined || source.attributeGrant.chosen === null) {
      source.attributeGrant.chosen = "";
    }
    if (!Array.isArray(source.companions)) source.companions = [];
    return source;
  }
}
