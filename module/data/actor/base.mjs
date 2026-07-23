const fields = foundry.data.fields;

/**
 * Shared actor data: universal header trackers, combat bases, movement.
 *
 * AE-first design: persisted base values live in the schema; AE-targetable
 * derived paths are zero-initialized in prepareBaseData so initial-phase
 * Active Effects always have a defined target.
 */
export default class WwnActorBase extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    /* Universal header trackers */
    schema.hp = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 4 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 4 }),
    });
    schema.strain = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    // Alienation/Stress deliberately use `valueMax` (derived, never schema
    // `max`) so Foundry never clamps a value that can legally overflow.
    schema.alienation = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.stress = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    /* Combat bases */
    schema.combat = new fields.SchemaField({
      ab: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    /* Movement */
    schema.movement = new fields.SchemaField({
      base: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 30 }),
      }),
    });

    schema.biography = new fields.HTMLField({ required: true, blank: true });

    return schema;
  }

  /** Zero-initialize every AE-targetable derived path. */
  prepareBaseData() {
    super.prepareBaseData();

    // AC pipeline
    this.combat.ac = {
      base: 10,
      mod: 0,
      melee: { value: 10, mod: 0 },
      ranged: { value: 10, mod: 0 },
    };

    // Attack modifiers
    this.combat.allAttack = 0;
    this.combat.meleeAttack = 0;
    this.combat.rangeAttack = 0;

    // Damage / shock modifiers (numeric; formula AE values are resolved
    // against roll data at application time by WwnActiveEffect)
    this.combat.allDamage = 0;
    this.combat.meleeDamage = 0;
    this.combat.rangeDamage = 0;
    this.combat.allShock = 0;
    this.combat.meleeShock = 0;
    this.combat.rangeShock = 0;

    this.combat.immuneToSurprise = false;
    this.combat.treatAllMeleeAsAcTen = false;
    this.combat.immuneToShock = false;
    this.combat.innateAc = { min: 0 };
    this.combat.autoStabilize = false;
    this.combat.meleeCountsAsTl4 = false;
    this.combat.meleeMissDamage = "";
    this.combat.rangeMissDamage = "";
    this.combat.punchMissDamage = "";
    this.combat.immuneToPrimitiveWeapons = false;
    this.combat.endOfTurnAdjacentShock = false;
    this.combat.missAfterFirstMeleeHit = false;

    // Captain / navigator focus bonuses (read from PC when crewing a starship)
    this.starship = {
      commandPointsBonus: 0,
      combatBonusHpPercent: 0,
      spikeDrillAutoSucceedDiff: 0,
      spikeDrillDoublePilot: false,
      spikeDriveLevelBonus: 0,
    };

    // Initiative — individual vs group (side) rolls are separate AE targets
    this.combat.initiative = {
      individual: { roll: "1d8", mod: 0, value: 0 },
      group: { roll: "1d8", mod: 0, value: 0 },
      // Legacy aliases filled in deriveInitiative for individual mode
      roll: "1d8",
      mod: 0,
      value: 0,
    };

    // Movement
    this.movement.bonus = 0;

    // Trackers
    this.strain.max = 0;
    this.trauma = { base: 6, targetMod: 0, dieMod: 0, value: 6 };

    // Saves container (per-save mods seeded by initial-phase AEs)
    this.saves = { base: { mod: 0 } };
    const saveSetKey = game.settings?.get("wwn", "saveSet") ?? "wwn";
    const saveSet = CONFIG.WWN.saveSets[saveSetKey] ?? CONFIG.WWN.saveSets.wwn;
    for (const id of Object.keys(saveSet.saves)) {
      this.saves[id] = { value: 0, mod: 0 };
    }
  }
}
