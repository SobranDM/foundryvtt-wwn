import { sumContributions, fundedTotalFor, fundedFraction } from "../../helpers/project-calculator.mjs";

const fields = foundry.data.fields;

/**
 * Project actor data model.
 *
 * A long-running party/ally effort: a WWN Magical Working (Building Magical
 * Workings, rulebook pp.90-92) or a Godbound Fact change (Changing the
 * World, rulebook pp.126-130). Modeled as its own Actor type (not an Item)
 * so multiple contributing PCs — each normally owned by a different player —
 * can each hold independent edit rights on their own `contribution` item;
 * an embedded Item has no ownership of its own and always defers to its
 * parent actor's ownership map, which a plain-Item design cannot support.
 *
 * No feasibility/capability validation lives here (mage skill checks, a
 * Godbound's Words, etc.) — that is explicitly out of scope. This model only
 * tracks the collective spend/commit total, elapsed time, contributors, and
 * (for Godbound) the pure-arithmetic auto-lapse check when withdrawn
 * Influence drops the funded total below the required cost.
 */
export default class WwnProject extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true, min: 0 };
    const schema = {};

    schema.gameLine = new fields.StringField({
      required: true,
      initial: "wwn",
      choices: ["wwn", "godbound"],
    });

    // Free-text display labels (e.g. "Major" / "Region", "City" / "Improbable").
    // Deliberately not enum-gated — these are flavor text, not calculator inputs.
    schema.scale = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.magnitude = new fields.StringField({ required: true, blank: true, initial: "" });

    schema.status = new fields.StringField({
      required: true,
      initial: "planning",
      choices: ["planning", "inProgress", "maintained", "complete", "lapsed"],
    });

    // Blank by default: the sheet shows a game-line-appropriate placeholder
    // ("Silver (sp)" / "Influence + Dominion") until the GM types their own.
    schema.resource = new fields.SchemaField({
      label: new fields.StringField({ required: true, blank: true, initial: "" }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.time = new fields.SchemaField({
      label: new fields.StringField({ required: true, blank: true, initial: "Weeks" }),
      value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.effects = new fields.HTMLField({ required: true, blank: true });
    schema.notes = new fields.HTMLField({ required: true, blank: true });

    // Scratch inputs for the optional suggested-cost calculator. Persisted
    // (not DOM-scraped) so they survive the sheet's submitOnChange re-render.
    schema.calc = new fields.SchemaField({
      // WWN
      effectPoints: new fields.StringField({ required: true, blank: true, initial: "" }),
      area: new fields.StringField({
        required: true,
        initial: "room",
        choices: ["room", "building", "village", "city", "region"],
      }),
      doubleSilver: new fields.BooleanField({ initial: false }),
      // Godbound — named scope tier (rulebook pp.126-130), not a raw point
      // value; resolved to its base points via GODBOUND_SCOPE_BASE at
      // calculation time (see helpers/project-calculator.mjs).
      scope: new fields.StringField({
        required: true,
        initial: "village",
        choices: ["village", "city", "region", "nation", "realm"],
      }),
      wardRating: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      resistanceRating: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      magnitudeMult: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
    });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const actor = this.parent;
    if (!actor) return;

    const contributions = actor.items.filter((i) => i.type === "contribution");
    this.contributions = contributions;

    const sums = sumContributions(contributions.map((i) => i.system));
    this.contributionSums = sums;
    this.fundedTotal = fundedTotalFor(this.gameLine, sums);
    this.fundedFraction = fundedFraction(this.fundedTotal, this.resource.max);
  }

  getRollData() {
    return foundry.utils.deepClone(this);
  }
}
