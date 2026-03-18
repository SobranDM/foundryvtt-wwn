/**
 * Character sheet using DocumentSheet and Handlebars PARTS (draw-steel style).
 */
import { WwnDocumentSheetV2 } from "../applications/document-sheet-v2.js";
import { openAdjustCurrency } from "../dialog/adjust-currency.js";
import { openCharacterModifiers } from "../dialog/character-modifiers.js";
import { openCharacterCreator } from "../dialog/character-creation.js";
import { WwnDialog } from "../dialog/wwn-dialog.js";
import { prepareActiveEffectCategories } from "../effects.mjs";

function prepareCharacterItems(actor) {
  const items = [];
  const weapons = [];
  const armors = [];
  const abilities = [];
  const spells = [];
  const arts = [];
  const foci = [];
  const skills = [];
  for (const item of actor.items ?? []) {
    switch (item.type) {
      case "item": items.push(item); break;
      case "weapon": weapons.push(item); break;
      case "armor": armors.push(item); break;
      case "ability": abilities.push(item); break;
      case "spell": spells.push(item); break;
      case "art": arts.push(item); break;
      case "focus": foci.push(item); break;
      case "skill": skills.push(item); break;
      default: break;
    }
  }
  const sortByName = (a, b) => (a.name > b.name ? 1 : -1);
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
  const primarySkills = skills.filter((s) => !s.system.secondary).sort(sortByName);
  const secondarySkills = skills.filter((s) => s.system.secondary).sort(sortByName);
  const favoriteIds = new Set(actor.system?.favoriteItemIds ?? []);
  const byId = (list) => list.filter((i) => favoriteIds.has(i.id));
  return {
    slots: { used: slots },
    owned: {
      items: items.sort(sortByName),
      armors: armors.sort(sortByName),
      abilities: abilities.sort(sortByName),
      weapons: weapons.sort(sortByName),
      arts: sortedArts,
      foci: foci.sort(sortByName),
      skills: [...primarySkills, ...secondarySkills],
      spells: sortedSpells,
    },
    favorited: {
      weapons: byId(weapons),
      armors: byId(armors),
      items: byId(items),
      arts: Object.values(sortedArts).flat().filter((a) => favoriteIds.has(a.id)),
      spells: Object.values(sortedSpells).flat().filter((s) => favoriteIds.has(s.id)),
      abilities: byId(abilities),
      foci: byId(foci),
    },
    favoriteItemIds: [...favoriteIds],
  };
}

function percent(current, max) {
  if (!max || max <= 0) return 0;
  const p = Math.min(100, Math.round((Number(current) / Number(max)) * 100));
  return isNaN(p) ? 0 : p;
}

async function prepareCharacterContext(document) {
  const actor = document;
  const source = actor.system ?? {};
  const sys = foundry.utils.deepClone(source);
  const itemsData = prepareCharacterItems(actor);
  const config = CONFIG.WWN ?? {};
  const xpNext = sys.details?.xp?.next ?? 1;
  const xpValue = sys.details?.xp?.value ?? 0;
  const hpMax = sys.hp?.max ?? 1;
  const hpValue = sys.hp?.value ?? 0;
  const strainMax = sys.details?.strain?.max ?? 1;
  const strainValue = sys.details?.strain?.value ?? 0;
  const scores = Object.entries(config.scores ?? {}).map(([id, shortKey]) => ({
    id,
    value: sys.scores?.[id]?.value ?? 0,
    mod: sys.scores?.[id]?.mod ?? 0,
    shortKey,
    longKey: `WWN.scores.${id}.long`,
  }));
  const favoriteIds = actor.system?.favoriteItemIds ?? [];
  return {
    name: actor.name,
    img: actor.img,
    system: sys,
    owned: itemsData.owned,
    favorited: itemsData.favorited,
    favoriteItemIds: itemsData.favoriteItemIds ?? favoriteIds,
    slots: itemsData.slots,
    xpPercent: percent(xpValue, xpNext),
    hpPercent: percent(hpValue, hpMax),
    strainPercent: percent(strainValue, strainMax),
    config: {
      ...config,
      initiative: game.settings.get("wwn", "initiative") !== "group",
      showMovement: game.settings.get("wwn", "showMovement"),
      currencyTypes: game.settings.get("wwn", "currencyTypes"),
      replaceStrainWithWounds: game.settings.get("wwn", "replaceStrainWithWounds"),
      xpPerChar: game.settings.get("wwn", "xpPerChar"),
      medRange: game.settings.get("wwn", "medRange"),
      useTrauma: game.settings.get("wwn", "useTrauma"),
    },
    scores,
    enrichedBiography: await TextEditor.enrichHTML(actor.system.details?.biography ?? "", { async: true }),
    enrichedNotes: await TextEditor.enrichHTML(actor.system.details?.notes ?? "", { async: true }),
    isNew: actor.isNew?.(),
    user: game.user,
    owner: actor.isOwner,
    editable: actor.sheet?.isEditable ?? false,
    effects: prepareActiveEffectCategories(actor.effects ?? []),
  };
}

async function chooseLang() {
  const languages = (game.settings.get("wwn", "languageList") ?? "").split(",").filter(Boolean);
  const dlg = await renderTemplate("systems/wwn/templates/actors/dialogs/lang-create.hbs", { choices: languages });
  const result = await WwnDialog.wait({
    title: "",
    content: dlg,
    buttons: [
      { action: "ok", label: game.i18n.localize("WWN.Ok"), icon: "fa-solid fa-check", default: true, callback: (_ev, _btn, dialog) => {
        const el = dialog?.element;
        const root = el?.length ? el[0] : el;
        const sel = root?.querySelector?.('select[name="choice"]');
        return sel ? { choice: sel.value } : null;
      }},
      { action: "cancel", icon: "fa-solid fa-times", label: game.i18n.localize("WWN.Cancel") },
    ],
  });
  return result;
}

const PARTS = {
  header: {
    template: "systems/wwn/templates/actors/character/header.hbs",
    templates: ["systems/wwn/templates/actors/partials/character-header.hbs"],
  },
  tabs: {
    template: "templates/generic/tab-navigation.hbs",
  },
  main: {
    template: "systems/wwn/templates/actors/character/tab-main.hbs",
    templates: ["systems/wwn/templates/actors/partials/character-attributes-tab.hbs"],
  },
  gear: {
    template: "systems/wwn/templates/actors/character/tab-gear.hbs",
    templates: ["systems/wwn/templates/actors/partials/character-inventory-tab.hbs"],
  },
  abilities: {
    template: "systems/wwn/templates/actors/character/tab-abilities.hbs",
    templates: ["systems/wwn/templates/actors/partials/character-spells-tab.hbs"],
  },
  notes: {
    template: "systems/wwn/templates/actors/character/tab-notes.hbs",
    templates: ["systems/wwn/templates/actors/partials/character-notes-tab.hbs"],
  },
  effects: {
    template: "systems/wwn/templates/actors/character/tab-effects.hbs",
    templates: ["systems/wwn/templates/actors/partials/actor-effects.hbs"],
  },
};

const DEFAULT_OPTIONS = {
  classes: ["wwn", "sheet", "actor", "character"],
  position: { width: 755, height: 680 },
  actions: {
    "currency-adjust": async function (event) {
      event?.preventDefault?.();
      await openAdjustCurrency(this.document);
    },
    "modifiers": async function (event) {
      event?.preventDefault?.();
      await openCharacterModifiers(this.document, { top: this.position.top + 40, left: this.position.left + (this.position.width - 400) / 2 });
    },
    "generate-scores": function (event) {
      event?.preventDefault?.();
      openCharacterCreator(this.document, { top: this.position.top + 40, left: this.position.left + (this.position.width - 400) / 2 });
    },
    "item-edit": function (event, target) {
      event?.preventDefault?.();
      const itemId = target.closest(".item")?.dataset?.itemId;
      this.document.items.get(itemId)?.sheet?.render(true);
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
    "item-create": async function (event, target) {
      event?.preventDefault?.();
      const header = target.closest(".item-create") ?? target.closest("[data-type]");
      const type = header?.dataset?.type ?? "item";
      let dialogData = { name: `New ${String(type).capitalize()}`, type, armor: false, weapon: false, consumable: false, treasure: false, item: false };
      if (type === "armor") { dialogData.armor = true; dialogData.item = true; }
      else if (type === "weapon") { dialogData.weapon = true; dialogData.item = true; }
      else if (type === "item") {
        dialogData.item = true;
        if (header?.dataset?.consumable) dialogData.consumable = true;
        else if (header?.dataset?.treasure) dialogData.treasure = true;
      }
      const dialogContent = await renderTemplate("systems/wwn/templates/items/dialogs/new-item.hbs", dialogData);
      const sheet = this;
      await WwnDialog.wait({
        title: `Add ${type}`,
        content: dialogContent,
        buttons: [
          { action: "addItem", label: `Add ${type}`, default: true, callback: async (_ev, _btn, dialog) => {
            const el = dialog?.element;
            const root = el?.length ? el[0] : el;
            const g = (id) => root?.querySelector?.(id)?.value;
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
            const itemData = { name: itemNameToAdd || `New ${String(type).capitalize()}`, type, system: data };
            await sheet.document.createEmbeddedDocuments("Item", [itemData], {});
          }},
          { action: "close", label: "Cancel" },
        ],
      });
      this.render();
    },
    "item-search": async function (event, target) {
      event?.preventDefault?.();
      const button = target.closest(".item-search");
      if (!button) return;
      const itemType = button.dataset.type ?? "item";
      const candidateItems = {};
      const gameGen = game?.release?.generation;
      for (const e of game.packs) {
        if (gameGen <= 10 && e.metadata.private === true) continue;
        if (gameGen > 10 && e.metadata.ownership?.PLAYER === "NONE") continue;
        const items = (await e.getDocuments()).filter((i) => i.type === itemType);
        for (const ci of items.map((item) => item.toObject())) candidateItems[ci.name] = ci;
      }
      const keys = Object.keys(candidateItems).sort();
      if (keys.length === 0) { ui.notifications?.info("Could not find any items in the compendium"); return; }
      const itemOptions = keys.map((label) => `<option value='${label}'>${candidateItems[label].name}</option>`).join("");
      await WwnDialog.wait({
        title: `Add ${itemType}`,
        content: `<div class="flex flex-col"><h1>Select ${itemType} to add</h1><div class="flex flexrow"><select id="itemList" class="">${itemOptions}</select></div></div>`,
        buttons: [
          { action: "addItem", label: `Add ${itemType}`, default: true, callback: async (_ev, _btn, dialog) => {
            const root = dialog?.element;
            const el = root?.length ? root[0] : root;
            const itemNameToAdd = el?.querySelector?.("#itemList")?.value;
            const toAdd = candidateItems[itemNameToAdd];
            if (toAdd) await this.document.createEmbeddedDocuments("Item", [{ ...toAdd }], {});
          }},
          { action: "close", label: "Close" },
        ],
      });
      this.render();
    },
    "item-toggle": async function (event, target) {
      event?.preventDefault?.();
      const li = target.closest(".item");
      const item = this.document.items.get(li?.dataset?.itemId);
      if (item) await item.update({ system: { equipped: !item.system.equipped } });
    },
    "item-prep": async function (event, target) {
      event?.preventDefault?.();
      const li = target.closest(".item");
      const item = this.document.items.get(li?.dataset?.itemId);
      if (item) await item.update({ system: { prepared: !item.system.prepared } });
    },
    "stow-toggle": async function (event, target) {
      event?.preventDefault?.();
      const li = target.closest(".item");
      const item = this.document.items.get(li?.dataset?.itemId);
      if (item) await item.update({ system: { stowed: !item.system.stowed } });
    },
    "toggle-favorite": async function (event, target) {
      event?.preventDefault?.();
      const itemEl = target.closest(".item");
      const itemId = itemEl?.dataset?.itemId ?? target.closest("[data-item-id]")?.dataset?.itemId;
      if (!itemId) return;
      const ids = [...(this.document.system?.favoriteItemIds ?? [])];
      const idx = ids.indexOf(itemId);
      if (idx === -1) ids.push(itemId);
      else ids.splice(idx, 1);
      await this.document.update({ "system.favoriteItemIds": ids });
      this.render();
    },
    "item-push": async function (event, target) {
      event?.preventDefault?.();
      const table = target.dataset?.array;
      if (!table) return;
      const dialogInput = await chooseLang();
      if (!dialogInput?.choice) return;
      const languages = (game.settings.get("wwn", "languageList") ?? "").split(",");
      const name = languages[Number(dialogInput.choice)];
      const data = this.document.system;
      let update = foundry.utils.deepClone(data[table]) ?? { value: [] };
      if (!update.value) update.value = [];
      update.value.push(name);
      await this.document.update({ system: { [table]: update } });
    },
    "item-pop": async function (event, target) {
      event?.preventDefault?.();
      const itemEl = target.closest(".item");
      const table = target.dataset?.array;
      const lang = itemEl?.dataset?.lang;
      if (table == null) return;
      const data = this.document.system;
      const arr = data[table]?.value ?? [];
      await this.document.update({ system: { [table]: { value: arr.filter((el) => el !== lang) } } });
    },
    "skill-up": async function (event, target) {
      event?.preventDefault?.();
      const li = target.closest(".item");
      const skill = this.document.items.get(li?.dataset?.itemId);
      if (skill?.type !== "skill") return;
      const rank = skill.system.ownedLevel ?? 0;
      const lvl = this.document.system.details?.level ?? 0;
      if (!game.settings.get("wwn", "noSkillLevelReq")) {
        if (rank === 1 && lvl < 3) { ui.notifications?.error("Must be at least level 3 (edit manually to override)"); return; }
        if (rank === 2 && lvl < 6) { ui.notifications?.error("Must be at least level 6 (edit manually to override)"); return; }
        if (rank === 3 && lvl < 9) { ui.notifications?.error("Must be at least level 9 (edit manually to override)"); return; }
        if (rank > 3) { ui.notifications?.error("Cannot auto-level above 4"); return; }
      }
      const flatCost = game.settings.get("wwn", "flatSkillCost");
      const skillCost = flatCost ? 1 : rank + 2;
      const skillPointsAvail = this.document.system.skills?.unspent ?? 0;
      if (skillCost > skillPointsAvail) {
        ui.notifications?.error(`Not enough skill points. Have: ${skillPointsAvail}, need: ${skillCost}`);
        return;
      }
      await skill.update({ "system.ownedLevel": rank + 1 });
      await this.document.update({ "system.skills.unspent": skillPointsAvail - skillCost });
      ui.notifications?.info(`Removed ${skillCost} skill points`);
    },
    "lock-skills": function (event, target) {
      event?.preventDefault?.();
      const lock = target.dataset?.type === "lock";
      const el = this.element;
      el.querySelectorAll(".lock-skills.unlock").forEach((n) => { n.style.display = lock ? "inline-block" : "none"; });
      el.querySelectorAll(".lock-skills.lock").forEach((n) => { n.style.display = lock ? "none" : "inline-block"; });
      el.querySelectorAll(".skill-lock").forEach((n) => { n.style.display = lock ? "none" : ""; });
      el.querySelectorAll(".reverse-lock").forEach((n) => { n.style.display = lock ? "" : "none"; });
    },
    "recovery-scene": async function (event, target) {
      event?.preventDefault?.();
      // Stub: spend recovery to heal (Scene). To be wired to game rules (e.g. actor method for scene recovery).
      ui.notifications?.info(game.i18n.localize("WWN.RecoveryScene"));
    },
    "recovery-day": async function (event, target) {
      event?.preventDefault?.();
      // Stub: spend recovery to heal (Day). To be wired to game rules (e.g. actor method for day recovery).
      ui.notifications?.info(game.i18n.localize("WWN.RecoveryDay"));
    },
    "item-show": function (event, target) {
      event?.preventDefault?.();
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      if (item?.show) item.show();
      else item?.sheet?.render(true);
    },
    "effort-reset": async function (event, target) {
      event?.preventDefault?.();
      const actor = this.document;
      // Reset all art effort to 0
      const updates = [];
      for (const item of actor.items ?? []) {
        if (item.type === "art" && (item.system.effort ?? 0) > 0) {
          updates.push({ _id: item.id, "system.effort": 0 });
        }
      }
      // Reset class effort values to 0
      const classUpdates = {};
      for (const [id, cls] of Object.entries(actor.system.classes ?? {})) {
        if ((cls.value ?? 0) > 0) classUpdates[`system.classes.${id}.value`] = 0;
      }
      if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
      if (Object.keys(classUpdates).length) await actor.update(classUpdates);
      ui.notifications?.info("Effort reset.");
    },
    "item-roll": function (event, target) {
      event?.preventDefault?.();
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      if (item?.roll) item.roll();
    },
    "roll-save": function (event, target) {
      event?.preventDefault?.();
      const save = target.dataset?.save;
      if (save && this.document.rollSave) {
        this.document.rollSave(save, { event });
      }
    },
    "roll-check": function (event, target) {
      event?.preventDefault?.();
      const score = target.dataset?.score ?? target.closest("[data-score]")?.dataset?.score;
      if (score && this.document.rollCheck) {
        this.document.rollCheck(score, { event });
      }
    },
  },
  form: { submitOnChange: true, closeOnSubmit: false },
};

export class WwnActorSheetCharacterV2 extends WwnDocumentSheetV2 {
  static PARTS = PARTS;

  static TABS = {
    primary: {
      tabs: [
        { id: "main" },
        { id: "gear" },
        { id: "abilities" },
        { id: "notes", label: "WWN.category.details" },
        { id: "effects" },
      ],
      initial: "main",
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
      const { abilities, ...rest } = parts;
      return rest;
    }
    return parts;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (group === "primary" && !this.document?.system?.spells?.enabled) {
      delete tabs.abilities;
    }
    return tabs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, await prepareCharacterContext(this.document));
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
    const el = this.element;
    if (!el) return;
    const content = el.querySelector?.(".window-content") ?? el;

    // Non-action event listeners (these don't use data-action)
    content.querySelectorAll(".quantity input, .charges input").forEach((input) => {
      input.addEventListener("focus", (ev) => ev.target.select());
    });

    // Initialize active tab content (changeTab only runs on click; content needs "active" on first render)
    if (content.querySelector?.(".sheet-tabs.tabs")) {
      const initial = this.tabGroups?.primary ?? this.constructor.TABS?.primary?.initial ?? "main";
      this.changeTab(initial, "primary", { force: true, updatePosition: false });
    }

    // Container arrow toggles (expand/collapse container contents)
    content.querySelectorAll(".inventory .container-arrow").forEach((node) => {
      node.addEventListener("click", async (ev) => {
        const container = ev.currentTarget.closest(".item-entry");
        if (!container) return;
        const itemEl = container.querySelector(".item");
        const item = this.document.items.get(itemEl?.dataset?.itemId);
        const itemsEl = container.querySelector(".container-items");
        if (item?.system?.container?.isContainer && itemsEl) {
          const isOpen = item.system.container.isOpen;
          itemsEl.style.display = isOpen ? "none" : "";
          await item.update({ "system.container.isOpen": !isOpen });
        }
      });
    });
  }

  async _onChangeForm(formConfig, event) {
    const target = event.target;
    if (target.classList.contains("quantity") || target.closest(".quantity")) {
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      if (item) await item.update({ "system.quantity": isNaN(parseInt(target.value, 10)) ? 0 : parseInt(target.value, 10) });
      return;
    }
    if (target.classList.contains("charges") || target.closest(".charges")) {
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      if (item) await item.update({ "system.charges.value": isNaN(parseInt(target.value, 10)) ? 0 : parseInt(target.value, 10) });
      return;
    }
    await super._onChangeForm?.(formConfig, event);
  }
}
