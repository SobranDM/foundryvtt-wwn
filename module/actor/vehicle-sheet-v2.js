/**
 * Vehicle sheet using DocumentSheet and Handlebars PARTS (draw-steel style).
 */
import { WwnDocumentSheetV2 } from "../applications/document-sheet-v2.js";
import { openAdjustCurrency } from "../dialog/adjust-currency.js";
import { WwnDialog } from "../dialog/wwn-dialog.js";
import { prepareActiveEffectCategories } from "../effects.mjs";

function prepareVehicleContext(document) {
  const actor = document;
  const source = actor.system ?? {};
  const sys = foundry.utils.deepClone(source);
  if (!sys.currency || typeof sys.currency !== "object") sys.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, bank: 0 };
  if (sys.treasure === undefined) sys.treasure = 0;
  const items = actor.items?.filter((i) => i.type === "item") ?? [];
  const weapons = actor.items?.filter((w) => w.type === "weapon") ?? [];
  const armors = actor.items?.filter((a) => a.type === "armor") ?? [];
  const owned = {
    items: [...items].sort((a, b) => (a.name > b.name ? 1 : -1)),
    weapons: [...weapons].sort((a, b) => (a.name > b.name ? 1 : -1)),
    armors: [...armors].sort((a, b) => (a.name > b.name ? 1 : -1)),
  };
  return {
    name: actor.name,
    img: actor.img,
    system: sys,
    owned,
    config: CONFIG.WWN,
    currencyTypes: game.settings.get("wwn", "currencyTypes"),
    user: game.user,
    owner: actor.isOwner,
    editable: actor.sheet?.isEditable ?? false,
    effects: prepareActiveEffectCategories(actor.effects ?? []),
  };
}

const PARTS = {
  main: {
    template: "systems/wwn/templates/actors/vehicle-sheet-content.hbs",
    root: true,
  },
};

const DEFAULT_OPTIONS = {
  classes: ["wwn", "sheet", "actor", "vehicle"],
  position: { width: 560, height: 680 },
  actions: {
    "currency-adjust": async function (event, _target) {
      event?.preventDefault?.();
      await openAdjustCurrency(this.document);
    },
    "item-edit": function (event, target) {
      event?.preventDefault?.();
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      item?.sheet?.render(true);
    },
    "item-delete": async function (event, target) {
      event?.preventDefault?.();
      const row = target.closest(".item");
      const id = row?.dataset?.itemId;
      if (id) {
        await this.document.deleteEmbeddedDocuments("Item", [id]);
        this.render();
      }
    },
    "item-caret": function (event, target) {
      event?.preventDefault?.();
      const caretEl = target.closest(".item-caret");
      const parent = caretEl?.closest("li")?.parentElement ?? caretEl?.closest(".inventory-all > div");
      if (!parent) return;
      const itemList = parent.querySelector(".item-list");
      const icon = parent.querySelector(".item-caret .fas");
      if (!itemList || !icon) return;
      if (itemList.style.display === "none") {
        itemList.style.display = "";
        icon.classList.remove("fa-caret-right");
        icon.classList.add("fa-caret-down");
      } else {
        itemList.style.display = "none";
        icon.classList.remove("fa-caret-down");
        icon.classList.add("fa-caret-right");
      }
    },
    "item-search": async function (event, target) {
      event?.preventDefault?.();
      const button = target.closest(".item-search");
      if (!button) return;
      const itemType = button.dataset.type;
      const candidateItems = {};
      const gameGen = game?.release?.generation;
      for (const e of game.packs) {
        if (gameGen <= 10 && e.metadata.private === true) continue;
        if (gameGen > 10 && e.metadata.ownership?.PLAYER === "NONE") continue;
        const items = (await e.getDocuments()).filter((i) => i.type === itemType);
        for (const ci of items.map((item) => item.toObject())) candidateItems[ci.name] = ci;
      }
      const keys = Object.keys(candidateItems).sort();
      if (keys.length === 0) {
        ui.notifications?.info("Could not find any items in the compendium");
        return;
      }
      const itemOptions = keys.map((label) => `<option value='${label}'>${candidateItems[label].name}</option>`).join("");
      const dialogTemplate = `<div class="flex flex-col"><h1>Select ${itemType} to add</h1><div class="flex flexrow"><select id="itemList" class="">${itemOptions}</select></div></div>`;
      await WwnDialog.wait({
        title: `Add ${itemType}`,
        content: dialogTemplate,
        buttons: [
          {
            action: "addItem",
            label: `Add ${itemType}`,
            default: true,
            callback: async (_ev, _btn, dialog) => {
              const root = dialog?.element;
              const el = root?.length ? root[0] : root;
              const itemNameToAdd = el?.querySelector?.("#itemList")?.value;
              const toAdd = candidateItems[itemNameToAdd];
              if (toAdd) await this.document.createEmbeddedDocuments("Item", [{ ...toAdd }], {});
            },
          },
          { action: "close", label: "Close" },
        ],
      });
      this.render();
    },
    "item-create": async function (event, target) {
      event?.preventDefault?.();
      const header = target.closest(".item-create");
      if (!header) return;
      const type = header.dataset.type;
      const createItem = (t, name = `New ${String(t).capitalize()}`, data = {}) => {
        const itemData = { name: name || `New ${String(t).capitalize()}`, type: t, data: { ...data } };
        delete itemData.data.type;
        return itemData;
      };
      let dialogData = { name: `New ${String(type).capitalize()}`, type, armor: false, weapon: false, consumable: false, treasure: false, item: false };
      if (type === "armor") { dialogData.armor = true; dialogData.item = true; }
      else if (type === "weapon") { dialogData.weapon = true; dialogData.item = true; }
      else if (type === "item") {
        dialogData.item = true;
        if ("consumable" in header.dataset) dialogData.consumable = true;
        else if ("treasure" in header.dataset) dialogData.treasure = true;
      }
      const dialogContent = await renderTemplate("systems/wwn/templates/items/dialogs/new-item.hbs", dialogData);
      const sheet = this;
      await WwnDialog.wait({
        title: `Add ${type}`,
        content: dialogContent,
        buttons: [
          {
            action: "addItem",
            label: `Add ${type}`,
            default: true,
            callback: async (_ev, _btn, dialog) => {
              const root = dialog?.element;
              const el = root?.length ? root[0] : root;
              const g = (id) => el?.querySelector?.(id)?.value;
              const itemNameToAdd = g("#name");
              const enc = g("#encumbrance");
              const price = g("#price");
              const qty = g("#quantity");
              const location = g("#location");
              let data = { weight: Number(enc), price: Number(price), quantity: Number(qty) };
              if (location === "stowed") data.stowed = true;
              else if (location === "equipped") data.equipped = true;
              if (type === "weapon") {
                data.damage = g("#damage");
                data.shock = { damage: g("#shock-dgm"), ac: g("#shock-ac") };
                const weaponType = g("#weaponType");
                data.melee = weaponType === "melee" || weaponType === "both";
                data.missile = weaponType === "ranged" || weaponType === "both";
              } else if (type === "armor") {
                data.aac = { value: Number(g("#aac")), mod: 0 };
                data.type = g("#armorType");
              } else if (type === "item" && dialogData.consumable) {
                data.charges = { value: Number(g("#charges-val")), max: Number(g("#charges-max")) };
              } else if (type === "item" && dialogData.treasure) data.treasure = true;
              const itemData = createItem(type, itemNameToAdd, data);
              await sheet.document.createEmbeddedDocuments("Item", [itemData], {});
            },
          },
          { action: "close", label: "Cancel" },
        ],
      });
      this.render();
    },
  },
  form: {
    submitOnChange: true,
    closeOnSubmit: false,
  },
};

export class WwnActorSheetVehicleV2 extends WwnDocumentSheetV2 {
    static PARTS = PARTS;

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(super.DEFAULT_OPTIONS ?? {}),
      DEFAULT_OPTIONS
    );

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      return foundry.utils.mergeObject(context, prepareVehicleContext(this.document));
    }

    async _preparePartContext(partId, context, options) {
      return super._preparePartContext?.(partId, context, options) ?? context;
    }

    _getHeaderControls() {
      const controls = super._getHeaderControls();
      const seen = new Set();
      return controls.filter((c) => {
        const key = c.action ?? c.icon ?? c.label ?? "";
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      const content = this.element?.querySelector?.(".window-content") ?? this.element;
      if (!content) return;
      content.querySelectorAll(".quantity input").forEach((input) => {
        input.addEventListener("focus", (ev) => ev.target.select());
      });
    }

    async _onChangeForm(formConfig, event) {
      const target = event.target;
      if (target.classList.contains("quantity") || target.closest(".quantity")) {
        const itemId = target.closest(".item")?.dataset?.itemId;
        const item = this.document.items.get(itemId);
        if (item) {
          const val = parseInt(target.value, 10);
          await item.update({ "system.quantity": isNaN(val) ? 0 : val });
        }
        return;
      }
      await super._onChangeForm?.(formConfig, event);
    }
}
