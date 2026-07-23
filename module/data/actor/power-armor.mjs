import { sumArmorFittingBudgets, fittingsAreInert } from "../../helpers/power-armor-budget.mjs";
import { derivePowerArmorEffects } from "../../helpers/power-armor-derive.mjs";
import { resolvePilot, isPilotTrained, buildMergedRollData } from "../../helpers/power-armor-pilot.mjs";

const fields = foundry.data.fields;

/**
 * Modular power armor actor data model.
 */
export default class WwnPowerArmor extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.description = new fields.HTMLField({ required: true, blank: true });
    schema.frameType = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.mass = new fields.SchemaField({
      max: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.power = new fields.SchemaField({
      max: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.cost = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 });
    schema.pilot = new fields.SchemaField({
      actor: new fields.DocumentUUIDField({ type: "Actor", required: false, nullable: true, initial: null }),
    });
    schema.trainedPilots = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    schema.powered = new fields.BooleanField({ initial: true });
    schema.runtime = new fields.SchemaField({
      remaining: new fields.NumberField({ required: true, nullable: true, initial: 30 }),
      max: new fields.NumberField({ required: true, nullable: true, initial: 30 }),
    });
    schema.maintenance = new fields.SchemaField({
      skipped: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.soak = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
      max: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.favorites = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });
    schema.forbidEfficiency = new fields.BooleanField({ initial: false });
    schema.runtimeMultiplier = new fields.NumberField({ required: true, nullable: false, initial: 1 });
    schema.perpetual = new fields.BooleanField({ initial: false });
    schema.transportFrames = new fields.NumberField({ ...requiredInteger, min: 1, initial: 1 });
    schema.stealthPenalty = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.maxRuntimeCap = new fields.NumberField({ required: true, nullable: true, initial: null });

    // Display mirrors for sheet (derived)
    schema.ac = new fields.NumberField({ ...requiredInteger, initial: 10 });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const actor = this.parent;
    if (!actor) return;

    const budgets = sumArmorFittingBudgets(actor.items, this.mass.max, this.power.max);
    this.mass.used = budgets.massUsed;
    this.mass.free = this.mass.max - budgets.massUsed;
    this.power.used = budgets.powerUsed;
    this.power.free = this.power.max - budgets.powerUsed;
    this.overBudget = fittingsAreInert(budgets, this.mass.max, this.power.max);

    const derived = derivePowerArmorEffects(actor.items, {
      powered: this.powered,
      inert: this.overBudget,
      massMax: this.mass.max,
      powerMax: this.power.max,
      runtimeMultiplier: this.runtimeMultiplier ?? 1,
      forbidEfficiency: this.forbidEfficiency,
      perpetualFrame: this.perpetual,
    });

    if (this.maxRuntimeCap != null && derived.runtimeMax != null) {
      derived.runtimeMax = Math.min(derived.runtimeMax, this.maxRuntimeCap);
    }

    this.derived = derived;
    this.ac = derived.ac;
    this.soak.max = derived.soakMax;
    if (this.soak.value > this.soak.max) this.soak.value = this.soak.max;

    this.runtime.max = derived.runtimeMax;
    if (derived.perpetual) {
      this.runtime.remaining = null;
    }

    this.fittings = actor.items.filter((i) => i.type === "armorFitting");
    this.weapons = actor.items.filter((i) => i.type === "weapon");
    this.gear = actor.items.filter((i) => i.type === "item" || i.type === "armor");

    const resolve = (uuid) => {
      try {
        return typeof fromUuidSync === "function" ? fromUuidSync(uuid) : null;
      } catch {
        return null;
      }
    };
    this.pilotResolved = resolvePilot(this.pilot, resolve);
    this.pilotTrained = isPilotTrained(this.pilot.actor, this.trainedPilots);
  }

  getRollData() {
    const resolve = (uuid) => {
      try {
        return typeof fromUuidSync === "function" ? fromUuidSync(uuid) : null;
      } catch {
        return null;
      }
    };
    const pilot = resolvePilot(this.pilot, resolve);
    const merged = buildMergedRollData(pilot.actor ?? null, this.derived ?? {}, this);
    return foundry.utils.deepClone({ ...merged, suitSystem: foundry.utils.deepClone(this) });
  }
}
