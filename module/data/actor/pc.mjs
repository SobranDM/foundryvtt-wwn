import WwnActorBase from "./base.mjs";
import { deriveAbilityMods } from "../../derivations/modifiers.mjs";
import { deriveAC } from "../../derivations/ac.mjs";
import { deriveSaves } from "../../derivations/saves.mjs";
import { deriveMovement } from "../../derivations/movement.mjs";
import { deriveEncumbrance } from "../../derivations/encumbrance.mjs";
import { deriveInitiative } from "../../derivations/initiative.mjs";
import { deriveHitDice } from "../../derivations/hit-dice.mjs";
import { deriveResourcePools } from "../../derivations/resource-pools.mjs";
import { applyInstalledPermanentStrain } from "../../derivations/strain-max.mjs";
import { deriveAttackBonus } from "../../derivations/attack-bonus.mjs";
import { derivePreparedMax } from "../../derivations/prepared-spells.mjs";

const fields = foundry.data.fields;

export default class WwnPc extends WwnActorBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    /* Ability scores: value + baseMod persisted; mod derived */
    const abilities = {};
    for (const key of Object.keys(CONFIG.WWN.abilities)) {
      abilities[key] = new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 }),
        baseMod: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      });
    }
    schema.abilities = new fields.SchemaField(abilities);

    schema.details = new fields.SchemaField({
      /** Legacy free-text class; kept for migration and class-assignment pre-checks (not sheet-edited). */
      class: new fields.StringField({ required: true, blank: true }),
      background: new fields.StringField({ required: true, blank: true }),
      alignment: new fields.StringField({ required: true, blank: true }),
      level: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      notes: new fields.HTMLField({ required: true, blank: true }),
      /** Retainer loyalty (2d6 under); unused for non-retainers. */
      morale: new fields.NumberField({ ...requiredInteger, initial: 7 }),
      renown: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      xp: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        share: new fields.NumberField({ ...requiredInteger, initial: 100 }),
        next: new fields.NumberField({ ...requiredInteger, initial: 3 }),
      }),
    });

    /* Structured hit dice (display / fromEdges / perLevelTotal are derived) */
    schema.hitDice = new fields.SchemaField({
      die: new fields.StringField({
        required: true,
        choices: ["d4", "d6", "d8", "d10", "d12", "d20"],
        initial: "d6",
      }),
      perLevelMod: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.skills = new fields.SchemaField({
      unspent: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      levelsUnlocked: new fields.BooleanField({ initial: false }),
    });

    schema.casting = new fields.SchemaField({
      prepared: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 3 }),
      }),
    });

    schema.favorites = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    schema.languages = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });

    // Keep base `ab` (derived total) and add residual `abMod`.
    schema.combat = new fields.SchemaField({
      ab: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      abMod: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.retainer = new fields.SchemaField({
      enabled: new fields.BooleanField({ initial: false }),
      wage: new fields.StringField({ required: true, blank: true }),
    });

    schema.currencyShare = new fields.NumberField({ ...requiredInteger, initial: 100 });

    return schema;
  }

  /**
   * Fill newly required details fields so pre-2.0 world PCs can load.
   * @override
   */
  static migrateData(source) {
    source = super.migrateData(source);
    if (!source || typeof source !== "object") return source;
    source.details ??= {};
    if (source.details.morale === undefined || source.details.morale === null) {
      source.details.morale = 7;
    }
    if (source.details.renown === undefined || source.details.renown === null) {
      source.details.renown = { value: 0 };
    } else if (typeof source.details.renown === "number") {
      source.details.renown = { value: source.details.renown };
    } else if (typeof source.details.renown === "object" && source.details.renown.value === undefined) {
      source.details.renown.value = 0;
    }
    return source;
  }

  prepareBaseData() {
    super.prepareBaseData();
    // AE-only targets
    this.hitDice.staticMod = 0;
    this.hitDice.fromEdges = false;
    this.skills.floor = -1;
    this.combat.abBase = 0;
    this.combat.ab = 0;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const actor = this.parent;

    deriveAbilityMods(this.abilities);

    // Tracker ceilings
    this.strain.max = this.abilities.con.value;
    applyInstalledPermanentStrain(actor);
    this.alienation.valueMax = this.abilities.wis.value;
    this.stress.valueMax = this.abilities.wis.value;

    deriveHitDice(actor);
    deriveAC(actor);
    deriveSaves(actor);
    deriveEncumbrance(actor);
    deriveMovement(actor);
    deriveInitiative(actor);
    deriveAttackBonus(actor);
    this.#setXpThreshold();
    this.#computePrepared();
    this.#computeTreasure();
    deriveResourcePools(actor);
  }

  #setXpThreshold() {
    if (game.settings?.get("wwn", "xpPerChar")) return;
    const config = game.settings?.get("wwn", "xpConfig") ?? "xpFast";
    let rates = CONFIG.WWN.xpRates[config];
    if (config === "xpCustom") {
      rates = String(game.settings.get("wwn", "xpCustomList") ?? "")
        .split(",")
        .map((n) => Number(n.trim()));
    }
    if (!rates) return;
    this.details.xp.next = rates[this.details.level - 1] ?? rates[rates.length - 1];
  }

  #computePrepared() {
    const spells = this.parent.items.filter(
      (i) => i.type === "power" && i.system.subType === "spell"
    );
    this.casting.prepared.value = spells.filter((s) => s.system.prepared).length;

    const edges = this.parent.items.filter((i) => i.type === "classEdge");
    const fromEdges = derivePreparedMax(edges, this.details.level, this.abilities?.int?.mod ?? 0);
    if (fromEdges != null) this.casting.prepared.max = fromEdges;
  }

  #computeTreasure() {
    let total = 0;
    for (const item of this.parent.items) {
      if (item.type !== "item" || !item.system.treasure) continue;
      total += (item.system.quantity ?? 1) * (item.system.price ?? 0);
    }
    this.treasure = total;

    // Total wealth in base-currency units
    let wealth = 0;
    for (const c of this.parent.items.filter((i) => i.type === "currency")) {
      wealth += ((c.system.carried ?? 0) + (c.system.banked ?? 0)) * (c.system.multiplier ?? 1);
    }
    this.wealth = wealth + total;
  }

  getRollData() {
    const data = {};

    // Ability mods (@str) and scores (@strScore)
    for (const [key, ability] of Object.entries(this.abilities)) {
      data[key] = ability.mod ?? 0;
      data[`${key}Score`] = ability.value ?? 0;
    }

    data.level = this.details.level;
    data.lvl = data.level;
    data.halfLevel = Math.ceil(this.details.level / 2);
    data.atk = this.combat.ab;
    data.init = this.combat.initiative.individual.value;
    data.initiativeRoll = this.combat.initiative.individual.roll;
    data.groupInit = this.combat.initiative.group.value;
    data.groupInitiativeRoll = this.combat.initiative.group.roll;

    // Owned skill levels by slug (@exert, @know, ...); missing skill = -1
    for (const slug of [...CONFIG.WWN.coreSkills, ...CONFIG.WWN.psychicSkills]) {
      data[slug] = -1;
    }
    for (const skill of this.parent.items.filter((i) => i.type === "skill")) {
      const slug = skill.system.slug || skill.name.slugify({ strict: true }).replace(/-/g, "");
      data[slug] = skill.system.ownedLevel ?? -1;
    }

    data.combat = foundry.utils.deepClone(this.combat);
    data.abilities = foundry.utils.deepClone(this.abilities);
    return data;
  }
}
