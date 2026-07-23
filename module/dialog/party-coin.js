import { isPc } from "../helpers/actor-types.mjs";
import { depositBank } from "../helpers/currency.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";

function partyActors() {
  return game.actors.filter((e) => isPc(e) && e.flags.wwn?.party === true);
}

/**
 * Deal bank currency among party members.
 */
export async function showPartyCurrencyDialog() {
  const actors = partyActors();
  await showWwnDialog({
    modifier: "party-coin",
    title: game.i18n.localize("WWN.dialog.currency.deal"),
    template: "systems/wwn/templates/apps/party-coin.html",
    context: {
      actors,
      config: CONFIG.WWN,
      user: game.user,
      settings: game.settings,
    },
    position: { width: 280, height: 400 },
    buttons: [
      confirmButton({
        label: "WWN.dialog.currency.deal",
        callback: async (_event, button) => {
          const rows = button.form.querySelectorAll(".actor");
          for (const row of rows) {
            const value = row.querySelector("input")?.value;
            const id = row.dataset.actorId;
            const actor = game.actors.get(id);
            const amount = Math.floor(parseInt(value, 10) || 0);
            if (amount && actor) await depositBank(actor, amount);
          }
          return true;
        },
      }),
      cancelButton(),
    ],
    onRender: (_event, dialog) => {
      const root = dialog.element;
      root?.querySelector('[data-action="calculate-share"]')?.addEventListener("click", (ev) => {
        ev.preventDefault();
        const form = root.querySelector("form") ?? root;
        const toDeal = form.querySelector('input[name="total"]')?.value;
        let shares = 0;
        for (const a of actors) shares += a.system.currencyShare ?? 0;
        const value = parseFloat(toDeal) / shares;
        if (!value) return;
        for (const a of actors) {
          const input = form.querySelector(`div[data-actor-id='${a.id}'] input`);
          if (input) input.value = Math.floor((a.system.currencyShare ?? 0) * value);
        }
      });
    },
  });
}

/** @deprecated Prefer {@link showPartyCurrencyDialog} */
export class WwnPartyCurrency {
  constructor(object) {
    this.object = object;
  }
  render() {
    return showPartyCurrencyDialog();
  }
}
