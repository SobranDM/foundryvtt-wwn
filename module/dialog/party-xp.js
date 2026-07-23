import { isPc } from "../helpers/actor-types.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";

function partyActors() {
  return game.actors.filter((e) => isPc(e) && e.flags.wwn?.party === true);
}

/**
 * Deal XP among party members.
 */
export async function showPartyXpDialog() {
  const actors = partyActors();
  await showWwnDialog({
    modifier: "party-xp",
    title: game.i18n.localize("WWN.dialog.xp.deal"),
    template: "systems/wwn/templates/apps/party-xp.html",
    context: {
      actors,
      config: CONFIG.WWN,
      user: game.user,
      settings: game.settings,
    },
    position: { width: 280, height: 400 },
    buttons: [
      confirmButton({
        label: "WWN.dialog.xp.deal",
        callback: (_event, button) => {
          const rows = button.form.querySelectorAll(".actor");
          for (const row of rows) {
            const value = row.querySelector("input")?.value;
            const id = row.dataset.actorId;
            const actor = game.actors.get(id);
            if (value && actor) actor.getExperience(Math.floor(parseInt(value, 10)));
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
        const shares = actors.length;
        const value = parseFloat(toDeal) / shares / 100;
        if (!value) return;
        for (const a of actors) {
          const input = form.querySelector(`div[data-actor-id='${a.id}'] input`);
          if (input) input.value = Math.floor(a.system.details.xp.share * value);
        }
      });
    },
  });
}

/** @deprecated Prefer {@link showPartyXpDialog} */
export class WwnPartyXP {
  constructor(object) {
    this.object = object;
  }
  render() {
    return showPartyXpDialog();
  }
}
