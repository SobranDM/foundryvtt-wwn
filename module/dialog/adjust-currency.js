import { isPc } from "../helpers/actor-types.mjs";
import { applyCurrencyDeltas, getCurrencyItems } from "../helpers/currency.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";

/**
 * Open the adjust-currency dialog for an actor and apply deltas on confirm.
 * @param {Actor} actor
 */
export async function showAdjustCurrencyDialog(actor) {
  const currencies = getCurrencyItems(actor).map((i) => ({
    id: i.id,
    name: i.name,
    carried: i.system.carried ?? 0,
    banked: i.system.banked ?? 0,
    multiplier: i.system.multiplier ?? 1,
  }));
  if (!currencies.length) {
    return ui.notifications.warn(game.i18n.format("WWN.Currency.NoCurrencyItems", { name: actor.name }));
  }

  const context = {
    isCharacter: isPc(actor),
    currencies,
    user: game.user,
    config: CONFIG.WWN,
  };

  const result = await showWwnDialog({
    modifier: "adjust-currency",
    title: game.i18n.localize("WWN.items.adjustCurrency"),
    template: "systems/wwn/templates/actors/dialogs/adjust-currency.html",
    context,
    position: { width: 280 },
    buttons: [
      confirmButton({ label: "WWN.items.adjustCurrency" }),
      cancelButton(),
    ],
  });
  if (!result || result === "cancel") return;

  const carriedDeltas = {};
  for (const c of currencies) {
    carriedDeltas[c.id] = parseInt(result[`carried_${c.id}`], 10) || 0;
  }
  const bankDelta = parseInt(result.bank, 10) || 0;
  const ok = await applyCurrencyDeltas(actor, { carriedDeltas, bankDelta });
  if (ok) actor.sheet?.render(true);
}

/** @deprecated Prefer {@link showAdjustCurrencyDialog} */
export class WwnAdjustCurrency {
  constructor(object) {
    this.object = object;
  }
  render() {
    return showAdjustCurrencyDialog(this.object);
  }
}
