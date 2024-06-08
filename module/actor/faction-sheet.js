import { WwnActor } from "./entity.js";
import { WwnFaction } from "./faction.js";
import { WwnActorSheet } from "./actor-sheet.js";

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
            system: {
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
                this.logMessage("Manual Faction Log", log);
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
          system: {
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
      system: {
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
          system: {
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
              this.addTag(tag);
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
              this.addCustomTag(name, desc, effect);
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
    this.startTurn();
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
          this.logMessage(title, msg, longDesc, rollString);
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
              system: {
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
            await this.logMessage(title, content);
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
            this.addBase(nHp, assetType, itemName, imgPath);
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
        system: {
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
        system: {
          stealthed: new_status,
        },
      });
  }

  async _onRatingUp(type) {
    const ratingName = `${type}Rating`;
    let ratingLevel = this.actor.system[ratingName];
    if (ratingLevel == 8) {
      ui.notifications?.info("Rating is already at max");
      return;
    }
    if (!ratingLevel) {
      ratingLevel = 0;
    }
    const targetLevel = parseInt(ratingLevel) + 1;
    let xp = this.actor.system.xp;
    if (targetLevel in HEALTH__XP_TABLE) {
      const req_xp = HEALTH__XP_TABLE[targetLevel];
      if (req_xp > xp) {
        ui.notifications?.error(
          `Not enough XP to raise rating. Have ${xp} Need ${req_xp}`
        );
        return;
      }
      xp -= req_xp;
      if (type == "cunning") {
        await this.actor.update({
          "system.xp": xp,
          "system.cunningRating": targetLevel,
        });
      } else if (type == "force") {
        await this.actor.update({
          "system.xp": xp,
          "system.forceRating": targetLevel,
        });
      } else if (type == "wealth") {
        await this.actor.update({
          "system.xp": xp,
          "system.wealthRating": targetLevel,
        });
      }
      ui.notifications?.info(
        `Raised ${type} rating to ${targetLevel} using ${xp} xp`
      );
    }
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

  async logMessage(
    title,
    content,
    longContent = null,
    logRollString = null
  ) {
    const gm_ids = ChatMessage.getWhisperRecipients("GM")
      .filter((i) => i)
      .map((i) => i.id)
      .filter((i) => i !== null);

    if (game.modules?.get("foundryvtt-simple-calendar")?.active) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const c = SimpleCalendar.api.getCurrentCalendar();
      content = `(${c.currentDate.year}-${c.currentDate.month + 1}-${c.currentDate.day + 1
        }) ${content}`;
    }
    const cardData = {
      title,
      content,
      longContent,
      logRollString,
    };
    const template = "systems/wwn/templates/chat/faction-log.html";

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: await renderTemplate(template, cardData),
      type: CONST.CHAT_MESSAGE_STYLES.WHISPER,
      whisper: gm_ids,
    };
    const msg = await ChatMessage.create(chatData);
    if (msg) {
      // Old way but rolls are ugly
      //const chatString = msg.export();
      //content = chatString.split("]", 2)[1];
      const html = await msg.getHTML();
      html.find(".message-header").remove();
      content = html.html().toString();
    }
    const log = this.actor.system.log;
    log.push(content);
    await this.actor.update({
      system: {
        log: log,
      },
    });
  }

  async addTag(name) {
    const match = FACTION_TAGS.filter((i) => i.name == name);
    if (!match) {
      ui.notifications?.error(`Error unable to find tag ${name}`);
      return;
    }
    const tags = this.actor.system.tags;
    tags.push(match[0]);
    await this.actor.update({
      system: {
        tags: tags,
      },
    });
  }

  async addCustomTag(
    name,
    desc,
    effect
  ) {
    const tags = this.actor.system.tags;
    const tag = {
      name,
      desc,
      effect,
    };
    tags.push(tag);
    await this.actor.update({
      system: {
        tags: tags,
      },
    });
  }

  async addBase(
    hp,
    assetType,
    name,
    imgPath
  ) {
    if (hp > this.actor.system.health.max) {
      ui.notifications?.error(
        `Error HP of new base (${hp}) cannot be greater than faction max HP (${this.actor.system.health.max})`
      );
      return;
    }
    if (hp > this.actor.system.facCreds) {
      ui.notifications?.error(
        `Error HP of new base (${hp}) cannot be greater than treasure  (${this.actor.system.facCreds})`
      );
      return;
    }
    const newFacCreds = this.actor.system.facCreds - hp;
    await this.actor.update({ system: { facCreds: newFacCreds } });
    await this.actor.createEmbeddedDocuments(
      "Item",
      [
        {
          name: name,
          type: "asset",
          img: imgPath,
          system: {
            assetType: assetType,
            health: {
              value: hp,
              max: hp,
            },
            baseOfInfluence: true,
          },
        },
      ],
      {}
    );
  }

  async startTurn() {
    /*
    At the beginning of each turn, a faction gains Fac-
    Creds equal to half their Wealth rating rounded up plus
    one-quarter of their total Force and Cunning ratings,
    rounded down. Any maintenance costs must be paid
    at the beginning of each turn. Assets that cannot be
    maintained are unusable; an asset that goes without
    maintenance for two consecutive rounds is lost. A fac-
    tion cannot voluntarily choose not to pay maintenance.
    If a faction has no goal at the start of a turn, they
    may pick a new one. If they wish to abandon a prior
    goal, they may do so, but the demoralization and con-
    fusion costs them that turn`s FacCred income and they
    may perform no other action that turn.
    */

    const assets = (
      this.actor.items.filter((i) => i.type === "asset")
    );
    const wealthCunningForceIncome =
      Math.ceil((this.actor.system.wealthRating / 2) +
        ((this.actor.system.cunningRating + this.actor.system.forceRating) / 4));
    const assetIncome = assets
      .map((i) => i.system.income)
      .reduce((i, n) => i + n, 0);
    const assetWithMaint = assets.filter((i) => i.system.maintenance);
    const assetMaintTotal = assetWithMaint
      .map((i) => i.system.maintenance)
      .reduce((i, n) => i + n, 0);

    const cunningAssetsOverLimit = Math.min(
      this.actor.system.cunningRating - this.actor.system.cunningAssets.length,
      0
    );
    const forceAssetsOverLimit = Math.min(
      this.actor.system.forceRating - this.actor.system.forceAssets.length,
      0
    );
    const wealthAssetsOverLimit = Math.min(
      this.actor.system.wealthRating - this.actor.system.wealthAssets.length,
      0
    );
    const costFromAssetsOver =
      cunningAssetsOverLimit + forceAssetsOverLimit + wealthAssetsOverLimit;
    const income =
      wealthCunningForceIncome +
      assetIncome -
      assetMaintTotal +
      costFromAssetsOver;
    let new_creds = this.actor.system.facCreds + income;

    const assetsWithTurn = assets.filter((i) => i.system.turnRoll);
    let msg = `<b>Income this round: ${income}</b>.<br> From ratings: ${wealthCunningForceIncome}
       (0.5 * W + 0.25 * (C+F))<br>From assets: ${assetIncome}.<br>Maintenance -${assetMaintTotal}.<br>`;
    if (costFromAssetsOver < 0) {
      msg += `Cost from # of assets over rating: ${costFromAssetsOver}.<br>`;
    }
    if (income < 0) {
      msg += ` <b>Loosing Treasure this turn.</b><br>`;
    }
    let longMsg = "";
    if (assetsWithTurn.length > 0) {
      longMsg += "Assets with turn notes/rolls:<br>";
    }
    for (const a of assetsWithTurn) {
      longMsg += `<i>${a.name}</i>: ${a.system.turnRoll} <br><br>`;
    }
    const aitems = [];

    if (new_creds < 0) {
      if (assetMaintTotal + new_creds < 0) {
        //Marking all assets unusable would still not bring money above, can mark all w/maint as unusable.
        for (let i = 0; i < assetWithMaint.length; i++) {
          const asset = assetWithMaint[i];
          const assetCost = asset.system.maintenance;
          new_creds += assetCost; // return the money
          aitems.push({ _id: asset.id, system: { unusable: true } });
        }
        if (aitems.length > 0) {
          await this.actor.updateEmbeddedDocuments("Item", aitems);
        }
        msg += ` <b>Out of money and unable to pay for all assets</b>, marking all assets with maintenance as unusable<br>`;
      } else {
        msg += ` <b>Out of money and unable to pay for all assets</b>, need to make assets unusable. Mark unusable for assets to cover treasure: ${income}<br>`;
      }
    }
    msg += `<b> Old Treasure: ${this.actor.system.facCreds}. New Treasure: ${new_creds}</b><br>`;
    await this.actor.update({ system: { facCreds: new_creds } });
    const title = `New Turn for ${this.name}`;
    await this.logMessage(title, msg, longMsg);
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

// Hooks.on("dropActorSheetData", (actor, actorSheetSheet, data) => {
//   if (data.type == "JournalEntry") {
//     if (actor.type == "faction") {
//       if (!data["id"] || typeof data["id"] !== "string") {
//         ui.notifications?.error("Error with getting journal id");
//         return;
//       }
//       actor.setHomeWorld(data["id"]);
//     }
//   }
// });

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

export const HEALTH__XP_TABLE = {
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 9,
  6: 12,
  7: 16,
  8: 20,
};


export const FACTION_TAGS = [
  { "name": "Antimagical", "desc": "The faction is dwarven or of some other breed of skilled counter-sorcerers. Assets that require Medium or higher Magic to purchase roll all attribute checks twice against this faction during an Attack and take the worst roll." },
  { "name": "Concealed", "desc": "All Assets the faction purchases enter play with the Stealth quality." },
  { "name": "Imperialist", "desc": "The faction quickly expands its Bases of Influence. Once per turn, it can use the Expand Influence action as a special ability instead of it taking a full action." },
  { "name": "Innovative", "desc": "The faction can purchase Assets as if their attribute ratings were two points higher than they are. Only two such over-complex Assets may be owned at any one time." },
  { "name": "Machiavellian", "desc": "The faction is diabolically cunning. It rolls an extra die for all Cunning attribute checks. Its Cunning must always be its highest attribute." },
  { "name": "Martial", "desc": "The faction is profoundly devoted to war. It rolls an extra die for all Force attribute checks. Force must always be its highest attribute." },
  { "name": "Massive", "desc": "The faction is an empire, major kingdom, or other huge organizational edifice. It automatically wins attribute checks if its attribute is more than twice as big as the opposing side's attribute, unless the other side is also Massive." },
  { "name": "Mobile", "desc": "The faction is exceptionally fast or mobile. Its faction turn movement range is twice what another faction would have in the same situation." },
  { "name": "Populist", "desc": "The faction has widespread popular support. Assets that cost 5 Treasure or less to buy cost one point less, to a minimum of 1." },
  { "name": "Rich", "desc": "The faction is rich or possessed of mercantile skill. It rolls an extra die for all Wealth attribute checks. Wealth must always be its highest attribute." },
  { "name": "Rooted", "desc": "The faction has very deep roots in its area of influence. They roll an extra die for attribute checks in their headquarters location, and all rivals roll their own checks there twice, taking the worst die." },
  { "name": "Scavenger", "desc": "As looters and raiders, when they destroy an enemy Asset they gain a quarter of its purchase value in Treasure, rounded up." },
  { "name": "Supported", "desc": "The faction has excellent logistical support. All damaged Assets except Bases of Influence regain one lost hit point per faction turn automatically." },
  { "name": "Tenacious", "desc": "The faction is hard to dislodge. When one of its Bases of Influence is reduced to zero hit points, it instead survives with 1 hit point. This trait can't be used again on that base until it's fully fixed." },
  { "name": "Zealot", "desc": "Once per turn, when an Asset fails an Attack action check, it can reroll the attribute check. It automatically takes counterattack damage from its target, however, or 1d6 if the target has less or none." }
];

export const FACTION_GOALS = [
  { "name": "Blood the Enemy", "desc": "Inflict a number of hit points of damage on enemy faction assets or bases equal to your faction's total Force, Cunning, and Wealth ratings. Difficulty 2." },
  { "name": "Destroy the Foe", "desc": "Destroy a rival faction. Difficulty equal to 2 plus the average of the faction's Force, Cunning, and Wealth ratings." },
  { "name": "Eliminate Target", "desc": "Choose an undamaged rival Asset. If you destroy it within three turns, succeed at a Difficulty 1 goal. If you fail, pick a new goal without suffering the usual turn of paralysis." },
  { "name": "Expand Influence", "desc": "Plant a Base of Influence at a new location. Difficulty 1, +1 if a rival contests it." },
  { "name": "Inside Enemy Territory", "desc": "Have a number of Stealthed assets in locations where there is a rival Base of Influence equal to your Cunning score. Units that are already Stealthed in locations when this goal is adopted don't count. Difficulty 2." },
  { "name": "Invincible Valor", "desc": "Destroy a Force asset with a minimum purchase rating higher than your faction's Force rating. Difficulty 2." },
  { "name": "Peaceable Kingdom", "desc": "Don't take an Attack action for four turns. Difficulty 1." },
  { "name": "Root Out the Enemy", "desc": "Destroy a Base of Influence of a rival faction in a specific location. Difficulty equal to half the average of the current ruling faction's Force, Cunning, and Wealth ratings, rounded up." },
  { "name": "Sphere Dominance", "desc": "Choose Wealth, Force, or Cunning. Destroy a number of rival assets of that kind equal to your score in that attribute. Difficulty of 1 per 2 destroyed, rounded up." },
  { "name": "Wealth of Kingdoms", "desc": "Spend Treasure equal to four times your faction's Wealth rating on bribes and influence. This money is effectively lost, but the goal is then considered accomplished. The faction's Wealth rating must increase before this goal can be selected again. Difficulty 2." }
];

export const FACTION_ACTIONS = [
  { "name": "Attack", "desc": "The faction nominates one or more Assets to attack the enemy in their locations. In each location, the defender chooses which of the Assets present will meet the Attack; thus, if a unit of Infantry attacks in a location where there is an enemy Base of Influence, Informers, and Idealistic Thugs, the defender could decide to use Idealistic Thugs to defend against the attack.", "longDesc": "The attacker makes an attribute check based on the attack of the acting Asset; thus, the Infantry would roll Force versus Force. On a success, the defending Asset takes damage equal to the attacking Asset's attack score, or [[1d8]] in the case of Infantry. On a failure, the attacking Asset takes damage equal to the defending Asset's counterattack score, or [[1d6]] in the case of Idealistic Thugs. If the damage done to an Asset reduces it to zero hit points, it is destroyed. The same Asset may be used to defend against multiple attacking Assets, provided it can survive the onslaught. Damage done to a Base of Influence is also done directly to the faction's hit points. Overflow damage is not transmitted, however; if the Base of Influence only has 5 hit points and 7 hit points are inflicted, the faction loses the Base of Influence and 5 hit points from its total." },
  { "name": "Move Asset", "desc": "One or more Assets are moved up to one turn's worth of movement each. The receiving location must not have the ability and inclination to forbid the Asset from operating there. Subtle and Stealthed Assets ignore this limit.", "longDesc": "If an asset loses the Subtle or Stealth qualities while in a hostile location, they must use this action to retreat to safety within one turn or they will take half their maximum hit points in damage at the start of the next turn, rounded up." },
  { "name": "Repair Asset", "desc": "The faction spends 1 Treasure on each Asset they wish to repair, fixing half their relevant attribute value in lost hit points, rounded up. Thus, fixing a Force Asset would heal half the faction's Force attribute, rounded up. Additional healing can be applied to an Asset in this same turn, but the cost increases by 1 Treasure for each subsequent fix; thus, the second costs 2 Treasure, the third costs 3 Treasure, and so forth. This ability can at the same time also be used to repair damage done to the faction, spending 1 Treasure to heal a total equal to the faction's highest and lowest Force, Wealth, or Cunning attribute divided by two, rounded up. Thus, a faction with a Force of 5, Wealth of 2, and Cunning of 4 would heal 4 points of damage. Only one such application of healing is possible for a faction each turn." },
  { "name": "Expand Influence", "desc": "The faction seeks to establish a new base of operations in a location. The faction must have at least one Asset there already to make this attempt, and must spend 1 Treasure for each hit point the new Base of Influence is to have. Thus, to create a new Base of Influence with a maximum hit point total of 10, 10 Treasure must be spent. Bases with high maximum hit point totals are harder to dislodge, but losing them also inflicts much more damage on the faction's own hit points.", "longDesc": "Once the Base of Influence is created, the owner makes a Cunning versus Cunning attribute check against every other faction that has at least one Asset in the same location. If the other faction wins the check, they are allowed to make an immediate Attack against the new Base of Influence with whatever Assets they have present in the location. The creating faction may attempt to block this action by defending with other Assets present. If the Base of Influence survives this onslaught, it operates as normal and allows the faction to purchase new Assets there with the Create Asset action." },
  { "name": "Create Asset", "desc": "The faction buys one Asset at a location where they have a Base of Influence. They must have the minimum attribute and Magic ratings necessary to buy the Asset and must pay the listed cost in Treasure to build it. A faction can create only one Asset per turn.", "longDesc": "A faction can have no more Assets of a particular attribute than their attribute score. Thus, a faction with a Force of 3 can have only 3 Force Assets. If this number is exceeded, the faction must pay 1 Treasure per excess Asset at the start of each turn, or else they will lose the excess." },
  { "name": "Hide Asset", "desc": "An action available only to factions with a Cunning score of 3 or better, this action allows the faction to give one owned Asset the Stealth quality for every 2 Treasure they spend. Assets currently in a location with another faction's Base of Influence can't be hidden. If the Asset later loses the Stealth, no refund is given." },
  { "name": "Sell Asset", "desc": "The faction voluntarily decommissions an Asset, salvaging it for what it's worth. The Asset is lost and the faction gains half its purchase cost in Treasure, rounded down. If the Asset is damaged when it is sold, however, no Treasure is gained." }
];