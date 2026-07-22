import { WwnActorSheet } from "./actor-sheet.js";
import { WwnCharacterModifiers } from "../dialog/character-modifiers.js";
import { WwnAdjustCurrency } from "../dialog/adjust-currency.js";
import { WwnCharacterCreator } from "../dialog/character-creation.js";
import { preparePowersTabContext } from "../helpers/power-sections.mjs";
import { maybeShowClassAssignmentDialog } from "../dialog/class-assignment.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class WwnActorSheetCharacter extends WwnActorSheet {
  constructor(...args) {
    super(...args);
    /** @type {boolean} */
    this._wwnClassAssignmentPrompted = false;
  }

  /* -------------------------------------------- */

  /**
   * Extend and override the default options used by the 5e Actor Sheet
   * @returns {Object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wwn", "sheet", "actor", "character"],
      template: "systems/wwn/templates/actors/character-sheet.html",
      width: 755,
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
   * Organize and classify Owned Items for Character sheets
   * @private
   */
  _prepareItems(data) {
    let [items, weapons, armors, skills] = this.actor.items.reduce(
      (arr, item) => {
        if (item.type === "item" || item.type === "currency") arr[0].push(item);
        else if (item.type === "weapon") arr[1].push(item);
        else if (item.type === "armor") arr[2].push(item);
        else if (item.type === "skill") arr[3].push(item);
        return arr;
      },
      [[], [], [], []]
    );

    const containers = items.filter((item) => item.system.container?.isContainer);
    const containerIds = new Set(containers.map((item) => item.id));

    const itemsToUpdate = [];
    for (const item of this.actor.items) {
      if (item.system.containerId && !containerIds.has(item.system.containerId)) {
        itemsToUpdate.push({
          _id: item.id,
          "system.containerId": "",
        });
      }
      if (item.system.container?.isContainer && item.system.containerId) {
        itemsToUpdate.push({
          _id: item.id,
          "system.containerId": "",
        });
      }
    }

    if (itemsToUpdate.length > 0) {
      this.actor.updateEmbeddedDocuments("Item", itemsToUpdate);
    }

    const primarySkills = skills
      .filter((skill) => !skill.system.secondary)
      .sort((a, b) => (a.name > b.name ? 1 : -1));
    const secondarySkills = skills
      .filter((skill) => skill.system.secondary)
      .sort((a, b) => (a.name > b.name ? 1 : -1));

    data.owned = {
      items: items.sort((a, b) => (a.name > b.name ? 1 : -1)),
      armors: armors.sort((a, b) => (a.name > b.name ? 1 : -1)),
      weapons: weapons.sort((a, b) => (a.name > b.name ? 1 : -1)),
      skills: [...primarySkills, ...secondarySkills],
    };

    preparePowersTabContext(data, this.actor);
  }

  generateScores() {
    new WwnCharacterCreator(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  adjustCurrency() {
    new WwnAdjustCurrency(this.actor, {
      top: this.position.top + 300,
      left: this.position.left + (this.position.width - 200) / 2,
    }).render(true);
  }

  /**
   * Prepare data for rendering the Actor sheet
   */
  async getData() {
    const data = super.getData();
    this._prepareItems(data);

    data.config.initiative = game.settings.get("wwn", "initiative") != "group";
    data.config.showMovement = game.settings.get("wwn", "showMovement");
    data.config.currencyTypes = game.settings.get("wwn", "currencyTypes");
    data.config.replaceStrainWithWounds = game.settings.get("wwn", "replaceStrainWithWounds");
    data.config.xpPerChar = game.settings.get("wwn", "xpPerChar");
    data.config.medRange = game.settings.get("wwn", "medRange");
    data.config.useTrauma = game.settings.get("wwn", "useTrauma");

    data.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.object.system.biography ?? ""
    );
    data.enrichedNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.object.system.details?.notes ?? ""
    );
    return data;
  }

  async _chooseLang() {
    const languages = game.settings.get("wwn", "languageList");
    const choices = languages.split(",");

    let templateData = { choices: choices },
      dlg = await foundry.applications.handlebars.renderTemplate(
        "systems/wwn/templates/actors/dialogs/lang-create.html",
        templateData
      );
    return new Promise((resolve) => {
      new Dialog({
        title: "",
        content: dlg,
        buttons: {
          ok: {
            label: game.i18n.localize("WWN.Ok"),
            icon: '<i class="fas fa-check"></i>',
            callback: (html) => {
              resolve({
                choice: html.find('select[name="choice"]').val(),
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

  async _chooseItemType(choices = { focus: "focus", ability: "ability" }) {
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

  _onDropItem(event, dragData) {
    if (!event.target.closest(".wwn.sheet.actor")) {
      super._onDropItem(event, dragData);
      return;
    }

    const draggedItem = fromUuidSync(dragData.uuid);
    if (!draggedItem) return;

    const targetElement = event.target.closest(".item");
    if (!targetElement) {
      if (draggedItem.system?.containerId) {
        draggedItem.update({
          "system.containerId": "",
          "system.equipped": false,
          "system.stowed": true,
        });
      }
      super._onDropItem(event, dragData);
      return;
    }

    const targetItemId = targetElement.dataset.itemId;
    if (!targetItemId) {
      if (draggedItem.system?.containerId) {
        draggedItem.update({
          "system.containerId": "",
          "system.equipped": false,
          "system.stowed": true,
        });
      }
      super._onDropItem(event, dragData);
      return;
    }

    const targetItem = this.actor.items.get(targetItemId);
    if (!targetItem || !targetItem.system.container?.isContainer) {
      if (draggedItem.system?.containerId) {
        draggedItem.update({
          "system.containerId": "",
          "system.equipped": false,
          "system.stowed": true,
        });
      }
      super._onDropItem(event, dragData);
      return;
    }

    const allowedTypes = ["item", "weapon", "armor"];
    if (!allowedTypes.includes(draggedItem.type)) {
      super._onDropItem(event, dragData);
      return;
    }

    if (draggedItem.system?.container?.isContainer) {
      super._onDropItem(event, dragData);
      return;
    }

    draggedItem.system &&
      draggedItem.update({
        "system.containerId": targetItemId,
        "system.equipped": false,
        "system.stowed": targetItem.system.equipped || targetItem.system.stowed,
      });

    super._onDropItem(event, dragData);
  }

  async _onContainerItemAdd(item, target) {
    const alreadyExistsInActor = target.parent.items.find((i) => i.id === item.id);
    let latestItem = item;
    if (!alreadyExistsInActor) {
      const newItem = await this._onDropItemCreate([item.toObject()]);
      latestItem = newItem.pop();
    }

    const alreadyExistsInContainer = target.system.itemIds.find((i) => i.id === latestItem.id);
    if (!alreadyExistsInContainer) {
      const newList = [...target.system.itemIds, latestItem.id];
      await target.update({ system: { itemIds: newList } });
      await latestItem.update({ system: { containerId: target.id } });
    }
  }

  _pushLang(table) {
    const data = this.actor.system;
    let update = foundry.utils.duplicate(data[table]);
    let language = game.settings.get("wwn", "languageList");
    let languages = language.split(",");
    this._chooseLang().then((dialogInput) => {
      const name = languages[dialogInput.choice];
      if (update.value) {
        update.value.push(name);
      } else {
        update = { value: [name] };
      }
      let newData = {};
      newData[table] = update;
      return this.actor.update({ system: newData });
    });
  }

  _popLang(table, lang) {
    const data = this.actor.system;
    let update = data[table].value.filter((el) => el != lang);
    let newData = {};
    newData[table] = { value: update };
    return this.actor.update({ system: newData });
  }

  /* -------------------------------------------- */

  async _onQtChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "system.quantity": parseInt(event.target.value) });
  }

  async _onChargeChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({
      "system.charges.value": parseInt(event.target.value),
    });
  }

  _onShowModifiers(event) {
    event.preventDefault();
    new WwnCharacterModifiers(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Activate event listeners using the prepared sheet HTML
   */
  activateListeners(html) {
    super.activateListeners(html);

    if (!this._wwnClassAssignmentPrompted && this.isEditable) {
      this._wwnClassAssignmentPrompted = true;
      queueMicrotask(() => {
        maybeShowClassAssignmentDialog(this.actor).catch((err) => {
          console.error("WWN | Class assignment dialog failed:", err);
        });
      });
    }

    html.find(".ability-score .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let score = element.parentElement.parentElement.dataset.score;
      if (!score) {
        actorObject.rollCheck(score, { event: event });
      }
    });

    html.find(".skills .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let expl = element.parentElement.parentElement.dataset.skills;
      actorObject.rollSkills(expl, { event: event });
    });

    html.find(".inventory .item-titles .item-caret").click((ev) => {
      let items = $(ev.currentTarget.parentElement.parentElement).children(".item-list");
      if (items.css("display") == "none") {
        let el = $(ev.currentTarget).find(".fas.fa-caret-right");
        el.removeClass("fa-caret-right");
        el.addClass("fa-caret-down");
        items.slideDown(200);
      } else {
        let el = $(ev.currentTarget).find(".fas.fa-caret-down");
        el.removeClass("fa-caret-down");
        el.addClass("fa-caret-right");
        items.slideUp(200);
      }
    });

    html.find(".inventory .container-arrow").click(async (ev) => {
      const container = $(ev.currentTarget).closest(".item-entry");
      const itemId = container.find(".item").data("itemId");
      const item = this.actor.items.get(itemId);
      const items = container.find(".container-items");

      if (item && item.system.container.isContainer) {
        const isCurrentlyOpen = item.system.container.isOpen;
        if (!isCurrentlyOpen) {
          items.slideDown(200);
        } else {
          items.slideUp(200);
        }
        await item.update({
          "system.container.isOpen": !isCurrentlyOpen,
        });
      }
    });

    html.find("a[data-action='modifiers']").click((ev) => {
      this._onShowModifiers(ev);
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

    html.find(".item-push").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._pushLang(table);
    });

    html.find(".item-pop").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._popLang(table, $(ev.currentTarget).closest(".item").data("lang"));
    });

    html.find(".item-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        system: {
          equipped: !item.system.equipped,
          stowed: item.system.equipped ? item.system.stowed : false,
        },
      });

      if (item.type === "item" && item.system.container.isContainer) {
        const containedItems = item.actor.items.filter((i) => i.system.containerId === item.id);
        item.actor.updateEmbeddedDocuments(
          "Item",
          containedItems.map((i) => ({
            _id: i.id,
            "system.equipped": false,
            "system.stowed": item.system.equipped || item.system.stowed,
          }))
        );
      }
    });

    html.find(".stow-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        system: {
          equipped: item.system.stowed ? item.system.equipped : false,
          stowed: !item.system.stowed,
        },
      });

      if (item.system.container.isContainer) {
        const containedItems = item.actor.items.filter((i) => i.system.containerId === item.id);
        item.actor.updateEmbeddedDocuments(
          "Item",
          containedItems.map((i) => ({
            _id: i.id,
            "system.equipped": false,
            "system.stowed": item.system.equipped || item.system.stowed,
          }))
        );
      }
    });

    html
      .find(".quantity input")
      .click((ev) => ev.target.select())
      .change(this._onQtChange.bind(this));

    html
      .find(".charges input")
      .click((ev) => ev.target.select())
      .change(this._onChargeChange.bind(this));

    html.find("a[data-action='generate-scores']").click((ev) => {
      this.generateScores(ev);
    });

    html.find("a[data-action='currency-adjust']").click((ev) => {
      this.adjustCurrency(ev);
    });

    html.find(".skill-up").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const skill = this.actor.items.get(li.data("itemId"));
      if (skill.type == "skill") {
        const rank = skill.system.ownedLevel;
        if (rank > 0) {
          const lvl = this.actor.system.details.level;
          if (!game.settings.get("wwn", "noSkillLevelReq")) {
            if (rank == 1 && lvl < 3) {
              ui.notifications?.error("Must be at least level 3 (edit manually to override)");
              return;
            } else if (rank == 2 && lvl < 6) {
              ui.notifications?.error("Must be at least level 6 (edit manually to override)");
              return;
            } else if (rank == 3 && lvl < 9) {
              ui.notifications?.error("Must be at least level 9 (edit manually to override)");
              return;
            } else if (rank > 3) {
              ui.notifications?.error("Cannot auto-level above 4");
              return;
            }
          }
        }
        const flatCost = game.settings.get("wwn", "flatSkillCost");
        const skillCost = flatCost ? 1 : rank + 2;
        const skillPointsAvail = this.actor.system.skills.unspent;
        if (skillCost > skillPointsAvail) {
          ui.notifications.error(
            `Not enough skill points. Have: ${skillPointsAvail}, need: ${skillCost}`
          );
          return;
        } else if (isNaN(skillPointsAvail)) {
          ui.notifications.error(`Unspent skill points not set`);
          return;
        }
        await skill.update({ "system.ownedLevel": rank + 1 });
        const newSkillPoints = skillPointsAvail - skillCost;
        await this.actor.update({ "system.skills.unspent": newSkillPoints });
        ui.notifications.info(`Removed ${skillCost} skill points`);
      }
    });

    html.find(".lock-skills").click(async (ev) => {
      ev.preventDefault();
      const lock = ev.currentTarget.dataset.type === "lock";
      await this.actor.update({ "system.skills.levelsUnlocked": !lock });
    });
  }
}
