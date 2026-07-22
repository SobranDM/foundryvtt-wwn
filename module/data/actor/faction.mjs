const fields = foundry.data.fields;

/** Faction hit-point contribution per attribute rating level. */
export const HEALTH_XP_TABLE = {
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 9,
  6: 12,
  7: 16,
  8: 20,
};

/**
 * Faction actor data model (ported from WWN `faction`).
 *
 * Factions do not use the shared PC/NPC combat pipeline; they track ratings,
 * treasure, goals, tags, and a log, and own `asset` items.
 */
export default class WwnFaction extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.description = new fields.HTMLField({ required: true, blank: true });

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 7 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 7 }),
    });

    schema.forceRating = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.cunningRating = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.wealthRating = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.magicRating = new fields.StringField({ required: true, initial: "None" });

    schema.facCreds = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.xp = new fields.NumberField({ ...requiredInteger, initial: 0 });

    schema.homeworld = new fields.StringField({ required: true, blank: true });
    schema.active = new fields.BooleanField({ initial: true });

    schema.factionGoal = new fields.StringField({ required: true, blank: true });
    schema.factionGoalDesc = new fields.HTMLField({ required: true, blank: true });

    // Tags: { name, desc, effect }. ObjectField keeps arbitrary tag shapes.
    schema.tags = new fields.ArrayField(new fields.ObjectField(), { required: true, initial: [] });
    // Log entries are pre-rendered HTML strings.
    schema.log = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });

    schema.initiative = new fields.SchemaField({
      roll: new fields.StringField({ required: true, initial: "1d8" }),
      value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    return schema;
  }

  /** @param {number} level */
  static getHealth(level) {
    return HEALTH_XP_TABLE[level] ?? 0;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const actor = this.parent;
    if (!actor) return;

    const assets = actor.items.filter((i) => i.type === "asset");
    const sortAssets = (a, b) => {
      if (a.system.baseOfInfluence && !b.system.baseOfInfluence) return -1;
      if (!a.system.baseOfInfluence && b.system.baseOfInfluence) return 1;
      return a.name > b.name ? 1 : -1;
    };

    this.cunningAssets = assets.filter((i) => i.system.assetType === "cunning").sort(sortAssets);
    this.forceAssets = assets.filter((i) => i.system.assetType === "force").sort(sortAssets);
    this.wealthAssets = assets.filter((i) => i.system.assetType === "wealth").sort(sortAssets);

    this.health.max =
      WwnFaction.getHealth(this.wealthRating) +
      WwnFaction.getHealth(this.forceRating) +
      WwnFaction.getHealth(this.cunningRating);
  }

  getRollData() {
    return foundry.utils.deepClone(this);
  }
}
