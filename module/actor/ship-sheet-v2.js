/**
 * Ship sheet using DocumentSheetV2 and Handlebars PARTS.
 * Registered only when foundry.applications.api.DocumentSheet is available.
 */
import { WwnDocumentSheetV2 } from "../applications/document-sheet-v2.js";
import { openAdjustCurrency } from "../dialog/adjust-currency.js";
import { openCharacterModifiers } from "../dialog/character-modifiers.js";
import { openCharacterCreator } from "../dialog/character-creation.js";
import { WwnDialog } from "../dialog/wwn-dialog.js";
import { prepareActiveEffectCategories } from "../effects.mjs";

function prepareShipItems(actor) {
  const items = [];
  const weapons = [];
  const armors = [];
  const abilities = [];
  const spells = [];
  const arts = [];
  const foci = [];
  const skills = [];
  const crewmembers = [];
  const fittings = [];
  const shipweapons = [];
  const cargos = [];
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
      case "crewmember": crewmembers.push(item); break;
      case "fitting": fittings.push(item); break;
      case "shipweapon": shipweapons.push(item); break;
      case "cargo": cargos.push(item); break;
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
      crewmembers: crewmembers.sort(sortByName),
      fittings: fittings.sort(sortByName),
      shipweapons: shipweapons.sort(sortByName),
      cargos: cargos.sort(sortByName),
    },
  };
}

async function prepareShipContext(document) {
  const actor = document;
  const source = actor.system ?? {};
  const sys = foundry.utils.deepClone(source);
  const itemsData = prepareShipItems(actor);
  const config = CONFIG.WWN ?? {};
  return {
    name: actor.name,
    img: actor.img,
    system: sys,
    data: { treasure: sys.treasure },
    owned: itemsData.owned,
    slots: itemsData.slots,
    config: {
      ...config,
      initiative: game.settings.get("wwn", "initiative") !== "group",
      showMovement: game.settings.get("wwn", "showMovement"),
      currencyTypes: game.settings.get("wwn", "currencyTypes"),
      replaceStrainWithWounds: game.settings.get("wwn", "replaceStrainWithWounds"),
      xpPerChar: game.settings.get("wwn", "xpPerChar"),
      medRange: game.settings.get("wwn", "medRange"),
    },
    enrichedBiography: await TextEditor.enrichHTML(actor.system.details?.biography ?? "", { async: true }),
    enrichedNotes: await TextEditor.enrichHTML(actor.system.details?.notes ?? "", { async: true }),
    user: game.user,
    owner: actor.isOwner,
    editable: actor.sheet?.isEditable ?? false,
    effects: prepareActiveEffectCategories(actor.effects ?? []),
  };
}

const PARTS = {
  main: {
    template: "systems/wwn/templates/actors/ship-sheet.hbs",
    root: true,
  },
};

async function chooseLang() {
  const languages = game.settings.get("wwn", "languageList") ?? "";
  const choices = languages.split(",").filter(Boolean);
  const dlg = await renderTemplate("systems/wwn/templates/actors/dialogs/lang-create.hbs", { choices });
  const result = await WwnDialog.wait({
    title: "",
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
          const sel = root?.querySelector?.('select[name="choice"]');
          return sel ? { choice: sel.value } : null;
        },
      },
      { action: "cancel", icon: "fa-solid fa-times", label: game.i18n.localize("WWN.Cancel") },
    ],
  });
  return result;
}

async function chooseItemType(choices = { focus: "focus", ability: "ability" }) {
  const dlg = await renderTemplate("systems/wwn/templates/items/entity-create.hbs", { types: choices });
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
          return {
            type: root?.querySelector?.('select[name="type"]')?.value,
            name: root?.querySelector?.('input[name="name"]')?.value,
          };
        },
      },
      { action: "cancel", icon: "fa-solid fa-times", label: game.i18n.localize("WWN.Cancel") },
    ],
  });
  return result;
}

const DEFAULT_OPTIONS = {
  classes: ["wwn", "sheet", "actor", "ship"],
  position: { width: 755, height: 625 },
  actions: {
    "currency-adjust": async function (event, _target) {
      event?.preventDefault?.();
      await openAdjustCurrency(this.document);
    },
    "pay-crew": async function (event, _target) {
      event?.preventDefault?.();
      await openAdjustCurrency(this.document);
    },
    "modifiers": async function (event, _target) {
      event?.preventDefault?.();
      await openCharacterModifiers(this.document, { top: this.position.top + 40, left: this.position.left + (this.position.width - 400) / 2 });
    },
    "generate-scores": function (event, _target) {
      event?.preventDefault?.();
      openCharacterCreator(this.document, {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2,
      });
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
    "item-create": async function (event, target) {
      event?.preventDefault?.();
      const header = target.closest(".item-create") ?? target.closest("[data-type]");
      const type = header?.dataset?.type ?? "item";
      const createData = (t, name = `New ${String(t).capitalize()}`, data = {}) => {
        const itemData = { name: name || `New ${String(t).capitalize()}`, type: t, system: { ...data } };
        return itemData;
      };
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
          {
            action: "addItem",
            label: `Add ${type}`,
            default: true,
            callback: async (_ev, _btn, dialog) => {
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
              const itemData = createData(type, itemNameToAdd, data);
              await sheet.document.createEmbeddedDocuments("Item", [itemData], {});
            },
          },
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
      const update = arr.filter((el) => el !== lang);
      await this.document.update({ system: { [table]: { value: update } } });
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
  },
  form: {
    submitOnChange: true,
    closeOnSubmit: false,
  },
};

export class WwnActorSheetShipV2 extends WwnDocumentSheetV2 {
    static PARTS = PARTS;

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(super.DEFAULT_OPTIONS ?? {}),
      DEFAULT_OPTIONS
    );

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      return foundry.utils.mergeObject(context, await prepareShipContext(this.document));
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
      content.querySelectorAll(".quantity input, .charges input").forEach((input) => {
        input.addEventListener("focus", (ev) => ev.target.select());
      });
      // Initialize active tab content (changeTab only runs on click; content needs "active" on first render)
      if (content.querySelector?.(".sheet-tabs.tabs")) {
        const initial = this.tabGroups?.primary ?? "attributes";
        this.changeTab(initial, "primary", { force: true, updatePosition: false });
      }
      content.querySelectorAll(".ability-score .attribute-name a, .ability-score .attribute-name").forEach((node) => {
        const score = node.closest(".ability-score")?.dataset?.score;
        if (score) {
          node.addEventListener("click", (ev) => {
            ev.preventDefault();
            this.document.rollCheck?.(score, { event: ev });
          });
        }
      });
      content.querySelectorAll(".skills .attribute-name a, .skills .attribute-name").forEach((node) => {
        const skillsData = node.closest(".item")?.dataset?.skills;
        if (skillsData != null) {
          node.addEventListener("click", (ev) => {
            ev.preventDefault();
            this.document.rollSkills?.(skillsData, { event: ev });
          });
        }
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
      if (target.classList.contains("charges") || target.closest(".charges")) {
        const itemId = target.closest(".item")?.dataset?.itemId;
        const item = this.document.items.get(itemId);
        if (item) {
          const val = parseInt(target.value, 10);
          await item.update({ "system.charges.value": isNaN(val) ? 0 : val });
        }
        return;
      }
      await super._onChangeForm?.(formConfig, event);
    }
}
