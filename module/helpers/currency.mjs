/**
 * Helpers for currency items (type "currency") on actors.
 */

/**
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function getCurrencyItems(actor) {
  return actor.items.filter((i) => i.type === "currency");
}

/**
 * Base denomination: multiplier === 1, else first currency item.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function getBaseCurrencyItem(actor) {
  const items = getCurrencyItems(actor);
  return items.find((i) => Number(i.system.multiplier) === 1) ?? items[0] ?? null;
}

/**
 * Add (or subtract) amount to the base currency item's banked total.
 * @param {Actor} actor
 * @param {number} value
 * @param {{ chat?: boolean }} [options]
 * @returns {Promise<Item|null>}
 */
export async function depositBank(actor, value, { chat = true } = {}) {
  const amount = Math.floor(Number(value) || 0);
  if (!amount) return null;
  const item = getBaseCurrencyItem(actor);
  if (!item) {
    ui.notifications.warn(game.i18n.format("WWN.Currency.NoCurrencyItems", { name: actor.name }));
    return null;
  }
  const next = Math.max((item.system.banked ?? 0) + amount, 0);
  await item.update({ "system.banked": next });
  if (chat) {
    await ChatMessage.create({
      content: game.i18n.format("WWN.messages.GetCurrency", { name: actor.name, value: amount }),
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }
  return item;
}

/**
 * Apply carried deltas keyed by item id, plus optional bank delta on the base item.
 * @param {Actor} actor
 * @param {{ carriedDeltas?: Record<string, number>, bankDelta?: number }} deltas
 * @returns {Promise<boolean>} false if any result would go negative
 */
export async function applyCurrencyDeltas(actor, { carriedDeltas = {}, bankDelta = 0 } = {}) {
  const updates = [];
  for (const [id, raw] of Object.entries(carriedDeltas)) {
    const delta = Math.floor(Number(raw) || 0);
    if (!delta) continue;
    const item = actor.items.get(id);
    if (!item || item.type !== "currency") continue;
    const next = (item.system.carried ?? 0) + delta;
    if (next < 0) {
      ui.notifications.warn(game.i18n.format("WWN.Currency.CannotGoNegative", { name: item.name }));
      return false;
    }
    updates.push({ _id: id, "system.carried": next });
  }

  const bank = Math.floor(Number(bankDelta) || 0);
  if (bank) {
    const base = getBaseCurrencyItem(actor);
    if (!base) {
      ui.notifications.warn(game.i18n.format("WWN.Currency.NoCurrencyItems", { name: actor.name }));
      return false;
    }
    const nextBank = (base.system.banked ?? 0) + bank;
    if (nextBank < 0) {
      ui.notifications.warn(game.i18n.format("WWN.Currency.CannotGoNegative", { name: base.name }));
      return false;
    }
    const existing = updates.find((u) => u._id === base.id);
    if (existing) existing["system.banked"] = nextBank;
    else updates.push({ _id: base.id, "system.banked": nextBank });
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return true;
}

/**
 * Set carried amount on the base currency item (character creation silver, etc.).
 * @param {Actor} actor
 * @param {number} amount
 */
export async function setBaseCurrencyCarried(actor, amount) {
  const item = getBaseCurrencyItem(actor);
  if (!item) {
    ui.notifications.warn(game.i18n.format("WWN.Currency.NoCurrencyItems", { name: actor.name }));
    return null;
  }
  await item.update({ "system.carried": Math.max(Math.floor(Number(amount) || 0), 0) });
  return item;
}
