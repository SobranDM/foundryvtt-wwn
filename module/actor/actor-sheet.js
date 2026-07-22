import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from "../helpers/effects.mjs";
import {
  applyLegacySheetAliases,
  remapLegacySubmitData,
} from "../helpers/sheet-legacy-bridge.mjs";
import { applySubtypeDefaults, POWER_SUBTYPES } from "../config/power-subtypes.mjs";
import { syncPowerTransferEffects } from "../helpers/power-effects.mjs";
import { reloadWeapon } from "../helpers/ammo.mjs";
import { isPc, isNpc } from "../helpers/actor-types.mjs";

export class WwnActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
  }
  /* -------------------------------------------- */

  getData() {
    const context = super.getData();
    const data = foundry.utils.deepClone(context.data);
    // Document#toObject(false) only keeps schema fields. Rebuild a plain
    // snapshot from the live prepared model so derived values (combat.ab,
    // hitDice.display, combat.ac, …) reach the sheet without mutating the actor.
    data.system = foundry.utils.expandObject(
      foundry.utils.flattenObject(this.actor.system)
    );
    data.owner = this.actor.isOwner;
    data.editable = this.actor.sheet.isEditable;

    data.config = CONFIG.WWN;
    data.isNew = this.actor.isNew?.() ?? false;
    data.separateRangedAC = game.settings.get("wwn", "separateRangedAC");
    data.showMovement = game.settings.get("wwn", "showMovement");

    if (data.system) {
      applyLegacySheetAliases(data.system, {
        separateRangedAC: data.separateRangedAC,
      });
    }

    if (this.actor.type != "faction") {
      // Prepare active effects
      data.effects = prepareActiveEffectCategories(this.actor.effects);
    }

    return data;
  }

  /** @override */
  _getSubmitData(updateData = {}) {
    const data = super._getSubmitData(updateData);
    return remapLegacySubmitData(data);
  }

  _onItemSummary(event) {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).parents(".item");
    const item = this.actor.items.get(li.data("itemId"));
    if (!item) return;

    // Toggle summary
    if (li.hasClass("expanded")) {
      const summary = li.parents(".item-entry").children(".item-summary");
      summary.slideUp(200, () => summary.remove());
      li.removeClass("expanded");
      return;
    }

    li.addClass("expanded");
    void this._expandItemSummary(li, item);
  }

  /**
   * @param {JQuery} li
   * @param {Item} item
   */
  async _expandItemSummary(li, item) {
    try {
      const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        item.system.description ?? "",
        { relativeTo: item, secrets: this.actor.isOwner }
      );
      const div = $(
        `<div class="item-summary"><ol class="tag-list">${item.getTags()}</ol><div class="item-summary-body">${description || ""}</div></div>`
      );
      li.parent(".item-entry").append(div.hide());
      div.slideDown(200);
    } catch (err) {
      li.removeClass("expanded");
      console.error("WWN | Failed to expand item summary", err);
    }
  }

  async _refreshPowers(scope) {
    const { refreshPowers } = await import("../helpers/power-refresh.mjs");
    await refreshPowers(this.actor, scope);
  }

  async _pickPowerSubtype() {
    const subtypes = Object.entries(POWER_SUBTYPES).map(([key, cfg]) => ({
      key,
      label: game.i18n.localize(cfg.label),
    }));
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/wwn/templates/dialog/power-subtype-picker.hbs",
      { subtypes }
    );
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      new Dialog({
        title: game.i18n.localize("WWN.Power.SubType"),
        content,
        buttons: {
          ok: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("WWN.Ok"),
            callback: (html) => {
              const root = html?.[0] ?? html;
              const select = root?.querySelector?.('[name="subType"]');
              finish(select?.value ?? html?.find?.('[name="subType"]').val() ?? null);
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("WWN.Cancel"),
            callback: () => finish(null),
          },
        },
        default: "ok",
        close: () => finish(null),
      }).render(true);
    });
  }

  async _createPowerItem({ name, subType } = {}) {
    let chosen = subType;
    if (!chosen) {
      chosen = await this._pickPowerSubtype();
      if (!chosen) return;
    }
    const system = applySubtypeDefaults(chosen, {});
    return this.actor.createEmbeddedDocuments("Item", [
      {
        name: name || game.i18n.localize(POWER_SUBTYPES[chosen]?.label ?? "WWN.Power.AddPower"),
        type: "power",
        system,
      },
    ]);
  }

  async _togglePrepared(item) {
    if (item.type !== "power" || item.system.subType !== "spell") return;
    const next = !item.system.prepared;
    if (next && this.isPc(actor)) {
      const prepared = this.actor.system.casting?.prepared ?? {};
      const current = prepared.value ?? 0;
      const max = prepared.max ?? 0;
      if (current >= max) {
        return ui.notifications.warn(game.i18n.localize("WWN.Power.PreparedAtMax"));
      }
    }
    return item.update({ "system.prepared": next });
  }

  async _toggleInstalled(item) {
    if (item.type !== "power") return;
    const installing = !item.system.installed;
    await item.update({ "system.installed": installing });
    await syncPowerTransferEffects(item);
    const cost = Number(item.system.alienationCost) || 0;
    if (cost && this.actor.system.alienation) {
      const delta = installing ? cost : -cost;
      const value = Math.max((this.actor.system.alienation.value ?? 0) + delta, 0);
      await this.actor.update({ "system.alienation.value": value });
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Active Effect management
    html
      .find(".effect-control")
      .click((ev) => onManageActiveEffect(ev, this.actor));

    // Item summaries (name click → drawer only; chat via image / eye)
    html
      .find(".item .item-name h4")
      .click((event) => this._onItemSummary(event));

    html.find(".item .item-controls .item-show").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.show();
    });

    html.find(".saving-throw .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let save = element.parentElement.parentElement.dataset.save;
      actorObject.rollSave(save, { event: ev });
    });
    html.find(".skill-roll").click(async (ev) => {
      const itemId = $(ev.currentTarget).parents(".item");
      const item = this.document.items.get(itemId.data("itemId"));
      if (item.type == "skill") {
        item.rollSkill({ skipDialog: ev.ctrlKey });
      }
    });
    html.find(".add-skills").click(async () => {
      // Add primary skills from the Abilities pack (Skills folder only)
      let skillPack = game.packs.get("wwn.abilities");
      let toAdd = await skillPack.getDocuments();
      let primarySkills = toAdd
        .filter((i) => i.type === "skill" && i.system.secondary == false)
        .map((item) => item.toObject());
      await Item.createDocuments(primarySkills, { parent: this.actor });
    });
    html.find(".item .item-rollable .item-image").click(async (ev) => {
      const itemId = $(ev.currentTarget).parents(".item");
      const item = this.document.items.get(itemId.data("itemId"));
      if (item.type == "weapon") {
        if (this.isNpc(actor)) {
          await item.update({
            system: { counter: { value: item.system.counter.value - 1 } },
          });
        }
        item.rollWeapon({ skipDialog: ev.ctrlKey });
      } else if (item.type == "skill") {
        item.rollSkill({ skipDialog: ev.ctrlKey });
      } else {
        item.roll({ skipDialog: ev.ctrlKey });
      }
    });

    html.find(".item-prep").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (item) await this._togglePrepared(item);
    });

    html.find(".item-install").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (item) await this._toggleInstalled(item);
    });

    html.find(".power-activate").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item?.activatePower({ skipDialog: ev.ctrlKey });
    });

    html.find(".power-deactivate").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item?.deactivatePower();
    });

    html.find(".power-damage").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item?.rollPowerDamage();
    });

    html.find(".power-refresh-scene").click(async (ev) => {
      ev.preventDefault();
      await this._refreshPowers("scene");
    });

    html.find(".power-refresh-day").click(async (ev) => {
      ev.preventDefault();
      await this._refreshPowers("day");
    });

    html.find("[data-item-field]").change(async (ev) => {
      const input = ev.currentTarget;
      const li = input.closest(".item");
      if (!li) return;
      const item = this.actor.items.get(li.dataset.itemId);
      if (!item) return;
      const field = input.dataset.itemField;
      const value =
        input.dataset.dtype === "Number" ? Number(input.value) : input.value;
      await item.update({ [field]: value });
    });

    // Reload magazine weapons
    html.find(".item-reload").click(async (ev) => {
      ev.preventDefault();
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item?.type === "weapon") await this._reloadWeapon(item);
    });

    html.find(".attack a").click((ev) => {
      let actorObject = this.actor;
      let element = event.currentTarget;
      let attack = element.parentElement.parentElement.dataset.attack;

      const rollData = {
        actor: this,
        roll: {},
      };
      actorObject.targetAttack(rollData, attack, {
        type: attack,
        skipDialog: ev.ctrlKey,
      });
    });

    html.find(".item-search").click(async (event) => {
      event.preventDefault();
      const header = event.currentTarget;
      const itemType = header.dataset.type;
      const subType = header.dataset.subtype;
      const candidateItems = {};
      const gameGen = game?.release?.generation;

      for (const e of game.packs) {
        if (gameGen <= 10 && e.metadata.private == true) {
          continue;
        } else if (gameGen > 10 && e.metadata.ownership.PLAYER == "NONE") {
          continue;
        }
        const items = (await e.getDocuments()).filter((i) => {
          if (i.type !== itemType) return false;
          if (itemType === "power" && subType) {
            return i.system?.subType === subType;
          }
          return true;
        });
        if (items.length) {
          for (const ci of items.map((item) => item.toObject())) {
            candidateItems[ci.name] = ci;
          }
        }
      }

      if (Object.keys(candidateItems).length) {
        let itemOptions = "";
        const keys = Object.keys(candidateItems);
        const sortedNames = keys.sort();
        for (const label of sortedNames) {
          const cand = candidateItems[label];
          itemOptions += `<option value='${label}'>${cand.name}</option>`;
        }
        const dialogTemplate = `
        <div class="flex flex-col">
          <h1> Select ${itemType} to add </h1>
          <div class="flex flexrow">
            <select id="itemList"
            class="">
            ${itemOptions}
            </select>
          </div>
        </div>
        `;
        const popUpDialog = new Dialog(
          {
            title: `Add ${itemType}`,
            content: dialogTemplate,
            buttons: {
              addItem: {
                label: `Add ${itemType}`,
                callback: async (html) => {
                  const itemNameToAdd = html.find("#itemList")[0].value;
                  const toAdd = await candidateItems[itemNameToAdd];
                  await this.actor.createEmbeddedDocuments("Item", [{ ...toAdd }], {});
                },
              },
              close: {
                label: "Close",
              },
            },
            default: "addItem",
          },
          {
            failCallback: () => {
              return;
            },
          }
        );
        const s = popUpDialog.render(true);
        if (s instanceof Promise) await s;
      } else {
        ui.notifications?.info("Could not find any items in the compendium");
      }
    });

    html.find(".item-create").click(async (event) => {
      event.preventDefault();
      const header = event.currentTarget;
      const type = header.dataset.type;
      const subType = header.dataset.subtype;

      let createItem = function (type, name = `New ${type.capitalize()}`, data = {}) {
        const itemData = {
          name: name ? name : `New ${type.capitalize()}`,
          type: type,
          system: data,
        };
        return itemData;
      };

      if (type == "choice") {
        this._chooseItemType().then((dialogInput) => {
          const itemData = createItem(dialogInput.type, dialogInput.name);
          this.actor.createEmbeddedDocuments("Item", [itemData]);
        });
        return;
      }

      if (type === "power") {
        await this._createPowerItem({ subType });
        return;
      }

      if (type === "classEdge" || type === "focus") {
        await this.actor.createEmbeddedDocuments("Item", [
          createItem(type, `New ${type === "classEdge" ? "Class" : "Focus"}`),
        ]);
        return;
      }

      let dialogData = {
        name: `New ${type.capitalize()}`,
        type: type,
        armor: false,
        weapon: false,
        consumable: false,
        treasure: false,
        item: false,
      };
      if (type == "armor") {
        dialogData.armor = true;
        dialogData.item = true;
      } else if (type == "weapon") {
        dialogData.weapon = true;
        dialogData.item = true;
      } else if (type == "item") {
        dialogData.item = true;
        if ("consumable" in header.dataset) {
          dialogData.consumable = true;
        } else if ("treasure" in header.dataset) {
          dialogData.treasure = true;
        }
      }
      const dialogTemplate = "systems/wwn/templates/items/dialogs/new-item.html";
      const dialogContent = await foundry.applications.handlebars.renderTemplate(
        dialogTemplate,
        dialogData
      );
      const popUpDialog = new Dialog(
        {
          title: `Add ${type}`,
          content: dialogContent,
          buttons: {
            addItem: {
              label: `Add ${type}`,
              callback: async (html) => {
                const itemNameToAdd = html.find("#name")?.val();
                const enc = html.find("#encumbrance")?.val();
                const price = html.find("#price")?.val();
                const qty = html.find("#quantity")?.val();
                const location = html.find("#location")?.val();
                let data = {
                  weight: Number(enc),
                  price: Number(price),
                  quantity: Number(qty),
                };
                if (location) {
                  if (location == "stowed") {
                    data.stowed = true;
                  } else if (location == "equipped") {
                    data.equipped = true;
                  }
                }
                if (type == "weapon") {
                  const dmg = html.find("#damage")?.val();
                  const shockDmg = html.find("#shock-dgm")?.val();
                  const shockAc = html.find("#shock-ac")?.val();
                  const weaponType = html.find("#weaponType")?.val();
                  data.damage = dmg;
                  data.shock = {};
                  data.shock.damage = shockDmg;
                  data.shock.ac = shockAc;
                  if (weaponType == "melee" || weaponType == "both") {
                    data.melee = true;
                  } else if (weaponType == "ranged" || weaponType == "both") {
                    data.missile = true;
                  }
                } else if (type == "armor") {
                  const aac = Number(html.find("#aac")?.val());
                  const armorType = html.find("#armorType")?.val();
                  data.aac = { value: aac, mod: 0 };
                  data.type = armorType;
                } else if (type == "item") {
                  if (dialogData.consumable) {
                    data.charges = {};
                    const uses = html.find("#charges-val")?.val();
                    const usesMax = html.find("#charges-max")?.val();
                    data.charges.value = Number(uses);
                    data.charges.max = Number(usesMax);
                  } else if (dialogData.treasure) {
                    data.treasure = true;
                  }
                }
                const itemData = createItem(type, itemNameToAdd, data);
                this.actor.createEmbeddedDocuments("Item", [itemData]);
              },
            },
            close: {
              label: "Cancel",
            },
          },
          default: "addItem",
        },
        {
          failCallback: () => {
            return;
          },
        }
      );
      const s = popUpDialog.render(true);
      if (s instanceof Promise) await s;
    });

    html.find(".hd-roll").click((ev) => {
      ev.preventDefault();
      this.actor.rollHitDice({ event: ev });
    });

    html.find(".morale-check").click((ev) => {
      ev.preventDefault();
      this.actor.rollMorale({ event: ev });
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    /** Attempt to copy input focus */
    if (this.isEditable) {
      const inputs = html.find("input");
      inputs.focus((ev) => ev.currentTarget.select());
    }
  }

  async _onResize(event) {
    super._onResize(event);

    let html = $(this.form);
    let resizable = html.find(".resizable");
    if (resizable.length == 0) {
      return;
    }
    // Resize divs
    resizable.each((_, el) => {
      let heightDelta = this.position.height - this.options.height;
      el.style.height = `${heightDelta + parseInt(el.dataset.baseSize)}px`;
    });
    // Resize editors
    let editors = html.find(".editor");
    editors.each((id, editor) => {
      let container = editor.closest(".resizable-editor");
      if (container) {
        let heightDelta = this.position.height - this.options.height;
        editor.style.height = `${heightDelta + parseInt(container.dataset.editorSize)
          }px`;
      }
    });
  }

  /**
   * Extend and override the sheet header buttons
   * @override
   */
  _getHeaderButtons() {
    return super._getHeaderButtons();
  }

  /**
   * Reload a magazine weapon from linked ammo.
   * @param {Item} weapon
   */
  async _reloadWeapon(weapon) {
    await reloadWeapon(weapon);
  }
}
