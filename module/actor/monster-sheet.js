import { WwnActor } from "./entity.js";
import { WwnActorSheet } from "./actor-sheet.js";
import insertionSort from "../insertionSort.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class WwnActorSheetMonster extends WwnActorSheet {
  constructor(...args) {
    super(...args);
  }

  /* -------------------------------------------- */

  /**
   * Extend and override the default options used by the 5e Actor Sheet
   * @returns {Object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wwn", "sheet", "monster", "actor"],
      template: "systems/wwn/templates/actors/monster-sheet.html",
      width: 730,
      height: 625,
      resizable: false,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
    });
  }
  /**
     * Organize and classify Owned Items for Character sheets
     * @private
     */
  _prepareItems(data) {
    // Partition items by category
    data.attackPatterns = [];
    let [weapons, armors, items, arts, spells, abilities, foci] = this.actor.items.reduce(
      (arr, item) => {
        // Grab attack groups
        if (["weapon"].includes(item.type)) {
          data.attackPatterns.push(item);
          return arr;
        }
        // Classify items into types
        if (item.type === "weapon") arr[0].push(item);
        else if (item.type === "armor") arr[1].push(item);
        else if (item.type === "item") arr[2].push(item);
        else if (item.type === "art") arr[3].push(item);
        else if (item.type === "spell") arr[4].push(item);
        else if (item.type === "ability") arr[5].push(item);
        else if (item.type === "focus") arr[6].push(item);
        return arr;
      },
      [[], [], [], [], [], [], []]
    );
    // Sort spells by level
    let sortedSpells = {};
    let slots = {};
    for (var i = 0; i < spells.length; i++) {
      let lvl = spells[i].system.lvl;
      if (!sortedSpells[lvl]) sortedSpells[lvl] = [];
      if (!slots[lvl]) slots[lvl] = 0;
      slots[lvl] += spells[i].system.memorized;
      sortedSpells[lvl].push(spells[i]);
    }

    // Sort each level
    Object.keys(sortedSpells).forEach((level) => {
      sortedSpells[level].sort((a, b) => a.name > b.name ? 1 : -1);
    });

    // Sort arts by class
    let sortedArts = {};
    for (var i = 0; i < arts.length; i++) {
      let source = arts[i].system.source;
      if (!sortedArts[source]) sortedArts[source] = [];
      sortedArts[source].push(arts[i]);
    }

    // Sort each class
    Object.keys(sortedArts).forEach(source => {
      sortedArts[source].sort((a, b) => a.name > b.name ? 1 : -1);
    });

    data.attackPatterns.sort((a, b) => {
      const aName = a.name.toLowerCase(), bName = b.name.toLowerCase();
      return aName > bName ? 1 : bName > aName ? -1 : 0;
    });

    data.slots = {
      used: slots,
    };

    // Assign and return
    data.owned = {
      items: items.sort((a, b) => a.name > b.name ? 1 : -1),
      armors: armors.sort((a, b) => a.name > b.name ? 1 : -1),
      abilities: abilities.sort((a, b) => a.name > b.name ? 1 : -1),
      weapons: weapons.sort((a, b) => a.name > b.name ? 1 : -1),
      arts: sortedArts,
      spells: sortedSpells,
      foci: foci.sort((a, b) => a.name > b.name ? 1 : -1)
    };
  }

  /**
   * Monster creation helpers
   */

  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  async getData() {
    const data = super.getData();
    // Prepare owned items
    this._prepareItems(data);

    // Settings
    data.config.morale = game.settings.get("wwn", "morale");
    if (!data.system.details.hasOwnProperty('instinctTable')) {
      data.system.details.instinctTable = {
        "table": "",
        "link": ""
      };
      data.system.details.instinctTable.link = await TextEditor.enrichHTML(data.system.details.instinctTable.table, { async: true });
    } else {
      data.system.details.instinctTable.link = await TextEditor.enrichHTML(data.system.details.instinctTable.table, { async: true });
    }
    data.isNew = this.actor.isNew();

    data.enrichedBiography = await TextEditor.enrichHTML(
      this.object.system.details.biography,
      { async: true }
    );

    return data;
  }


  async _onDrop(event) {
    super._onDrop(event);
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
      if (data.type !== "RollTable") return;
    } catch (err) {
      return false;
    }
    let link = `@UUID[${data.uuid}]`;
    this.actor.update({ "system.details.instinctTable.table": link });
  }

  /* -------------------------------------------- */

  async _chooseItemType(choices = {
    weapon: "weapon",
    armor: "armor",
    shield: "shield",
    item: "item",
    ability: "ability"
  }) {
    let templateData = { types: choices },
      dlg = await renderTemplate(
        "systems/wwn/templates/items/entity-create.html",
        templateData
      );
    //Create Dialog window
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

  async _resetCounters(event) {
    const weapons = this.actor.items.filter(i => i.type === 'weapon');
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

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".instinct-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollInstinct({ event: event });
    });

    html.find(".reaction-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollReaction({ event: event });
    });

    html.find(".appearing-check a").click((ev) => {
      let actorObject = this.actor;
      let check = $(ev.currentTarget).closest('.check-field').data('check');
      actorObject.rollAppearing({ event: event, check: check });
    });

    html.find(".monster-skill-check a").click((ev) => {
      let actorObject = this.actor;
      let check = $(ev.currentTarget).closest('.check-field').data('check');
      actorObject.rollMonsterSkill({ event: event, check: check });
    });

    html.find(".item-prep").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        system: {
          prepared: !item.system.prepared,
        },
      });
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Update Inventory Item
    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
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

    html.find(".hp-roll").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollHP({ event: event });
    });

    html.find(".item-pattern").click(ev => {
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
        "system.pattern": colors[index]
      })
    });
  }
}
