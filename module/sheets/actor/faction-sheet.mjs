/**
 * WWN Faction sheet (AppV2/SheetV2).
 *
 * Factions do not derive from `WwnActorBase` (see module/data/actor/faction.mjs)
 * and have no powers/effects/inventory concepts, so this sheet extends
 * `ActorSheetV2` directly rather than `WwnBaseActorSheet`. Ported from the
 * legacy jQuery sheet at module/actor/faction-sheet.js, preserving all
 * display fields and behaviors:
 * - Main tab: HP/XP, ratings, goal, description (left) + asset panels (right).
 * - Tags tab: catalog + custom tag add/remove.
 * - Log tab: manual log entries, "Start Turn" income/maintenance resolution
 *   (ported verbatim from `startTurn()`), and log management.
 *
 * Complex multi-field prompts (Start Turn action picker, Set Goal, Add Tag,
 * Add Custom Tag, Add Log, Add Base) use the shared `showWwnDialog` factory.
 */
import { HEALTH__XP_TABLE, FACTION_TAGS, FACTION_GOALS, FACTION_ACTIONS } from "../../config/faction-catalog.mjs";
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { showWwnDialog, confirmWwnDialog, confirmButton, cancelButton } from "../../applications/wwn-dialog.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TPL = "systems/wwn/templates/actor/faction";

export class WwnFactionSheet extends composeMixins(CollapsibleSectionsMixin)(
  HandlebarsApplicationMixin(ActorSheetV2)
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["wwn", "wwn-sheet", "sheet", "actor", "faction"],
    position: { width: 1100, height: 820 },
    form: { submitOnChange: true },
    window: { resizable: true, contentClasses: ["flex", "flex-col", "min-h-0"] },
    actions: {
      startTurn: WwnFactionSheet.#onStartTurn,
      ratingUp: WwnFactionSheet.#onRatingUp,
      setGoal: WwnFactionSheet.#onSetGoal,
      assetCreate: WwnFactionSheet.#onAssetCreate,
      addBase: WwnFactionSheet.#onAddBase,
      toggleAssetUnusable: WwnFactionSheet.#onToggleAssetUnusable,
      toggleAssetStealthed: WwnFactionSheet.#onToggleAssetStealthed,
      addTag: WwnFactionSheet.#onAddTag,
      addCustomTag: WwnFactionSheet.#onAddCustomTag,
      deleteTag: WwnFactionSheet.#onDeleteTag,
      addLog: WwnFactionSheet.#onAddLog,
      deleteLog: WwnFactionSheet.#onDeleteLog,
      deleteAllLogs: WwnFactionSheet.#onDeleteAllLogs,
      editItem: WwnFactionSheet.#onEditItem,
      deleteItem: WwnFactionSheet.#onDeleteItem,
      rollItem: WwnFactionSheet.#onRollItem,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "WWN.Tabs.Main" },
        { id: "tags", label: "WWN.faction.tags-tab" },
        { id: "log", label: "WWN.faction.log-tab" },
      ],
      initial: "main",
    },
  };

  /** @override */
  static PARTS = {
    header: { template: `${TPL}/header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: `${TPL}/tabs/main.hbs`, scrollable: [""] },
    tags: { template: `${TPL}/tabs/tags.hbs`, scrollable: [""] },
    log: { template: `${TPL}/tabs/log.hbs`, scrollable: [""] },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    context.actor = actor;
    context.system = system;
    context.owner = actor.isOwner;
    context.editable = this.isEditable;
    context.config = CONFIG.WWN;

    context.cunningAssets = actor.items.filter((i) => i.type === "asset" && i.system.assetType === "cunning");
    context.forceAssets = actor.items.filter((i) => i.type === "asset" && i.system.assetType === "force");
    context.wealthAssets = actor.items.filter((i) => i.type === "asset" && i.system.assetType === "wealth");

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? ""
    );
    context.enrichedGoal = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.factionGoalDesc ?? ""
    );

    context.collapsed = this.sectionStates ?? {};

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    const tab = context.tabs?.[partId];
    if (tab) context.tab = tab;
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Inline per-item field editing (e.g. asset location text input).
    for (const input of this.element.querySelectorAll("[data-item-field]")) {
      input.addEventListener("change", (event) => this.#onItemFieldChange(event));
    }
    for (const input of this.element.querySelectorAll("input")) {
      input.addEventListener("focus", (event) => event.currentTarget.select());
    }
  }

  async #onItemFieldChange(event) {
    const input = event.currentTarget;
    const itemId = input.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const field = input.dataset.itemField;
    const value = input.type === "checkbox" ? input.checked : input.value;
    await item.update({ [field]: value });
  }

  _getItem(target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(itemId);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onEditItem(event, target) {
    this._getItem(target)?.sheet.render(true);
  }

  static async #onDeleteItem(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    const confirmed = await confirmWwnDialog({
      modifier: "delete-item",
      title: game.i18n.format("WWN.Delete", { name: item.name }),
      content: `<p>${game.i18n.format("WWN.DeleteContent", { name: item.name, actor: this.actor.name })}</p>`,
    });
    if (confirmed) await item.delete();
  }

  static #onRollItem(event, target) {
    return this._getItem(target)?.roll({ skipDialog: event.shiftKey });
  }

  static async #onAssetCreate(event, target) {
    const assetType = target.dataset.assetType;
    const givenName = target.dataset.assetName;
    if (!assetType) return;
    const name = givenName ? `New ${givenName}` : "New Asset";
    await Item.implementation.create(
      { name, type: "asset", img: WwnFactionSheet.#assetImage(assetType), system: { assetType } },
      { parent: this.actor }
    );
  }

  static #assetImage(assetType) {
    const iconPath = "systems/wwn/assets/";
    const imgMap = { cunning: "cunning.png", force: "force.png", wealth: "wealth.png" };
    return assetType in imgMap ? `${iconPath}/${imgMap[assetType]}` : "icons/svg/item-bag.svg";
  }

  static async #onToggleAssetUnusable(event, target) {
    const item = this._getItem(target);
    if (item) await item.update({ "system.unusable": !item.system.unusable });
  }

  static async #onToggleAssetStealthed(event, target) {
    const item = this._getItem(target);
    if (item) await item.update({ "system.stealthed": !item.system.stealthed });
  }

  static async #onAddBase(event, target) {
    const assetType = target.dataset.assetType;
    const givenName = target.dataset.assetName;
    const result = await showWwnDialog({
      modifier: "faction-add-base",
      title: "Add New Base",
      content: `
        Adding a new base from Expand Influence Action.<br>
        Select HP (up to Faction max HP). One treasure per HP.
        <form>
          <div class="form-group">
            <label>Base HP</label>
            <input type='text' name='inputField'>
          </div>
        </form>`,
      buttons: [
        confirmButton({ label: "Expand Influence - New Base" }),
        cancelButton(),
      ],
    });
    if (!result || result === "cancel") return;
    const hp = Number(result.inputField);
    if (!hp) return;
    await this.addBase(
      hp,
      assetType,
      givenName ? `Base of Inf. ${givenName}` : "New Base of Inf",
      WwnFactionSheet.#assetImage(assetType),
    );
  }

  async addBase(hp, assetType, name, imgPath) {
    if (hp > this.actor.system.health.max) {
      return ui.notifications.error(
        `Base HP (${hp}) cannot be greater than Faction max HP (${this.actor.system.health.max})`
      );
    }
    if (hp > this.actor.system.facCreds) {
      return ui.notifications.error(`Base HP (${hp}) cannot be greater than Treasure (${this.actor.system.facCreds})`);
    }
    await this.actor.update({ "system.facCreds": this.actor.system.facCreds - hp });
    await this.actor.createEmbeddedDocuments("Item", [
      { name, type: "asset", img: imgPath, system: { assetType, health: { value: hp, max: hp }, baseOfInfluence: true } },
    ]);
  }

  static async #onRatingUp(event, target) {
    const type = target.dataset.ratingType;
    const ratingName = `${type}Rating`;
    const ratingLevel = Number(this.actor.system[ratingName]) || 0;
    if (ratingLevel >= 8) return ui.notifications.info("Rating is already at max");
    const targetLevel = ratingLevel + 1;
    let xp = this.actor.system.xp;
    const reqXp = HEALTH__XP_TABLE[targetLevel];
    if (reqXp === undefined) return;
    if (reqXp > xp) return ui.notifications.error(`Not enough XP to raise rating. Have ${xp} Need ${reqXp}`);
    xp -= reqXp;
    await this.actor.update({ "system.xp": xp, [`system.${ratingName}`]: targetLevel });
    ui.notifications.info(`Raised ${type} rating to ${targetLevel} using ${reqXp} xp`);
  }

  static async #onSetGoal() {
    const actor = this.actor;
    const result = await showWwnDialog({
      modifier: "faction-set-goal",
      title: "Set Goal",
      template: "systems/wwn/templates/actors/dialogs/faction-goal.html",
      context: { goalArray: FACTION_GOALS },
      buttons: [confirmButton({ label: "Set Goal" }), cancelButton()],
    });
    if (!result || result === "cancel") return;
    const goal = result.goal;
    const goalType = result.goalType;
    const match = FACTION_GOALS.find((g) => g.name === goal);
    if (!match) return ui.notifications.info("No goal selected. Ignoring");
    await actor.update({ "system.factionGoal": match.name, "system.factionGoalDesc": match.desc });
    const goalTypeMessage =
      goalType === "abandon"
        ? "<b>Goal abandoned.</b><br> Reminder: If not, it can abandon the old goal and pick a new one, but it will sacrifice its next turn's Faction Action to do so and may not trigger any Asset special abilities that round, either."
        : "<b>Goal completed</b>.<br> Reminder: The faction collects the experience points for doing so and picks a new goal.";
    await WwnFactionSheet.logMessage(actor, `Faction ${actor.name} changed their goal to ${match.name}.`, goalTypeMessage);
  }

  static async #onStartTurn() {
    await WwnFactionSheet.#startTurn(this.actor);

    const actor = this.actor;
    const result = await showWwnDialog({
      modifier: "faction-action",
      title: "Take Action",
      template: "systems/wwn/templates/actors/dialogs/faction-action.html",
      context: { actions: FACTION_ACTIONS },
      buttons: [confirmButton({ label: "Take Action" }), cancelButton()],
    });
    if (!result || result === "cancel") return;
    const action = result.action;
    const match = FACTION_ACTIONS.find((a) => a.name === action);
    if (!match) return;
    let rollString = null;
    if (match.roll) {
      const roll = new Roll(match.roll, actor.system);
      rollString = await roll.render();
    }
    await WwnFactionSheet.logMessage(
      actor,
      `Faction ${actor.name} action: ${action}`,
      match.desc,
      match.longDesc ?? null,
      rollString,
    );
  }

  /** Faction turn income/maintenance resolution. Ported verbatim from the legacy sheet. */
  static async #startTurn(actor) {
    const assets = actor.items.filter((i) => i.type === "asset");
    const wealthCunningForceIncome = Math.ceil(
      actor.system.wealthRating / 2 + (actor.system.cunningRating + actor.system.forceRating) / 4
    );
    const assetIncome = assets.map((i) => i.system.income).reduce((i, n) => i + n, 0);
    const assetWithMaint = assets.filter((i) => i.system.maintenance);
    const assetMaintTotal = assetWithMaint.map((i) => i.system.maintenance).reduce((i, n) => i + n, 0);

    const cunningAssetsOverLimit = Math.min(actor.system.cunningRating - actor.system.cunningAssets.length, 0);
    const forceAssetsOverLimit = Math.min(actor.system.forceRating - actor.system.forceAssets.length, 0);
    const wealthAssetsOverLimit = Math.min(actor.system.wealthRating - actor.system.wealthAssets.length, 0);
    const costFromAssetsOver = cunningAssetsOverLimit + forceAssetsOverLimit + wealthAssetsOverLimit;
    const income = wealthCunningForceIncome + assetIncome - assetMaintTotal + costFromAssetsOver;
    let newCreds = actor.system.facCreds + income;

    const assetsWithTurn = assets.filter((i) => i.system.turnRoll);
    let msg = `<b>Income this round: ${income}</b>.<br> From ratings: ${wealthCunningForceIncome}
       (0.5 * W + 0.25 * (C+F))<br>From assets: ${assetIncome}.<br>Maintenance -${assetMaintTotal}.<br>`;
    if (costFromAssetsOver < 0) msg += `Cost from # of assets over rating: ${costFromAssetsOver}.<br>`;
    if (income < 0) msg += ` <b>Loosing Treasure this turn.</b><br>`;

    let longMsg = "";
    if (assetsWithTurn.length > 0) longMsg += "Assets with turn notes/rolls:<br>";
    for (const a of assetsWithTurn) longMsg += `<i>${a.name}</i>: ${a.system.turnRoll} <br><br>`;

    if (newCreds < 0) {
      if (assetMaintTotal + newCreds < 0) {
        const updates = [];
        for (const asset of assetWithMaint) {
          newCreds += asset.system.maintenance;
          updates.push({ _id: asset.id, "system.unusable": true });
        }
        if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
        msg += ` <b>Out of money and unable to pay for all assets</b>, marking all assets with maintenance as unusable<br>`;
      } else {
        msg += ` <b>Out of money and unable to pay for all assets</b>, need to make assets unusable. Mark unusable for assets to cover treasure: ${income}<br>`;
      }
    }
    msg += `<b> Old Treasure: ${actor.system.facCreds}. New Treasure: ${newCreds}</b><br>`;
    await actor.update({ "system.facCreds": newCreds });
    await WwnFactionSheet.logMessage(actor, `New Turn for ${actor.name}`, msg, longMsg);
  }

  static async #onAddTag() {
    let tagOptions = "";
    let tagDesc = "";
    for (const tag of FACTION_TAGS) {
      tagOptions += `<option value='${tag.name}'>${tag.name}</option>`;
      tagDesc += `<div> <b>${tag.name}</b></div><div>${tag.desc}</div><div><i>Effect:</i> ${tag.effect}</div>`;
    }
    const actor = this.actor;
    const result = await showWwnDialog({
      modifier: "faction-add-tag",
      title: "Add Tag",
      content: `<div class="flex flex-col"><h1> Add Tag </h1><div class="flex flexrow">Tag: <select name="tag">${tagOptions}</select></div>${tagDesc}</div>`,
      buttons: [confirmButton({ label: "Add Tag" }), cancelButton()],
    });
    if (!result || result === "cancel") return;
    const match = FACTION_TAGS.find((t) => t.name === result.tag);
    if (!match) return ui.notifications.error(`Unable to find tag ${result.tag}`);
    const tags = [...actor.system.tags, match];
    await actor.update({ "system.tags": tags });
  }

  static async #onAddCustomTag() {
    const actor = this.actor;
    const result = await showWwnDialog({
      modifier: "faction-add-custom-tag",
      title: "Add Custom Tag",
      content: `<div class="flex flex-col">
          <div class="flex flexrow">Tag Name: <input type='text' name="tagname"></div>
          <div class="flex flexrow">Tag Desc: <textarea name="tagdesc" rows="4" cols="50"></textarea></div>
          <div class="flex flexrow">Tag Effect: <textarea name="tageffect" rows="4" cols="50"></textarea></div>
        </div>`,
      buttons: [confirmButton({ label: "Add Custom Tag" }), cancelButton()],
    });
    if (!result || result === "cancel") return;
    const tags = [...actor.system.tags, {
      name: result.tagname,
      desc: result.tagdesc,
      effect: result.tageffect,
    }];
    await actor.update({ "system.tags": tags });
  }

  static async #onDeleteTag(event, target) {
    const idx = Number(target.closest("[data-idx]")?.dataset.idx);
    const tags = this.actor.system.tags;
    const tag = tags[idx];
    if (!tag) return;
    const confirmed = await confirmWwnDialog({
      modifier: "delete-tag",
      title: "Delete Tag",
      content: `<p>Remove tag ${tag.name}?</p>`,
    });
    if (!confirmed) return;
    const next = tags.slice();
    next.splice(idx, 1);
    await this.actor.update({ "system.tags": next });
  }

  static async #onAddLog() {
    const actor = this.actor;
    const result = await showWwnDialog({
      modifier: "faction-add-log",
      title: "Add Log",
      content: `<form><div class="form-group">
          <label>Manual Log Entry. To inline a roll use [[1dX]].</label>
          <textarea name="inputField" rows="4" cols="50"></textarea>
        </div></form>`,
      buttons: [confirmButton({ label: "Add Manual Log Entry" }), cancelButton()],
    });
    if (!result || result === "cancel") return;
    const log = result.inputField;
    if (log) await WwnFactionSheet.logMessage(actor, "Manual Faction Log", log);
  }

  static async #onDeleteLog(event, target) {
    const idx = Number(target.closest("[data-idx]")?.dataset.idx);
    const logs = this.actor.system.log;
    if (!(idx in logs)) return;
    const confirmed = await confirmWwnDialog({
      modifier: "delete-log",
      title: "Delete Log",
      content: `<p>Remove this log entry?</p>`,
    });
    if (!confirmed) return;
    const next = logs.slice();
    next.splice(idx, 1);
    await this.actor.update({ "system.log": next });
  }

  static async #onDeleteAllLogs() {
    const confirmed = await confirmWwnDialog({
      modifier: "delete-all-logs",
      title: "Delete Log",
      content: `<p>Remove all logs for this faction (cannot be undone)?</p>`,
    });
    if (!confirmed) return;
    await this.actor.update({ "system.log": [] });
  }

  /** Whisper a chat log entry to the GM and append its rendered HTML to `system.log`. */
  static async logMessage(actor, title, content, longContent = null, logRollString = null) {
    const gmIds = ChatMessage.getWhisperRecipients("GM").filter((i) => i).map((i) => i.id).filter((i) => i !== null);

    if (game.modules?.get("foundryvtt-simple-calendar")?.active) {
      const c = SimpleCalendar.api.getCurrentCalendar();
      content = `(${c.currentDate.year}-${c.currentDate.month + 1}-${c.currentDate.day + 1}) ${content}`;
    }

    const { createCardMessage } = await import("../../chat/chat-card.mjs");
    const msg = await createCardMessage({
      title,
      actor,
      bodyTemplate: "systems/wwn/templates/chat/faction-log-body.hbs",
      context: { content, longContent, logRollString },
      whisper: gmIds,
      flags: { kind: "faction-log" },
    });
    let renderedContent = content;
    if (msg) {
      const html = await msg.getHTML();
      const el = html?.[0] ?? html;
      el?.querySelector?.(".message-header")?.remove();
      renderedContent = el?.innerHTML?.toString?.() ?? content;
    }
    const log = [...actor.system.log, renderedContent];
    await actor.update({ "system.log": log });
  }
}
