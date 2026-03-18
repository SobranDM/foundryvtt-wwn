/**
 * Monster sheet using DocumentSheet and Handlebars PARTS (draw-steel style).
 */
import { WwnDocumentSheetV2 } from "../applications/document-sheet-v2.js";
import { WwnDialog } from "../dialog/wwn-dialog.js";
import { prepareActiveEffectCategories } from "../effects.mjs";

function prepareMonsterItems(actor) {
  const weapons = [];
  const armors = [];
  const items = [];
  const arts = [];
  const spells = [];
  const abilities = [];
  const foci = [];
  const attackPatterns = [];
  for (const item of actor.items ?? []) {
    switch (item.type) {
      case "weapon":
        weapons.push(item);
        attackPatterns.push(item);
        break;
      case "armor": armors.push(item); break;
      case "item": items.push(item); break;
      case "art": arts.push(item); break;
      case "spell": spells.push(item); break;
      case "ability": abilities.push(item); break;
      case "focus": foci.push(item); break;
      default: break;
    }
  }
  const sortByName = (a, b) => (a.name > b.name ? 1 : -1);
  attackPatterns.sort((a, b) => {
    const aName = a.name.toLowerCase(), bName = b.name.toLowerCase();
    return aName > bName ? 1 : bName > aName ? -1 : 0;
  });
  const sortedSpells = {};
  const slots = {};
  for (const s of spells) {
    const lvl = s.system.lvl;
    if (!sortedSpells[lvl]) sortedSpells[lvl] = [];
    if (!slots[lvl]) slots[lvl] = 0;
    slots[lvl] += s.system.memorized ?? 0;
    sortedSpells[lvl].push(s);
  }
  Object.keys(sortedSpells).forEach((level) => sortedSpells[level].sort(sortByName));
  const sortedArts = {};
  for (const a of arts) {
    const source = a.system.source ?? "default";
    if (!sortedArts[source]) sortedArts[source] = [];
    sortedArts[source].push(a);
  }
  Object.keys(sortedArts).forEach((source) => sortedArts[source].sort(sortByName));
  return {
    attackPatterns,
    slots: { used: slots },
    owned: {
      weapons: weapons.sort(sortByName),
      armors: armors.sort(sortByName),
      items: items.sort(sortByName),
      arts: sortedArts,
      spells: sortedSpells,
      abilities: abilities.sort(sortByName),
      foci: foci.sort(sortByName),
    },
  };
}

async function prepareMonsterContext(document) {
  const actor = document;
  const source = actor.system ?? {};
  const sys = foundry.utils.deepClone(source);
  if (!sys.details) sys.details = {};
  if (!sys.details.hasOwnProperty("instinctTable")) {
    sys.details.instinctTable = { table: "", link: "" };
  }
  sys.details.instinctTable.link = await TextEditor.enrichHTML(sys.details.instinctTable?.table ?? "", { async: true });
  const itemsData = prepareMonsterItems(actor);
  const config = CONFIG.WWN ?? {};
  return {
    name: actor.name,
    img: actor.img,
    system: sys,
    attackPatterns: itemsData.attackPatterns,
    owned: itemsData.owned,
    slots: itemsData.slots,
    config: {
      ...config,
      morale: game.settings.get("wwn", "morale"),
      useTrauma: game.settings.get("wwn", "useTrauma"),
    },
    isNew: actor.isNew?.(),
    enrichedBiography: await TextEditor.enrichHTML(actor.system.details?.biography ?? "", { async: true }),
    user: game.user,
    owner: actor.isOwner,
    editable: actor.sheet?.isEditable ?? false,
    effects: prepareActiveEffectCategories(actor.effects ?? []),
  };
}

const PARTS = {
  header: {
    template: "systems/wwn/templates/actors/monster/header.hbs",
    templates: ["systems/wwn/templates/actors/partials/monster-header.hbs"],
  },
  tabs: {
    template: "templates/generic/tab-navigation.hbs",
  },
  attributes: {
    template: "systems/wwn/templates/actors/monster/tab-attributes.hbs",
    templates: ["systems/wwn/templates/actors/partials/monster-attributes-tab.hbs"],
  },
  spells: {
    template: "systems/wwn/templates/actors/monster/tab-spells.hbs",
    templates: ["systems/wwn/templates/actors/partials/character-spells-tab.hbs"],
  },
  notes: {
    template: "systems/wwn/templates/actors/monster/tab-notes.hbs",
  },
  effects: {
    template: "systems/wwn/templates/actors/monster/tab-effects.hbs",
    templates: ["systems/wwn/templates/actors/partials/actor-effects.hbs"],
  },
};

const DEFAULT_OPTIONS = {
  classes: ["wwn", "sheet", "monster", "actor"],
  position: { width: 730, height: 625 },
  actions: {
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
    "item-prep": async function (event, target) {
      event?.preventDefault?.();
      const li = target.closest(".item");
      const item = this.document.items.get(li?.dataset?.itemId);
      if (item) await item.update({ system: { prepared: !item.system.prepared } });
    },
    "item-reset": async function (event, target) {
      event?.preventDefault?.();
      const weapons = this.document.items.filter((i) => i.type === "weapon");
      for (const wp of weapons) {
        await wp.update({ system: { counter: { value: 0 } } });
      }
      this.render();
    },
    "item-pattern": async function (event, target) {
      event?.preventDefault?.();
      const li = target.closest(".item");
      const item = this.document.items.get(li?.dataset?.itemId);
      if (!item) return;
      const colors = Object.keys(CONFIG.WWN.colors ?? {});
      const idx = colors.indexOf(item.system.pattern);
      const next = idx + 1 === colors.length ? 0 : idx + 1;
      await item.update({ "system.pattern": colors[next] });
      this.render();
    },
    "item-search": async function (event, target) {
      event?.preventDefault?.();
      const button = target.closest(".item-search");
      if (!button) return;
      const itemType = button.dataset.type ?? "weapon";
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
      const header = target.closest("[data-type]");
      const type = header?.dataset?.type;
      const choices = header?.dataset?.choices;
      const types = choices ? Object.fromEntries(choices.split(",").map((c) => [c.trim(), c.trim()])) : { weapon: "weapon", armor: "armor", item: "item", ability: "ability" };
      const dlg = await renderTemplate("systems/wwn/templates/items/entity-create.hbs", { types });
      const result = await WwnDialog.wait({
        title: game.i18n.localize("WWN.dialog.createItem"),
        content: dlg,
        buttons: [
          {
            action: "ok",
            label: game.i18n.localize("WWN.Ok"),
            icon: "fa-solid fa-check",
            default: true,
            callback: (_ev, _btn, dialog) => {
              const el = dialog?.element;
              const root = el?.length ? el[0] : el;
              const typeVal = root?.querySelector?.('select[name="type"]')?.value;
              const nameVal = root?.querySelector?.('input[name="name"]')?.value;
              return { type: typeVal, name: nameVal };
            },
          },
          { action: "cancel", icon: "fa-solid fa-times", label: game.i18n.localize("WWN.Cancel") },
        ],
      });
      if (result?.type && result?.name) {
        await this.document.createEmbeddedDocuments("Item", [{ name: result.name, type: result.type }], {});
        this.render();
      }
    },
    "item-show": function (event, target) {
      event?.preventDefault?.();
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      item?.sheet?.render(true);
    },
    "hp-roll": function (event, target) {
      event?.preventDefault?.();
      this.document.rollHP?.({ event });
    },
  },
  form: {
    submitOnChange: true,
    closeOnSubmit: false,
  },
};

export class WwnActorSheetMonsterV2 extends WwnDocumentSheetV2 {
    static PARTS = PARTS;

    static TABS = {
      primary: {
        tabs: [
          { id: "attributes" },
          { id: "spells" },
          { id: "notes" },
          { id: "effects", label: "WWN.Effects" },
        ],
        initial: "attributes",
        labelPrefix: "WWN.category",
      },
    };

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(super.DEFAULT_OPTIONS ?? {}),
      DEFAULT_OPTIONS
    );

    _configureRenderParts(options) {
      const parts = super._configureRenderParts(options);
      if (!this.document?.system?.spells?.enabled) {
        const { spells, ...rest } = parts;
        return rest;
      }
      return parts;
    }

    _prepareTabs(group) {
      const tabs = super._prepareTabs(group);
      if (group === "primary" && !this.document?.system?.spells?.enabled) {
        delete tabs.spells;
      }
      return tabs;
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      return foundry.utils.mergeObject(context, await prepareMonsterContext(this.document));
    }

    async _preparePartContext(partId, context, options) {
      const c = await (super._preparePartContext?.(partId, context, options) ?? context);
      if (partId === "tabs") {
        c._tabsObject = c.tabs;
        c.tabs = Object.values(c.tabs || {});
      }
      const tabsForLookup = c._tabsObject ?? c.tabs;
      if (tabsForLookup && partId in tabsForLookup) c.tab = tabsForLookup[partId];
      return c;
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
      content.querySelectorAll(".counter input").forEach((input) => {
        input.addEventListener("focus", (ev) => ev.target.select());
      });
      // Initialize active tab content (changeTab only runs on click; content needs "active" on first render)
      if (content.querySelector?.(".sheet-tabs.tabs")) {
        const initial = this.tabGroups?.primary ?? this.constructor.TABS?.primary?.initial ?? "attributes";
        this.changeTab(initial, "primary", { force: true, updatePosition: false });
      }
      content.querySelectorAll(".instinct-check a").forEach((node) => {
        node.addEventListener("click", (ev) => { ev.preventDefault(); this.document.rollInstinct?.({ event: ev }); });
      });
      content.querySelectorAll(".reaction-check a").forEach((node) => {
        node.addEventListener("click", (ev) => { ev.preventDefault(); this.document.rollReaction?.({ event: ev }); });
      });
      content.querySelectorAll(".appearing-check a").forEach((node) => {
        node.addEventListener("click", (ev) => {
          ev.preventDefault();
          const check = ev.currentTarget.closest(".check-field")?.dataset?.check;
          this.document.rollAppearing?.({ event: ev, check });
        });
      });
      content.querySelectorAll(".monster-skill-check a").forEach((node) => {
        node.addEventListener("click", (ev) => {
          ev.preventDefault();
          const check = ev.currentTarget.closest(".check-field")?.dataset?.check;
          this.document.rollMonsterSkill?.({ event: ev, check });
        });
      });
      content.querySelectorAll(".saving-throw a").forEach((node) => {
        node.addEventListener("click", (ev) => {
          ev.preventDefault();
          const save = ev.currentTarget.closest(".saving-throw")?.dataset?.save;
          if (save) this.document.rollSave?.(save, { event: ev });
        });
      });
      content.querySelectorAll(".hp-roll").forEach((node) => {
        node.addEventListener("click", (ev) => { ev.preventDefault(); this.document.rollHP?.({ event: ev }); });
      });
    }

    /** @override Handle RollTable drop for instinct table; delegate Item/Folder to base. */
    async _onDrop(event) {
      const getDragEventData = foundry?.applications?.ux?.TextEditor?.implementation?.getDragEventData;
      const data = getDragEventData ? getDragEventData(event) : null;
      if (!data && event.dataTransfer?.getData) {
        try {
          const raw = event.dataTransfer.getData("text/plain");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.type === "RollTable" && parsed?.uuid) {
              event?.preventDefault?.();
              event?.stopPropagation?.();
              await this.document.update({ "system.details.instinctTable.table": `@UUID[${parsed.uuid}]` });
              this.render();
              return;
            }
          }
        } catch (_) {}
      }
      if (data?.type === "RollTable" && data?.uuid) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        await this.document.update({ "system.details.instinctTable.table": `@UUID[${data.uuid}]` });
        this.render();
        return;
      }
      return super._onDrop(event);
    }

    async _onChangeForm(formConfig, event) {
      const target = event.target;
      const counterRow = target.closest(".counter");
      if (counterRow) {
        const itemId = counterRow.closest(".item")?.dataset?.itemId;
        const item = this.document.items.get(itemId);
        if (item) {
          const field = target.dataset?.field;
          const val = parseInt(target.value, 10);
          if (field === "value") await item.update({ "system.counter.value": isNaN(val) ? 0 : val });
          else if (field === "max") await item.update({ "system.counter.max": isNaN(val) ? 0 : val });
        }
        return;
      }
      await super._onChangeForm?.(formConfig, event);
    }
}
