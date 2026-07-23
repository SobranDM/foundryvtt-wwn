/**
 * Party overview ApplicationV2 — lists party-flagged PCs and opens XP/currency/select dialogs.
 */
import { isPc } from "../helpers/actor-types.mjs";
import { showPartyXpDialog } from "./party-xp.js";
import { showPartyCurrencyDialog } from "./party-coin.js";
import { showWwnDialog, confirmButton } from "../applications/wwn-dialog.mjs";
import { applyAppThemeClasses } from "../config/themes.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class WwnPartySheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wwn-party-sheet",
    classes: ["wwn", "wwn-app", "wwn-app--party-sheet"],
    tag: "form",
    window: {
      title: "WWN.dialog.partysheet",
      resizable: true,
      contentClasses: [],
    },
    position: { width: 350, height: 450 },
    actions: {
      resync: WwnPartySheet.#onResync,
      dealXp: WwnPartySheet.#onDealXp,
      dealCurrency: WwnPartySheet.#onDealCurrency,
      selectActors: WwnPartySheet.#onSelectActors,
      openSheet: WwnPartySheet.#onOpenSheet,
    },
  };

  static PARTS = {
    main: {
      template: "systems/wwn/templates/apps/party-sheet.html",
    },
  };

  /** @override */
  async _prepareContext(_options) {
    const partyActors = game.actors.filter((e) => isPc(e) && e.flags.wwn?.party === true);
    return {
      data: { documents: partyActors },
      config: CONFIG.WWN,
      user: game.user,
      settings: game.settings,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    applyAppThemeClasses(this.element);
    this.element.removeEventListener("drop", this.#onDropBound);
    this.element.addEventListener("drop", this.#onDropBound);
  }

  #onDropBound = (event) => this.#onDrop(event);

  async #onDrop(event) {
    event.preventDefault();
    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (data.type === "Actor") {
        const actor = fromUuidSync(data.uuid);
        await actor.setFlag("wwn", "party", true);
        this.render(true);
      }
    } catch {
      return false;
    }
  }

  static #onResync() {
    this.render(true);
  }

  static async #onDealXp() {
    return showPartyXpDialog();
  }

  static async #onDealCurrency() {
    return showPartyCurrencyDialog();
  }

  static async #onSelectActors() {
    const allCharacterActors = game.actors.filter((e) => isPc(e));
    const result = await showWwnDialog({
      modifier: "party-select",
      title: "Select Party Characters",
      template: "systems/wwn/templates/apps/party-select.html",
      context: { actors: allCharacterActors },
      position: { width: 220, height: "auto" },
      buttons: [
        confirmButton({
          label: "WWN.Update",
          callback: (_event, button) => {
            const checks = button.form.querySelectorAll("input[data-action='select-actor']");
            return Array.from(checks).map((c) => ({
              key: c.getAttribute("name"),
              checked: c.checked,
            }));
          },
        }),
      ],
    });
    if (!result) return;
    for (const { key, checked } of result) {
      await allCharacterActors[key]?.setFlag("wwn", "party", checked);
    }
    this.render(true);
  }

  static #onOpenSheet(event, target) {
    const actorId = target.closest("[data-actor-id]")?.dataset.actorId;
    game.actors.get(actorId)?.sheet?.render(true);
  }
}
