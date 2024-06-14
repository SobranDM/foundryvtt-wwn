import { WwnActor } from "./entity.js";
import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from "../effects.mjs";
import { WwnEntityTweaks } from "../dialog/entity-tweaks.js";

export class WwnActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
  }
  /* -------------------------------------------- */

  getData() {
    const data = foundry.utils.deepClone(super.getData().data);
    data.owner = this.actor.isOwner;
    data.editable = this.actor.sheet.isEditable;

    data.config = CONFIG.WWN;
    data.isNew = this.actor.isNew();

    if (this.actor.type != "faction") {
      // Prepare active effects
      data.effects = prepareActiveEffectCategories(this.actor.effects);
    }

    return data;
  }

  _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item"),
      item = this.actor.items.get(li.data("item-id")),
      description = item.system.enrichedDescription;
    // Toggle summary
    if (li.hasClass("expanded")) {
      let summary = li.parents(".item-entry").children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      // Add item tags
      let div = $(
        `<div class="item-summary"><ol class="tag-list">${item.getTags()}</ol><div>${description}</div></div>`
      );
      li.parents(".item-entry").append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }

  async _onSpellChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (event.target.dataset.field == "cast") {
      return item.update({ "system.cast": parseInt(event.target.value) });
    } else if (event.target.dataset.field == "memorize") {
      return item.update({
        "system.memorized": parseInt(event.target.value),
      });
    }
  }

  async _resetSpells(event) {
    if (this.actor.system.spells.leveledSlots) {
      const spells = this.actor.items.filter(item => item.type === "spell");
      await spells.forEach(spell => {
        spell.update({
          "system.cast": spell.system.memorized
        });
      });
    } else {
      this.actor.update({
        "system.spells.perDay.value": 0
      });
    }
  };

  async _resetEffort(event) {
    const arts = this.actor.items.filter(item => item.type === "art");
    await arts.forEach(art => {
      const itemId = art.id;
      const item = this.actor.items.get(itemId);
      item.update({ "system.effort": 0 });
    });
  }

  async _onEffortChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "system.effort": parseInt(event.target.value) });
  }

  async _onArtSourceChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "system.source": event.target.value });
  }

  async _onArtTimeChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "system.time": event.target.value });
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Active Effect management
    html
      .find(".effect-control")
      .click((ev) => onManageActiveEffect(ev, this.actor));

    // Item summaries
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
      // Add primary skills from compendium
      let skillPack = game.packs.get("wwn.skills");
      let toAdd = await skillPack.getDocuments();
      let primarySkills = toAdd
        .filter((i) => i.system.secondary == false)
        .map((item) => item.toObject());
      await Item.createDocuments(primarySkills, { parent: this.actor });
    });
    html.find(".item .item-rollable .item-image").click(async (ev) => {
      const itemId = $(ev.currentTarget).parents(".item");
      const item = this.document.items.get(itemId.data("itemId"));
      if (item.type == "weapon") {
        if (this.actor.type === "monster") {
          await item.update({
            system: { counter: { value: item.system.counter.value - 1 } }
          })
        }
        item.rollWeapon({ skipDialog: ev.ctrlKey });
      } else if (item.type == "spell") {
        item.spendSpell({ skipDialog: ev.ctrlKey });
      } else if (item.type == "art") {
        item.spendArt({ skipDialogue: ev.ctrlKey, itemId: itemId });
      } else if (item.type == "skill") {
        item.rollSkill({ skipDialog: ev.ctrlKey });
      } else {
        item.roll({ skipDialog: ev.ctrlKey });
      }
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
      const candidateItems = {};
      const gameGen = game?.release?.generation;

      for (const e of game.packs) {
        if (gameGen <= 10 && e.metadata.private == true) {
          continue;
        } else if (gameGen > 10 && e.metadata.ownership.PLAYER == "NONE") {
          continue;
        }
        const items = (await e.getDocuments()).filter((i) => i.type == itemType);
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
                  const itemNameToAdd = ((
                    html.find("#itemList")[0])).value;
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

      // item creation helper func
      let createItem = function (type, name = `New ${type.capitalize()}`, data = {}) {

        const itemData = {
          name: name ? name : `New ${type.capitalize()}`,
          type: type,
          data,
        };
        delete itemData.data["type"];
        return itemData;
      };

      // Getting back to main logic
      if (type == "choice") {
        this._chooseItemType().then((dialogInput) => {
          const itemData = createItem(dialogInput.type, dialogInput.name);
          this.actor.createEmbeddedDocuments("Item", [itemData]);
        });
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
      let extraFields = "";
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
      const dialogContent = await renderTemplate(dialogTemplate, dialogData);
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
                //let data = foundry.utils.deepClone(header.dataset);
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
                  data.type = armorType
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



    });

    html
      .find(".artEffort input")
      .click((ev) => ev.target.select())
      .change(this._onEffortChange.bind(this));

    html
      .find(".artSource input")
      .click((ev) => ev.target.select())
      .change(this._onArtSourceChange.bind(this));

    html
      .find(".artTime input")
      .click((ev) => ev.target.select())
      .change(this._onArtTimeChange.bind(this));

    html.find(".check-field .check.hd-roll").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollHitDice({ event: event });
    });

    html.find(".morale-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollMorale({ event: event });
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html
      .find(".memorize input")
      .click((ev) => ev.target.select())
      .change(this._onSpellChange.bind(this));


    html.find(".slot-reset").click((ev) => {
      this._resetSpells(ev);
    });

    html.find(".effort-reset").click((ev) => {
      this._resetEffort(ev);
    });

    /** Attempt to copy input focus */
    if (this.isEditable) {
      const inputs = html.find("input");
      inputs.focus(ev => ev.currentTarget.select());
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

  _onConfigureActor(event) {
    event.preventDefault();
    new WwnEntityTweaks(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Extend and override the sheet header buttons
   * @override
   */
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();

    // Token Configuration
    const canConfigure = game.user.isGM || this.actor.isOwner;
    if (this.options.editable && canConfigure) {
      buttons = [
        {
          label: game.i18n.localize("WWN.dialog.tweaks"),
          class: "configure-actor",
          icon: "fas fa-code",
          onclick: (ev) => this._onConfigureActor(ev),
        },
      ].concat(buttons);
    }
    return buttons;
  }
}
