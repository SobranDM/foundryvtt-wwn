import { sumEquipmentBudgets } from "../../helpers/starship-budget.mjs";
import { STATIONS, maintenanceCost } from "../../helpers/starship-crew.mjs";

const fields = foundry.data.fields;

/**
 * Standalone starship actor data model.
 */
export default class WwnStarship extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};
    const stationSchema = () => new fields.SchemaField({
      actor: new fields.DocumentUUIDField({ type: "Actor", required: false, nullable: true, initial: null }),
      formula: new fields.StringField({ required: true, blank: true, initial: "" }),
    });

    schema.description = new fields.HTMLField({ required: true, blank: true });
    schema.hullType = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.hullClass = new fields.StringField({
      required: true,
      choices: ["fighter", "frigate", "cruiser", "capital"],
      initial: "fighter",
    });
    schema.hp = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });
    schema.ac = new fields.NumberField({ ...requiredInteger, initial: 10 });
    schema.armor = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 });
    schema.speed = new fields.NumberField({ required: false, nullable: true, initial: null });
    schema.drive = new fields.NumberField({ ...requiredInteger, min: 0, initial: 1 });
    schema.power = new fields.SchemaField({
      max: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.mass = new fields.SchemaField({
      max: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.hardpoints = new fields.SchemaField({
      max: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.crew = new fields.SchemaField({
      min: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
      max: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
      current: new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 }),
    });
    schema.cost = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0 });
    schema.cargo = new fields.NumberField({ required: true, nullable: false, initial: 0 });
    schema.npcCp = new fields.NumberField({ ...requiredInteger, min: 0, initial: 4 });
    schema.stations = new fields.SchemaField(
      Object.fromEntries(STATIONS.map((station) => [station, stationSchema()])),
    );

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const actor = this.parent;
    if (!actor) return;

    const budgets = sumEquipmentBudgets(actor.items, this.hullClass);
    this.power.used = budgets.powerUsed;
    this.power.free = this.power.max - budgets.powerUsed;
    this.mass.used = budgets.massUsed;
    this.mass.free = this.mass.max - budgets.massUsed;
    this.hardpoints.used = budgets.hardpointsUsed;
    this.maintenance = maintenanceCost(this.cost);

    this.weapons = actor.items.filter((item) => item.type === "shipWeapon");
    this.defenses = actor.items.filter((item) => item.type === "shipDefense");
    this.fittings = actor.items.filter((item) => item.type === "shipFitting");
  }

  getRollData() {
    return foundry.utils.deepClone(this);
  }
}
