import { WwnActorSheet } from "./actor-sheet.js";
import { preparePowersTabContext } from "../helpers/power-sections.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class WwnActorSheetMonster extends WwnActorSheet {
  constructor(...args) {
    super(...args);
  }

  /* -------------------------------------------- */

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wwn", "sheet", "monster", "actor"],
      template: "systems/wwn/templates/actors/monster-sheet.html",
      width: 730,
      height: 625,
      resizable: false,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
    });
  }

  /**
   * Organize and classify Owned Items for Monster sheets
   * @private
   */
  _prepareItems(data) {
    data.attackPatterns = [];
    let [weapons, armors, items] = this.actor.items.reduce(
      (arr, item) => {
        if (item.type === "weapon") {
          data.attackPatterns.push(item);
          arr[0].push(item);
          return arr;
        }
        if (item.type === "armor") arr[1].push(item);
        else if (item.type === "item") arr[2].push(item);
        return arr;
      },
      [[], [], []]
    );

    data.attackPatterns.sort((a, b) => {
      const aName = a.name.toLowerCase(),
        bName = b.name.toLowerCase();
      return aName > bName ? 1 : bName > aName ? -1 : 0;
    });

    data.owned = {
      items: items.sort((a, b) => (a.name > b.name ? 1 : -1)),
      armors: armors.sort((a, b) => (a.name > b.name ? 1 : -1)),
      weapons: weapons.sort((a, b) => (a.name > b.name ? 1 : -1)),
    };

    preparePowersTabContext(data, this.actor);
  }

  async getData() {
    const data = super.getData();
    this._prepareItems(data);

    data.config.morale = game.settings.get("wwn", "morale");
    data.config.useTrauma = game.settings.get("wwn", "useTrauma");

    // Schema stores a RollTable UUID (or null); sheet still needs enriched HTML for display.
    const instinctUuid = data.system.details?.instinctTable;
    let instinctLink = "";
    if (typeof instinctUuid === "string" && instinctUuid.trim()) {
      instinctLink = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        `@UUID[${instinctUuid.trim()}]`,
        { async: true }
      );
    } else if (instinctUuid && typeof instinctUuid === "object" && instinctUuid.table) {
      // Legacy leftover shape before DocumentUUIDField
      instinctLink = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        String(instinctUuid.table),
        { async: true }
      );
    }
    data.instinctTableLink = instinctLink;

    data.isNew = this.actor.isNew?.() ?? false;

    data.enrichedBiography =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.object.system.biography ?? this.object.system.notes ?? ""
      );

    return data;
  }

  async _onDrop(event) {
    super._onDrop(event);
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (data.type !== "RollTable") return;
    } catch (err) {
      return false;
    }
    const uuid = data.uuid ?? (data.id ? `RollTable.${data.id}` : null);
    if (!uuid) return false;
    this.actor.update({ "system.details.instinctTable": uuid });
  }

  /* -------------------------------------------- */

  async _chooseItemType(
    choices = {
      weapon: "weapon",
      armor: "armor",
      shield: "shield",
      item: "item",
      ability: "ability",
    }
  ) {
    let templateData = { types: choices },
      dlg = await foundry.applications.handlebars.renderTemplate(
        "systems/wwn/templates/items/entity-create.html",
        templateData
      );
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("WWN.dialog.createItem"),
        content: dlg,
        buttons: {
          ok: {
            label: game.i18n.localize("WWN.Ok"),
            icon: '<i class="fas fa-check"></i>',
            callback: (html) => {
              resolve({
                type: html.find('select[name="type"]').val(),
                name: html.find('input[name="name"]').val(),
              });
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("WWN.Cancel"),
          },
        },
        default: "ok",
      }).render(true);
    });
  }

  async _resetCounters(_event) {
    const weapons = this.actor.items.filter((i) => i.type === "weapon");
    for (let wp of weapons) {
      const item = this.actor.items.get(wp.id);
      await item.update({
        system: {
          counter: {
            value: parseInt(wp.system.counter.max),
          },
        },
      });
    }
  }

  async _onCountChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (event.target.dataset.field == "value") {
      return item.update({
        "system.counter.value": parseInt(event.target.value),
      });
    } else if (event.target.dataset.field == "max") {
      return item.update({
        "system.counter.max": parseInt(event.target.value),
      });
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".instinct-check a").click((_ev) => {
      this.actor.rollInstinct({ event });
    });

    html.find(".reaction-check a").click((_ev) => {
      this.actor.rollReaction({ event });
    });

    html.find(".appearing-check a").click((ev) => {
      let check = $(ev.currentTarget).closest(".check-field").data("check");
      this.actor.rollAppearing({ event, check });
    });

    html.find(".monster-skill-check a").click((ev) => {
      let check = $(ev.currentTarget).closest(".check-field").data("check");
      this.actor.rollMonsterSkill({ event, check });
    });

    if (!this.options.editable) return;

    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    html.find(".item-delete").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    html.find(".item-reset").click((ev) => {
      this._resetCounters(ev);
    });

    html
      .find(".counter input")
      .click((ev) => ev.target.select())
      .change(this._onCountChange.bind(this));

    html.find(".hp-roll").click((_ev) => {
      this.actor.rollHP({ event });
    });

    html.find(".item-pattern").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      let currentColor = item.system.pattern;
      let colors = Object.keys(CONFIG.WWN.colors);
      let index = colors.indexOf(currentColor);
      if (index + 1 == colors.length) {
        index = 0;
      } else {
        index++;
      }
      item.update({
        "system.pattern": colors[index],
      });
    });
  }
}
