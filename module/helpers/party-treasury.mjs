import { physicalItemWeight } from "../derivations/encumbrance.mjs";

/**
 * Item types that count as physical party-pool cargo (weighed and listed
 * alongside pooled currency). Exported so every "what's in a Party's pool"
 * concept -- this file's own weight calculation, WwnParty's own
 * `pool.items` derivation -- shares one list instead of each maintaining
 * its own copy that can silently drift out of sync.
 */
export const PHYSICAL_TYPES = ["weapon", "armor", "item", "ammo"];

/**
 * Every party-type actor in the current world. Shared by every caller that
 * needs "all parties" (deriveEncumbrance, the PC sheet's carrying-party
 * picker) so there's one place that does this filter, not a `game.actors`
 * scan copy-pasted at each call site.
 * @returns {Actor[]}
 */
export function getPartyActors() {
  return game.actors?.filter((a) => a.type === "party") ?? [];
}

/**
 * Raw (deliberately UNROUNDED) weight a PC carries for the party: every
 * physical item's weight plus every currency stack's fractional slot count,
 * across any number of Party actors, summed into one number -- a single
 * "pseudo-item" contribution. Pure -- reads only base item.system fields
 * (weight/quantity/charges, carried/perSlot) plus each party's own
 * `carrierAssignments` map (also base schema data, not derived), so it's
 * safe regardless of cross-actor prepareDerivedData ordering.
 *
 * The Party actor never rounds anything itself. The caller (a PC's own
 * deriveEncumbrance) folds this raw figure into its own not-yet-rounded
 * pool and rounds ONCE, together with its own currency, at the end.
 * Rounding it here first (or per party item) would overstate the party's
 * marginal contribution: ceil(a) + ceil(b) >= ceil(a+b), so e.g. a PC whose
 * own currency already rounds up to a full slot on its own would get
 * double-charged a slot for even a single extra copper handed over by the
 * party, when in fact it rides along for free.
 *
 * @param {string} pcUuid
 * @param {Array<{items: Iterable<{id: string, type: string, system: object}>, system: {carrierAssignments?: Record<string, string|null>}}>} partyActors
 * @returns {number}
 */
export function partyCarriedRawWeight(pcUuid, partyActors) {
  let raw = 0;

  for (const party of partyActors ?? []) {
    const assignments = party?.system?.carrierAssignments ?? {};
    for (const item of party?.items ?? []) {
      if (!item?.system) continue;
      if ((assignments[item.id] ?? null) !== pcUuid) continue;
      if (PHYSICAL_TYPES.includes(item.type)) {
        const s = item.system;
        if (s.weightless === "whenStowed") continue;
        raw += physicalItemWeight(item.type, s);
      } else if (item.type === "currency") {
        const perSlot = item.system.perSlot ?? 0;
        if (perSlot > 0) raw += (item.system.carried ?? 0) / perSlot;
      }
    }
  }

  return raw;
}

/**
 * Which of the given Party actors this PC carries anything for -- used to
 * drive the PC sheet's "Carried for the Party" open-sheet button/picker.
 * Iterates `party.items` rather than the raw `carrierAssignments` map (same
 * as `partyCarriedRawWeight`) so a stale assignment left pointing at a
 * since-removed item doesn't make a party falsely appear as "carrying"
 * nothing of actual weight for this PC.
 * @param {string} pcUuid
 * @param {Array<{items: Iterable<{id: string}>, system: {carrierAssignments?: Record<string, string|null>}}>} partyActors
 * @returns {Array}
 */
export function partiesCarryingFor(pcUuid, partyActors) {
  return (partyActors ?? []).filter((party) => {
    const assignments = party?.system?.carrierAssignments ?? {};
    for (const item of party?.items ?? []) {
      if ((assignments[item.id] ?? null) === pcUuid) return true;
    }
    return false;
  });
}

/**
 * Build a Party-actor update payload clearing every assignment pointing at
 * a removed member, as dotted `system.carrierAssignments.<itemId>` keys
 * suitable for merging into one `actor.update()` call alongside a roster
 * change.
 * @param {Record<string, string|null>} carrierAssignments
 * @param {string} removedUuid
 * @returns {Record<string, null>}
 */
export function buildCarrierClearUpdate(carrierAssignments, removedUuid) {
  const updates = {};
  if (!removedUuid) return updates;
  for (const [itemId, actorUuid] of Object.entries(carrierAssignments ?? {})) {
    if (actorUuid === removedUuid) updates[`system.carrierAssignments.${itemId}`] = null;
  }
  return updates;
}
