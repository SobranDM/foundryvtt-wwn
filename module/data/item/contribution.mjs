import WwnItemBase from "./base.mjs";

const fields = foundry.data.fields;

/**
 * Contribution item data model.
 *
 * Belongs to a `project` actor (see module/data/actor/project.mjs). One row
 * per contributing actor: a link to that actor (by UUID, so it survives
 * rename) plus their committed amounts. PCs and NPCs are both valid
 * contributors — nothing here gates on actor type.
 *
 * There is no `system.name` field: the embedded Item's own `name` already
 * serves as the fallback display label if the linked actor is deleted or
 * unlinked (it is set to the actor's name at link time and stays editable).
 */
export default class WwnContribution extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true, min: 0 };
    const schema = super.defineSchema();
    // Contribution items carry no rich-text description; drop the mixin field.
    delete schema.description;

    schema.actorUuid = new fields.DocumentUUIDField({ type: "Actor", required: false, nullable: true, initial: null });

    // Godbound: an ongoing commitment (lapses if withdrawn).
    schema.influenceCommitted = new fields.NumberField({ ...requiredInteger, initial: 0 });
    // Godbound: permanently spent; never auto-zeroed, even on lapse.
    schema.dominionSpent = new fields.NumberField({ ...requiredInteger, initial: 0 });
    // WWN: optional convenience only — RAW treats Working cost as a single
    // collective party expense, so this may sit unused at 0 for WWN projects.
    schema.resourceContributed = new fields.NumberField({ ...requiredInteger, initial: 0 });

    schema.note = new fields.StringField({ required: true, blank: true, initial: "" });

    return schema;
  }
}
