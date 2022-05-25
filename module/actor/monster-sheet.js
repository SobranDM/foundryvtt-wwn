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
  let [weapons, armors, items, arts, spells, abilities] = this.actor.data.items.reduce(
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
      else if (item.type === "ability") arr [5].push(item);
      return arr;
    },
    [[], [], [], [], [], []]
  );
  // Sort spells by level
  var sortedSpells = {};
  var slots = {};
  for (var i = 0; i < spells.length; i++) {
    let lvl = spells[i].data.data.lvl;
    if (!sortedSpells[lvl]) sortedSpells[lvl] = [];
    if (!slots[lvl]) slots[lvl] = 0;
    slots[lvl] += spells[i].data.data.memorized;
    sortedSpells[lvl].push(spells[i]);
  }

  // Sort each level
  Object.keys(sortedSpells).forEach(level => {
    let list = insertionSort(sortedSpells[level], "name");
    list = insertionSort(list, "data.data.class");
    sortedSpells[level] = list;
  });

  data.attackPatterns.sort((a, b) => {
    const aName = a.name.toLowerCase(), bName = b.name.toLowerCase();
    return aName > bName ? 1 : bName > aName ? -1 : 0;
  });
  
  data.slots = {
    used: slots,
  };

  // Sort arts by name and then by source
  arts = insertionSort(arts, "name");
  arts = insertionSort(arts, "data.data.source");

  // Assign and return
  data.owned = {
    items: insertionSort(items, "name"),
    armors: insertionSort(armors, "name"),
    abilities: insertionSort(abilities, "name"),
    weapons: insertionSort(weapons, "name"),
    arts: arts
  };
  data.spells = sortedSpells;
}

  /**
   * Monster creation helpers
   */

  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  getData() {
    const data = super.getData();
    // Prepare owned items
    this._prepareItems(data);

    // Settings
    data.config.morale = game.settings.get("wwn", "morale");
    if (!data.data.details.hasOwnProperty('instinctTable')) {
      data.data.details.instinctTable = {
        "table": "",
        "link": ""
      };
      data.data.details.instinctTable.link = TextEditor.enrichHTML(data.data.details.instinctTable.table);
    } else {
      data.data.details.instinctTable.link = TextEditor.enrichHTML(data.data.details.instinctTable.table);
    }
    data.isNew = this.actor.isNew();
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

    let link = "";
    if (data.pack) {
      let tableData = game.packs.get(data.pack).index.filter(el => el._id === data.id);
      link = `@Compendium[${data.pack}.${data.id}]{${tableData[0].name}}`;
    } else {
      link = `@RollTable[${data.id}]`;
    }
    this.actor.update({ "data.details.instinctTable.table": link });
  }

  /* -------------------------------------------- */

  async _chooseItemType(choices = ["weapon", "armor", "shield", "item", "ability"]) {
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
    const weapons = this.actor.data.items.filter(i => i.type === 'weapon');
    for (let wp of weapons) {
      const item = this.actor.items.get(wp.id);
      await item.update({
        data: {
          counter: {
            value: parseInt(wp.data.data.counter.max),
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
        "data.counter.value": parseInt(event.target.value),
      });
    } else if (event.target.dataset.field == "max") {
      return item.update({
        "data.counter.max": parseInt(event.target.value),
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
        data: {
          prepared: !item.data.data.prepared,
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

    html.find(".item-create").click((event) => {
      event.preventDefault();
      const header = event.currentTarget;
      const type = header.dataset.type;

      // item creation helper func
      let createItem = function (type, name = `New ${type.capitalize()}`) {
        const itemData = {
          name: name ? name : `New ${type.capitalize()}`,
          type: type,
          data: duplicate(header.dataset),
        };
        delete itemData.data["type"];
        return itemData;
      };

      // Getting back to main logic
      if (type == "choice") {
        const choices = header.dataset.choices.split(",");
        this._chooseItemType(choices).then((dialogInput) => {
          const itemData = createItem(dialogInput.type, dialogInput.name);
          this.actor.createEmbeddedDocuments("Item", [itemData], {});
        });
        return;
      }
      const itemData = createItem(type);
      return this.actor.createEmbeddedDocuments("Item", [itemData], {});
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
      let currentColor = item.data.data.pattern;
      let colors = Object.keys(CONFIG.WWN.colors);
      let index = colors.indexOf(currentColor);
      if (index + 1 == colors.length) {
        index = 0;
      } else {
        index++;
      }
      item.update({
        "data.pattern": colors[index]
      })
    });
  }
}
