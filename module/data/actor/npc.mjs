import WwnActorBase from "./base.mjs";
import { deriveAC } from "../../derivations/ac.mjs";
import { deriveSaves } from "../../derivations/saves.mjs";
import { deriveMovement } from "../../derivations/movement.mjs";
import { deriveInitiative } from "../../derivations/initiative.mjs";
import { deriveResourcePools } from "../../derivations/resource-pools.mjs";
import { applyInstalledPermanentStrain } from "../../derivations/strain-max.mjs";

const fields = foundry.data.fields;

export default class WwnNpc extends WwnActorBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.hd = new fields.StringField({ required: true, initial: "1d8" });
    schema.skill = new fields.NumberField({ ...requiredInteger, initial: 0 });

    schema.details = new fields.SchemaField({
      alignment: new fields.StringField({ required: true, blank: true }),
      xp: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      morale: new fields.NumberField({ ...requiredInteger, initial: 7 }),
      instinct: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      // UUID link replaces WWN's regex-parsed "[RollTable.id]" strings
      instinctTable: new fields.DocumentUUIDField({ type: "RollTable", required: false, nullable: true, initial: null }),
      appearing: new fields.SchemaField({
        d: new fields.StringField({ required: true, blank: true }),
        w: new fields.StringField({ required: true, blank: true }),
      }),
      treasure: new fields.SchemaField({
        table: new fields.StringField({ required: true, blank: true }),
        type: new fields.StringField({ required: true, blank: true }),
      }),
    });

    schema.favorites = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    schema.notes = new fields.HTMLField({ required: true, blank: true });

    schema.combat = new fields.SchemaField({
      ab: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      damageBonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      damageBonusHalfLevel: new fields.BooleanField({ initial: false }),
      /** Flat initiative bonus for NPCs (no AE required). */
      initMod: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      acManual: new fields.SchemaField({
        melee: new fields.NumberField({ ...requiredInteger, initial: 10 }),
        ranged: new fields.NumberField({ ...requiredInteger, initial: 10 }),
      }),
    });

    /** Persisted save bonuses for NPCs (applied in deriveSaves; AE still optional). */
    schema.saveMods = new fields.SchemaField({
      base: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      evasion: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      mental: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      physical: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      luck: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    return schema;
  }

  /**
   * Coerce legacy instinctTable object `{ table }` into a Document UUID string.
   * @override
   */
  static migrateData(source) {
    source = super.migrateData(source);
    if (!source || typeof source !== "object") return source;
    source.details ??= {};
    const it = source.details.instinctTable;
    if (it && typeof it === "object") {
      const raw = String(it.table ?? it.uuid ?? "").trim();
      const uuidMatch = raw.match(/@UUID\[([^\]]+)\]/);
      const rollTableMatch = raw.match(/\[?(RollTable\.[a-zA-Z0-9]+)\]?/);
      source.details.instinctTable = uuidMatch?.[1] ?? rollTableMatch?.[1] ?? null;
    }
    return source;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const actor = this.parent;

    // NPCs have no ability scores; strain ceiling falls back to 10.
    this.strain.max ||= 10;
    applyInstalledPermanentStrain(actor);

    deriveAC(actor);
    deriveSaves(actor);
    deriveMovement(actor);
    deriveInitiative(actor);
    deriveResourcePools(actor);
  }

  getRollData() {
    const data = {};
    // @level for NPCs = HD count
    data.level = 1;
    const diceRegex = String(this.hd).match(/(\d+)d\d+/);
    if (diceRegex) data.level = parseInt(diceRegex[1]);
    data.lvl = data.level;
    data.halfLevel = Math.ceil(data.level / 2);
    data.atk = this.combat.ab;
    data.init = this.combat.initiative.individual.value;
    data.initiativeRoll = this.combat.initiative.individual.roll;
    data.groupInit = this.combat.initiative.group.value;
    data.groupInitiativeRoll = this.combat.initiative.group.roll;
    data.combat = foundry.utils.deepClone(this.combat);
    return data;
  }
}
