import { WwnActorSheet } from "./actor-sheet.js";
import { WwnAdjustCurrency } from "../dialog/adjust-currency.js";

/**
 * Sheet for vehicles and mounts: name, optional encumbrance max, inventory, and currency (no bank).
 */
export class WwnActorSheetVehicle extends WwnActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wwn", "sheet", "actor", "vehicle"],
      template: "systems/wwn/templates/actors/vehicle-sheet.html",
      width: 560,
      height: 480,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "inventory",
        },
      ],
    });
  }

  _prepareItems(data) {
    const items = this.actor.items.filter((i) => i.type === "item");
    const weapons = this.actor.items.filter((w) => w.type === "weapon");
    const armors = this.actor.items.filter((a) => a.type === "armor");

    data.owned = {
      items: items.sort((a, b) => (a.name > b.name ? 1 : -1)),
      weapons: weapons.sort((a, b) => (a.name > b.name ? 1 : -1)),
      armors: armors.sort((a, b) => (a.name > b.name ? 1 : -1)),
    };
  }

  async getData() {
    const data = super.getData();
    this._prepareItems(data);
    data.config.currencyTypes = game.settings.get("wwn", "currencyTypes");
    if (!data.system.currency) {
      data.system.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, bank: 0 };
    }
    if (data.system.treasure === undefined) data.system.treasure = 0;
    return data;
  }

  adjustCurrency() {
    new WwnAdjustCurrency(this.actor, {
      top: this.position.top + 80,
      left: this.position.left + (this.position.width - 280) / 2,
    }).render(true);
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (!this.options.editable) return;

    html.find(".inventory .item-caret").click((ev) => {
      const items = $(ev.currentTarget.parentElement.parentElement).children(".item-list");
      if (items.css("display") === "none") {
        $(ev.currentTarget).find(".fas.fa-caret-right").removeClass("fa-caret-right").addClass("fa-caret-down");
        items.slideDown(200);
      } else {
        $(ev.currentTarget).find(".fas.fa-caret-down").removeClass("fa-caret-down").addClass("fa-caret-right");
        items.slideUp(200);
      }
    });

    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item?.sheet.render(true);
    });

    html.find(".item-delete").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const id = li.data("itemId");
      if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
      li.slideUp(200, () => this.render(false));
    });

    html.find(".quantity input").click((ev) => ev.target.select()).change(this._onQuantityChange.bind(this));

    html.find("a[data-action='currency-adjust']").click((ev) => {
      ev.preventDefault();
      this.adjustCurrency(ev);
    });
  }

  async _onQuantityChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) {
      const val = parseInt(event.target.value, 10);
      await item.update({ "system.quantity": isNaN(val) ? 0 : val });
    }
  }
}
