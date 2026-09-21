import { isPc } from "../helpers/actor-types.mjs";
import { partyCarriedRawWeight, getPartyActors } from "../helpers/party-treasury.mjs";
/**
 * Encumbrance derivation: readied/stowed slot totals from carried items,
 * including currency slots (Σ carried / perSlot for currencies with weight).
 * `partyCarriedRawWeight` (module/helpers/party-treasury.mjs) itself
 * imports `physicalItemWeight` from this file -- both bindings are only
 * used inside function bodies, so the circular import resolves fine at
 * module-evaluation time.
 */

/**
 * Physical item weight contribution before readied/stowed assignment.
 * @param {"weapon"|"armor"|"item"} type
 * @param {object} s  item.system
 * @returns {number}
 */
export function physicalItemWeight(type, s) {
  if (!s) return 0;
  if (type === "armor") return s.weight ?? 0;

  let itemWeight = (s.weight ?? 0) * (s.quantity ?? 1);
  if ((type === "item" || type === "ammo") && (s.charges?.value || s.charges?.max)) {
    if (!s.charges.max) itemWeight = s.charges.value * (s.weight ?? 0);
    else if (s.charges.value > s.charges.max) {
      itemWeight = (s.charges.value / s.charges.max) * (s.weight ?? 0);
    } else itemWeight = s.weight ?? 0;
  }
  return itemWeight;
}

/**
 * @param {Actor} actor
 */
export function deriveEncumbrance(actor) {
  if (!isPc(actor)) return;
  const system = actor.system;
  const round = game.settings.get("wwn", "roundWeight");
  const weigh = (n) => (round ? Math.ceil(n) : n);

  let totalReadied = 0;
  let totalStowed = 0;
  const maxReadied = Math.floor((system.abilities?.str?.value ?? 10) / 2);
  const maxStowed = system.abilities?.str?.value ?? 10;

  for (const item of actor.items) {
    if (!["weapon", "armor", "item", "ammo"].includes(item.type)) continue;
    const s = item.system;
    if (
      (s.weightless === "whenReadied" && s.equipped) ||
      (s.weightless === "whenStowed" && s.stowed)
    ) continue;

    const itemWeight = physicalItemWeight(item.type, s);

    if (s.equipped) totalReadied += weigh(itemWeight);
    else if (s.stowed) totalStowed += weigh(itemWeight);
  }

  // Not-yet-rounded pool: currency slots (Σ carried / perSlot) plus the
  // party's raw pseudo-item contribution (see partyCarriedRawWeight),
  // rounded together in ONE final pass below rather than separately.
  // Rounding either piece in isolation first would overstate the total:
  // ceil(a) + ceil(b) >= ceil(a+b), so e.g. the PC's own 0.05-slot loose
  // change plus a party-assigned 0.05-slot coin purse would wrongly cost
  // two whole slots instead of the one slot the combined 0.1 actually needs.
  let unroundedStowed = 0;
  for (const c of actor.items.filter((i) => i.type === "currency")) {
    const perSlot = c.system.perSlot ?? 0;
    if (perSlot > 0) unroundedStowed += (c.system.carried ?? 0) / perSlot;
  }

  const partyRaw = partyCarriedRawWeight(actor.uuid, getPartyActors());
  unroundedStowed += partyRaw;

  totalStowed += round ? Math.ceil(unroundedStowed) : unroundedStowed;

  system.encumbrance = {
    readied: { max: maxReadied, value: Number(totalReadied.toFixed(2)) },
    stowed: { max: maxStowed, value: Number(totalStowed.toFixed(2)) },
    // Raw (unrounded) party contribution, shown as-is on the PC sheet's
    // "Carried for the Party" line. There's no meaningful standalone
    // rounding for this number -- it only rounds correctly once combined
    // with the PC's own currency above -- so this is deliberately not
    // ceil'd; it's an honest subtotal, not a third rounding path.
    partyCarried: Number(partyRaw.toFixed(2)),
  };
}
