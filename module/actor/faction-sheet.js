import { WwnActor } from "./entity.js";
import { WwnFaction } from "./faction.js";
import { WwnActorSheet } from "./actor-sheet.js";
import {
  FACTION_TAGS,
  FACTION_GOALS,
  FACTION_ACTIONS,
  HEALTH__XP_TABLE,
} from "./faction.js";

/**
 *  Extend the basic ActorSheet
 */
export class WwnActorSheetFaction extends WwnActorSheet {
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
      classes: ["wwn", "sheet", "actor", "faction"],
      template: "systems/wwn/templates/actors/faction-sheet.html",
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
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  async getData() {
    const data = super.getData();
    data.enrichedDescription = await TextEditor.enrichHTML(
      this.object.system.description,
      { async: true }
    );
    data.enrichedGoal = await TextEditor.enrichHTML(
      this.object.system.factionGoalDesc,
      { async: true }
    );
    return data;
  }

  get actor() {
    if (super.actor.type !== "faction") throw Error;
    return super.actor;
  }

  async _onAssetCreate(event) {
    event.preventDefault();
    event.stopPropagation();
    const assetType = $(event.currentTarget).data("assetType");
    const givenName = $(event.currentTarget).data("assetName");
    const itemName = givenName ? `New ${givenName}` : "New Asset";
    const imgPath = this.getAssetImage(assetType);
    if (assetType) {
      await this.actor.createEmbeddedDocuments(
        "Item",
        [
          {
            name: itemName,
            type: "asset",
            img: imgPath,
            data: {
              assetType: assetType,
            },
          },
        ],
        {}
      );
    }
  }

  getAssetImage(itemType) {
    const icon_path = "systems/wwn/assets/";
    const imgMap = {
      cunning: "cunning.png",
      force: "force.png",
      wealth: "wealth.png",
    };
    if (itemType in imgMap) {
      return `${icon_path}/${imgMap[itemType]}`;
    } else {
      return "icons/svg/item-bag.svg";
    }
  }

  async _onAddLog(event) {
    event.preventDefault();
    event.stopPropagation();
    this.popUpDialog?.close();
    const html = `<form class="">
    <div class="form-group">
      <label>Manual Log Entry. To inline a roll use [[1dX]].</label>
      <textarea id="inputField" name="inputField" rows="4" cols="50" 
        class=""></textarea>
    </div>
  </form>`;
    this.popUpDialog = new Dialog(
      {
        title: "Add Log",
        content: html,
        default: "add",
        buttons: {
          add: {
            label: `Add Manual Log Entry`,
            callback: async (html) => {
              const form = html[0].querySelector("form");
              const log = form.querySelector('[name="inputField"]')?.value;
              if (log) {
                this.actor.logMessage("Manual Faction Log", log);
              }
            },
          },
        },
      },
      {
        failCallback: () => {
          return;
        },
        classes: ["wwn"],
      }
    );
    const s = this.popUpDialog.render(true);
    if (s instanceof Promise) await s;
  }

  async _onDelLog(event) {
    event.preventDefault();
    event.stopPropagation();
    const div = $(event.currentTarget).parents(".logdiv");
    const p = $(event.currentTarget).parents();
    const idx = div.data("idx");
    const logs = this.actor.system.log;
    const log = logs[idx];
    // if (!tag) {
    //   ui.notifications?.info("Issue deleting tag");
    //   return;
    // }
    const performDelete = await new Promise((resolve) => {
      Dialog.confirm({
        title: "Delete Log",
        yes: () => resolve(true),
        no: () => resolve(false),
        content: `Remove log: ${log}?`,
      });
    });
    if (!performDelete) return;
    div.slideUp(200, () => {
      requestAnimationFrame(async () => {
        //actor.removeCrew(li.data("crewId"));
        logs.splice(idx, 1);
        await this.actor.update({
          data: {
            log: logs,
          },
        });
      });
    });
  }

  async _onDelLogAll(event) {
    event.preventDefault();
    event.stopPropagation();
    const logs = this.actor.system.log;
    // if (!tag) {
    //   ui.notifications?.info("Issue deleting tag");
    //   return;
    // }
    const performDelete = await new Promise((resolve) => {
      Dialog.confirm({
        title: "Delete Log",
        yes: () => resolve(true),
        no: () => resolve(false),
        content: `Remove all logs for this faction (cannot be undone)?`,
      });
    });
    if (!performDelete) return;

    logs.length = 0;
    await this.actor.update({
      data: {
        log: logs,
      },
    });
  }

  async _onDelTag(event) {
    event.preventDefault();
    event.stopPropagation();
    const div = $(event.currentTarget).parents(".tagdiv");
    const p = $(event.currentTarget).parents();
    const idx = div.data("idx");
    const tags = this.actor.system.tags;
    const tag = tags[idx];
    // if (!tag) {
    //   ui.notifications?.info("Issue deleting tag");
    //   return;
    // }
    const performDelete = await new Promise((resolve) => {
      Dialog.confirm({
        title: "Delete Tag",
        yes: () => resolve(true),
        no: () => resolve(false),
        content: `Remove tag ${tag.name}?`,
      });
    });
    if (!performDelete) return;
    div.slideUp(200, () => {
      requestAnimationFrame(async () => {
        //actor.removeCrew(li.data("crewId"));
        tags.splice(idx, 1);
        await this.actor.update({
          data: {
            tags: tags,
          },
        });
      });
    });
  }

  async _onAddTag(event) {
    event.preventDefault();
    event.stopPropagation();
    let tagOptions = "";
    let tagDesc = "";
    for (const tag of FACTION_TAGS) {
      tagOptions += `<option value='${tag.name}'>${tag.name}</option>`;
      tagDesc += `<div> <b>${tag.name}</b></div><div>${tag.desc}</div><div><i>Effect:</i> ${tag.effect}</div>`;
    }
    const dialogTemplate = `
    <div class="flex flex-col">
      <h1> Add Tag </h1>
      <div class="flex flexrow">
        Tag: <select id="tag">          
        ${tagOptions}
        </select>
      </div>
      ${tagDesc}
    </div>
    `;
    this.popUpDialog?.close();

    this.popUpDialog = new Dialog(
      {
        title: "Add Tag",
        content: dialogTemplate,
        buttons: {
          addTag: {
            label: "Add Tag",
            callback: async (html) => {
              const tag = html.find("#tag")[0].value;
              this.actor.addTag(tag);
            },
          },
          close: {
            label: "Close",
          },
        },
        default: "addTag",
      },
      {
        failCallback: () => {
          return;
        },
        classes: ["wwn"],
      }
    );
    const s = this.popUpDialog.render(true);
    if (s instanceof Promise) await s;
  }

  async _onAddCustomTag(event) {
    event.preventDefault();
    event.stopPropagation();
    const dialogTemplate = `
    <div class="flex flex-col">
      <h1> Add Tag </h1>
      <div class="flex flex-col">
        <div class="flex flexrow">
          Tag Name:
          <input type='text' id="tagname" name='tagname' class=""></input>

        </div>
        <div class="flex flexrow">
          Tag Desc:
          <textarea id="tagdesc" name="tagdesc" rows="4" cols="50"></textarea>
        </div>
        <div class="flex flexrow">
          Tag Effect: 
          <textarea id="tageffect" name="tageffect" rows="4" cols="50"></textarea>
        </div>

      </div>
    </div>
    `;
    this.popUpDialog?.close();

    this.popUpDialog = new Dialog(
      {
        title: "Add Custom Tag",
        content: dialogTemplate,
        buttons: {
          addTag: {
            label: "Add Custom Tag",
            callback: async (html) => {
              const name = html.find("#tagname")[0].value;
              const desc = html.find("#tagdesc")[0].value;
              const effect = html.find("#tageffect")[0].value;
              this.actor.addCustomTag(name, desc, effect);
            },
          },
          close: {
            label: "Close",
          },
        },
        default: "addTag",
      },
      {
        failCallback: () => {
          return;
        },
        classes: ["wwn"],
      }
    );
    const s = this.popUpDialog.render(true);
    if (s instanceof Promise) await s;
  }

  async _onStartTurn(event) {
    event.preventDefault();
    event.stopPropagation();
    this.actor.startTurn();
    // Now ask about action
    const dialogData = {
      actions: FACTION_ACTIONS,
    };
    const template = "systems/wwn/templates/actors/dialogs/faction-action.html";
    const html = renderTemplate(template, dialogData);
    const _form = async (html) => {
      const form = html[0].querySelector("form");
      const action = form.querySelector('[name="action"]').value;
      for (const a of FACTION_ACTIONS) {
        if (action == a.name) {
          const title = `Faction ${this.actor.name} action: ${action}`;
          const msg = `${a.desc}`;
          const longDesc = a.longDesc != undefined ? a.longDesc : null;
          let rollString = null;
          if (a.roll) {
            const roll = new Roll(a.roll, this.actor.system);
            rollString = await roll.render();
          }
          this.actor.logMessage(title, msg, longDesc, rollString);
        }
      }
    };

    this.popUpDialog?.close();
    this.popUpDialog = new Dialog(
      {
        title: "Take Action",
        content: await html,
        default: "setgoal",
        buttons: {
          setgoal: {
            label: "Take Action",
            callback: _form,
          },
        },
      },
      {
        classes: ["wwn"],
      }
    );
    this.popUpDialog.render(true);
  }

  async _onSetGoal(event) {
    event.preventDefault();
    event.stopPropagation();
    const goalArray = FACTION_GOALS;
    const dialogData = {
      goalArray,
    };
    const template = "systems/wwn/templates/actors/dialogs/faction-goal.html";
    const html = renderTemplate(template, dialogData);

    const _goalForm = async (html) => {
      const form = html[0].querySelector("form");
      const goal = form.querySelector('[name="goal"]').value;
      const goalType = form.querySelector('[name="goalType"]').value;

      if (goal && goal.length == 0 && goalType != "abandon") {
        ui.notifications?.info("No goal selected. Ignoring");
      } else {
        for (const g of FACTION_GOALS) {
          if (g.name == goal) {
            await this.actor.update({
              data: {
                factionGoal: g.name,
                factionGoalDesc: g.desc,
              },
            });
            let goalTypeMessage =
              "<b>Goal completed</b>.<br> Reminder: The faction collects the experience points for doing so and picks a new goal.";

            if (goalType == "abandon") {
              goalTypeMessage =
                "<b>Goal abandoned.</b><br> Reminder: If not, it can abandon the old goal and pick a new one, but it will sacrifice its next turn's Faction Action to do so and may not trigger any Asset special abilities that round, either.";
            }
            const title = `Faction ${this.actor.name} changed their goal to ${g.name}.`;
            const content = `${goalTypeMessage}`;
            await this.actor.logMessage(title, content);
            return;
          }
        }
      }
    };

    this.popUpDialog?.close();
    this.popUpDialog = new Dialog(
      {
        title: "Set Goal",
        content: await html,
        default: "setgoal",
        buttons: {
          setgoal: {
            label: "Set Goal",
            callback: _goalForm,
          },
        },
      },
      {
        classes: ["wwn"],
      }
    );
    this.popUpDialog.render(true);
  }

  async _onAssetRepair(event) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const asset = this.actor.getEmbeddedDocument(
      "Item",
      wrapper.data("itemId")
    );
    if (!asset) {
      ui.notifications?.error("Cannot find asset.");
      return;
    }
    ui.notifications?.info("on set _onAssetRepair " + asset.name);
  }

  async _onBaseAdd(event) {
    event.preventDefault();
    event.stopPropagation();
    new Dialog({
      title: "Add New Base",
      content: `
          Adding a new base from Expand Influence Action.<br>
          Select HP (up to Faction max HP). One treasure per HP.
          <form>
            <div class="form-group">
              <label>Base HP</label>
              <input type='text' name='inputField'></input>
            </div>
          </form>`,
      buttons: {
        yes: {
          icon: "<i class='fas fa-check'></i>",
          label: `Exapnd Influence - New Base`,
        },
      },
      default: "yes",
      close: (html) => {
        const form = html[0].querySelector("form");
        const hp = form.querySelector('[name="inputField"]')?.value;
        if (hp && hp != "") {
          const nHp = Number(hp);
          if (nHp) {
            const assetType = $(event.currentTarget).data("assetType");
            const givenName = $(event.currentTarget).data("assetName");
            const itemName = givenName
              ? `Base of Inf. ${givenName}`
              : "New Base of Inf";
            const imgPath = this.getAssetImage(assetType);
            this.actor.addBase(nHp, assetType, itemName, imgPath);
          } else {
            ui.notifications?.error(hp + " is not a number");
          }
        }
      },
    }).render(true);
  }

  async _onAssetUnusable(event) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const asset = this.actor.getEmbeddedDocument(
      "Item",
      wrapper.data("itemId")
    );
    if (!asset) {
      ui.notifications?.error("Cannot find asset.");
      return;
    }
    const new_status = !asset?.system.unusable;
    if (asset instanceof Item)
      await asset?.update({
        data: {
          unusable: new_status,
        },
      });
  }

  async _onAssetStealthed(event) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const asset = this.actor.getEmbeddedDocument(
      "Item",
      wrapper.data("itemId")
    );
    if (!asset) {
      ui.notifications?.error("Cannot find asset.");
      return;
    }
    const new_status = !asset?.system.stealthed;
    if (asset instanceof Item)
      await asset?.update({
        data: {
          stealthed: new_status,
        },
      });
  }

  async _onRatingUp(type) {
    return this.actor.ratingUp(type);
  }

  // Clickable title/name or icon. Invoke Item.roll()
  _onItemClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.currentTarget.parentElement.dataset.itemId;
    const item = this.actor.getEmbeddedDocument("Item", itemId);
    //const wrapper = $(event.currentTarget).parents(".item");
    //const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    if (!item) return;
    item.roll(event.shiftKey);
  }

  _onItemEdit(event) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    if (item instanceof Item) item.sheet?.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
    if (!item) return;
    const performDelete = await new Promise((resolve) => {
      Dialog.confirm({
        title: game.i18n.format("WWN.Delete", { name: item.name }),
        yes: () => resolve(true),
        no: () => resolve(false),
        content: game.i18n.format("WWN.DeleteContent", {
          name: item.name,
          actor: this.actor.name,
        }),
      });
    });
    if (!performDelete) return;
    li.slideUp(200, () => {
      requestAnimationFrame(() => {
        this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      });
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".asset-create").on("click", this._onAssetCreate.bind(this));
    html.find(".faction-turn").on("click", this._onStartTurn.bind(this));
    html.find(".faction-tag-add").on("click", this._onAddTag.bind(this));
    html
      .find(".faction-tag-add-custom")
      .on("click", this._onAddCustomTag.bind(this));
    html.find(".faction-tag-delete").on("click", this._onDelTag.bind(this));
    html.find(".faction-log-delete").on("click", this._onDelLog.bind(this));
    html.find(".faction-log-add").on("click", this._onAddLog.bind(this));
    html
      .find(".faction-log-delete-all")
      .on("click", this._onDelLogAll.bind(this));
    html.find(".force-up").on("click", this._onRatingUp.bind(this, "force"));
    html
      .find(".cunning-up")
      .on("click", this._onRatingUp.bind(this, "cunning"));
    html.find(".wealth-up").on("click", this._onRatingUp.bind(this, "wealth"));
    html.find(".set-goal").on("click", this._onSetGoal.bind(this));
    html.find(".item-fix").on("click", this._onAssetRepair.bind(this));
    html
      .find(".asset-toggle-unusable")
      .on("click", this._onAssetUnusable.bind(this));
    html
      .find(".asset-toggle-stealthed")
      .on("click", this._onAssetStealthed.bind(this));
    html.find(".add-base").on("click", this._onBaseAdd.bind(this));
    // html.find(".item-click").on("click", this._onItemClick.bind(this));
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    html.find(".item-delete").on("click", this._onItemDelete.bind(this));
    html.find(".inventory .item-titles .item-caret").click((ev) => {
      let items = $(ev.currentTarget.parentElement.parentElement).children(
        ".item-list"
      );
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
    // html.find(".").on("click", this._on.bind(this));
  }
}

Hooks.on("dropActorSheetData", (actor, actorSheetSheet, data) => {
  if (data.type == "JournalEntry") {
    if (actor.type == "faction") {
      if (!data["id"] || typeof data["id"] !== "string") {
        ui.notifications?.error("Error with getting journal id");
        return;
      }
      actor.setHomeWorld(data["id"]);
    }
  }
});

// A button to show long descriptions
Hooks.on("renderChatMessage", (message, html, _user) => {
  const longDesc = html.find(".longShowDesc");
  if (longDesc) {
    const bind = function (event) {
      event.preventDefault();
      const hiddenDesc = html.find(".hiddenLong");
      hiddenDesc.show();
      longDesc.hide();
    };
    longDesc.one("click", bind);
  }
});
