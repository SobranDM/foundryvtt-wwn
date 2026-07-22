import { isPc } from "../helpers/actor-types.mjs";
/**
 * Encumbrance derivation: readied/stowed slot totals from carried items,
 * including currency slots (Σ carried / perSlot for currencies with weight).
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
  if (type === "item" && (s.charges?.value || s.charges?.max)) {
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
    if (!["weapon", "armor", "item"].includes(item.type)) continue;
    const s = item.system;
    if (
      (s.weightless === "whenReadied" && s.equipped) ||
      (s.weightless === "whenStowed" && s.stowed)
    ) continue;

    const itemWeight = physicalItemWeight(item.type, s);

    if (s.equipped) totalReadied += weigh(itemWeight);
    else if (s.stowed) totalStowed += weigh(itemWeight);
  }

  // Currency slots: Σ carried / perSlot over weighted carried currencies.
  let currencySlots = 0;
  for (const c of actor.items.filter((i) => i.type === "currency")) {
    const perSlot = c.system.perSlot ?? 0;
    if (perSlot > 0) currencySlots += (c.system.carried ?? 0) / perSlot;
  }
  totalStowed += round ? Math.ceil(currencySlots) : currencySlots;

  system.encumbrance = {
    readied: { max: maxReadied, value: Number(totalReadied.toFixed(2)) },
    stowed: { max: maxStowed, value: Number(totalStowed.toFixed(2)) },
  };
}
