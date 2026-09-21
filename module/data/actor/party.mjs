import { safeFromUuidSync } from "../../helpers/safe-resolve.mjs";
import { PHYSICAL_TYPES } from "../../helpers/party-treasury.mjs";

const fields = foundry.data.fields;

/**
 * Party actor data model.
 *
 * A Party holds shared treasure/gear/currency (embedded Items) and an
 * explicit roster of member PC UUIDs. It does not use the shared PC/NPC
 * combat pipeline, so it extends TypeDataModel directly (see
 * module/data/actor/faction.mjs for the same pattern). Members may belong
 * to more than one Party actor.
 *
 * Carrier assignment ("who's carrying this pool item") is tracked as a
 * single item-id -> actor-UUID map on the Party actor itself
 * (`carrierAssignments`), NOT as a field on every physical/currency item's
 * own schema. A `carriedBy` field on every item type would apply to items
 * that will never sit in a party's pool, and dragging/copying an item
 * between actors would drag stale carrier state along with it; keeping the
 * mapping on the one actor that actually cares about it avoids both. An
 * absent or null entry means "not carried by anyone."
 */
export default class WwnParty extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};

    schema.description = new fields.HTMLField({ required: true, blank: true });

    // Explicit roster of member PC UUIDs. Replaces the old flags.wwn.party
    // boolean, which had no notion of *which* party a PC belonged to.
    schema.members = new fields.ArrayField(
      new fields.DocumentUUIDField({ type: "Actor", required: true, nullable: false }),
      { required: true, initial: [] }
    );

    // Keyed by embedded Item id (not full UUID -- these items only ever
    // live on this same actor). Value is the carrying PC's Actor UUID, or
    // null/absent for "unassigned."
    schema.carrierAssignments = new fields.TypedObjectField(
      new fields.DocumentUUIDField({ type: "Actor", required: false, nullable: true, initial: null }),
      { required: true, initial: {} }
    );

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const actor = this.parent;
    if (!actor) return;

    // Resolve members -> {uuid, actor, broken}. A member UUID might point at
    // a since-deleted actor (broken: true), same "might be stale" pattern as
    // starship crew stations / power armor pilot resolution.
    this.resolvedMembers = this.members
      .map((uuid) => {
        const linked = safeFromUuidSync(uuid);
        return { uuid, actor: linked ?? null, broken: !linked };
      })
      .sort((a, b) => (a.actor?.name ?? "").localeCompare(b.actor?.name ?? ""));

    this.pool = {
      items: actor.items.filter((i) => PHYSICAL_TYPES.includes(i.type)),
      currency: actor.items
        .filter((i) => i.type === "currency")
        .sort((a, b) => (a.system.multiplier ?? 1) - (b.system.multiplier ?? 1)),
    };
  }

  getRollData() {
    return foundry.utils.deepClone(this);
  }
}
