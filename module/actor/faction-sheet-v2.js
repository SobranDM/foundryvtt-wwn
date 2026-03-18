/**
 * Faction sheet using DocumentSheet and Handlebars PARTS (draw-steel style).
 */
import { WwnDocumentSheetV2 } from "../applications/document-sheet-v2.js";
import { WwnDialog } from "../dialog/wwn-dialog.js";
import { prepareActiveEffectCategories } from "../effects.mjs";
import { FACTION_TAGS, FACTION_GOALS, FACTION_ACTIONS } from "./faction-constants.js";

async function prepareFactionContext(document) {
  const actor = document;
  const source = actor.system ?? {};
  const sys = foundry.utils.deepClone(source);
  const config = CONFIG.WWN ?? {};
  return {
    name: actor.name,
    img: actor.img,
    system: sys,
    config: { ...config },
    enrichedDescription: await TextEditor.enrichHTML(actor.system.description ?? "", { async: true }),
    enrichedGoal: await TextEditor.enrichHTML(actor.system.factionGoalDesc ?? "", { async: true }),
    user: game.user,
    owner: actor.isOwner,
    editable: actor.sheet?.isEditable ?? false,
    effects: prepareActiveEffectCategories(actor.effects ?? []),
  };
}

const PARTS = {
  main: {
    template: "systems/wwn/templates/actors/faction-sheet.hbs",
    root: true,
  },
};

const DEFAULT_OPTIONS = {
  classes: ["wwn", "sheet", "actor", "faction"],
  position: { width: 730, height: 625 },
  actions: {},
  form: { submitOnChange: true, closeOnSubmit: false },
};

export class WwnActorSheetFactionV2 extends WwnDocumentSheetV2 {
    static PARTS = PARTS;

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(super.DEFAULT_OPTIONS ?? {}),
      DEFAULT_OPTIONS
    );

    get actor() {
      return this.document;
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      return foundry.utils.mergeObject(context, await prepareFactionContext(this.document));
    }

    async _preparePartContext(partId, context, options) {
      return super._preparePartContext?.(partId, context, options) ?? context;
    }

    getAssetImage(itemType) {
      const imgMap = { cunning: "cunning.png", force: "force.png", wealth: "wealth.png" };
      return itemType && imgMap[itemType] ? `systems/wwn/assets/${imgMap[itemType]}` : "icons/svg/item-bag.svg";
    }

    async logMessage(title, content, longContent = null, logRollString = null) {
      const gm_ids = (typeof ChatMessage?.getWhisperRecipients === "function" ? ChatMessage.getWhisperRecipients("GM") : [])
        .filter((i) => i)?.map((i) => i.id)?.filter((i) => i !== null) ?? [];
      if (game.modules?.get("foundryvtt-simple-calendar")?.active && typeof SimpleCalendar !== "undefined") {
        try {
          const c = SimpleCalendar.api.getCurrentCalendar();
          content = `(${c.currentDate.year}-${c.currentDate.month + 1}-${c.currentDate.day + 1}) ${content}`;
        } catch (_) {}
      }
      const cardData = { title, content, longContent, logRollString };
      const template = "systems/wwn/templates/chat/faction-log.hbs";
      const chatData = {
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        content: await renderTemplate(template, cardData),
        type: CONST.CHAT_MESSAGE_STYLES.WHISPER,
        whisper: gm_ids,
      };
      const msg = await ChatMessage.create(chatData);
      let finalContent = content;
      if (msg) {
        const html = await msg.getHTML();
        const el = html?.length ? html[0] : html;
        el?.querySelector?.(".message-header")?.remove();
        finalContent = el?.innerHTML ?? String(html);
      }
      const log = this.document.system.log ?? [];
      log.push(finalContent);
      await this.document.update({ system: { log } });
    }

    async addTag(name) {
      const match = FACTION_TAGS.filter((i) => i.name === name);
      if (!match.length) {
        ui.notifications?.error(`Error unable to find tag ${name}`);
        return;
      }
      const tags = this.document.system.tags ?? [];
      tags.push(match[0]);
      await this.document.update({ system: { tags } });
    }

    async addCustomTag(name, desc, effect) {
      const tags = this.document.system.tags ?? [];
      tags.push({ name, desc, effect });
      await this.document.update({ system: { tags } });
    }

    async addBase(hp, assetType, itemName, imgPath) {
      if (hp > this.document.system.health.max) {
        ui.notifications?.error(`Error HP of new base (${hp}) cannot be greater than faction max HP (${this.document.system.health.max})`);
        return;
      }
      if (hp > this.document.system.facCreds) {
        ui.notifications?.error(`Error HP of new base (${hp}) cannot be greater than treasure (${this.document.system.facCreds})`);
        return;
      }
      await this.document.update({ system: { facCreds: this.document.system.facCreds - hp } });
      await this.document.createEmbeddedDocuments("Item", [{
        name: itemName,
        type: "asset",
        img: imgPath,
        system: { assetType, health: { value: hp, max: hp }, baseOfInfluence: true },
      }], {});
    }

    async startTurn() {
      const actor = this.document;
      const assets = actor.items.filter((i) => i.type === "asset");
      const wealthCunningForceIncome = Math.ceil((actor.system.wealthRating / 2) + ((actor.system.cunningRating + actor.system.forceRating) / 4));
      const assetIncome = assets.map((i) => i.system.income ?? 0).reduce((i, n) => i + n, 0);
      const assetWithMaint = assets.filter((i) => i.system.maintenance);
      const assetMaintTotal = assetWithMaint.map((i) => i.system.maintenance ?? 0).reduce((i, n) => i + n, 0);
      const cunningAssetsOverLimit = Math.min((actor.system.cunningRating ?? 0) - (actor.system.cunningAssets?.length ?? 0), 0);
      const forceAssetsOverLimit = Math.min((actor.system.forceRating ?? 0) - (actor.system.forceAssets?.length ?? 0), 0);
      const wealthAssetsOverLimit = Math.min((actor.system.wealthRating ?? 0) - (actor.system.wealthAssets?.length ?? 0), 0);
      const costFromAssetsOver = cunningAssetsOverLimit + forceAssetsOverLimit + wealthAssetsOverLimit;
      const income = wealthCunningForceIncome + assetIncome - assetMaintTotal + costFromAssetsOver;
      let new_creds = (actor.system.facCreds ?? 0) + income;
      const assetsWithTurn = assets.filter((i) => i.system.turnRoll);
      let msg = `<b>Income this round: ${income}</b>.<br> From ratings: ${wealthCunningForceIncome} (0.5 * W + 0.25 * (C+F))<br>From assets: ${assetIncome}.<br>Maintenance -${assetMaintTotal}.<br>`;
      if (costFromAssetsOver < 0) msg += `Cost from # of assets over rating: ${costFromAssetsOver}.<br>`;
      if (income < 0) msg += ` <b>Loosing Treasure this turn.</b><br>`;
      let longMsg = "";
      if (assetsWithTurn.length > 0) {
        longMsg += "Assets with turn notes/rolls:<br>";
        for (const a of assetsWithTurn) longMsg += `<i>${a.name}</i>: ${a.system.turnRoll} <br><br>`;
      }
      const aitems = [];
      if (new_creds < 0 && assetMaintTotal + new_creds < 0) {
        for (const asset of assetWithMaint) {
          new_creds += (asset.system.maintenance ?? 0);
          aitems.push({ _id: asset.id, system: { unusable: true } });
        }
        if (aitems.length > 0) await actor.updateEmbeddedDocuments("Item", aitems);
        msg += ` <b>Out of money and unable to pay for all assets</b>, marking all assets with maintenance as unusable<br>`;
      } else if (new_creds < 0) {
        msg += ` <b>Out of money and unable to pay for all assets</b>, need to make assets unusable.<br>`;
      }
      msg += `<b> Old Treasure: ${actor.system.facCreds}. New Treasure: ${new_creds}</b><br>`;
      await actor.update({ system: { facCreds: new_creds } });
      await this.logMessage(`New Turn for ${this.document.name}`, msg, longMsg);
    }

    async _onAssetCreate(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const target = ev.currentTarget;
      const assetType = target?.dataset?.assetType;
      const givenName = target?.dataset?.assetName;
      const itemName = givenName ? `New ${givenName}` : "New Asset";
      const imgPath = this.getAssetImage(assetType);
      if (assetType) {
        await this.document.createEmbeddedDocuments("Item", [{ name: itemName, type: "asset", img: imgPath, system: { assetType } }], {});
      }
      this.render();
    }

    async _onAddLog(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const html = `<form class=""><div class="form-group"><label>Manual Log Entry. To inline a roll use [[1dX]].</label><textarea id="inputField" name="inputField" rows="4" cols="50" class=""></textarea></div></form>`;
      await WwnDialog.wait({
        title: "Add Log",
        content: html,
        buttons: [
          { action: "add", label: "Add Manual Log Entry", icon: "fa-solid fa-check", callback: (_ev, _btn, dialog) => {
            const form = dialog.element?.querySelector?.("form");
            const log = form?.querySelector?.('[name="inputField"]')?.value;
            if (log) this.logMessage("Manual Faction Log", log);
          }},
          { action: "close", label: "Close", default: true },
        ],
      });
    }

    async _onDelLog(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const div = ev.currentTarget.closest(".logdiv");
      const idx = div?.dataset?.idx != null ? parseInt(div.dataset.idx, 10) : undefined;
      const logs = [...(this.document.system.log ?? [])];
      const log = idx != null ? logs[idx] : undefined;
      const performDelete = await WwnDialog.confirm({ title: "Delete Log", content: `Remove log: ${log}?` });
      if (!performDelete) return;
      if (div) div.style.display = "none";
      if (idx != null) logs.splice(idx, 1);
      await this.document.update({ system: { log: logs } });
    }

    async _onDelLogAll(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const performDelete = await WwnDialog.confirm({ title: "Delete Log", content: "Remove all logs for this faction (cannot be undone)?" });
      if (!performDelete) return;
      await this.document.update({ system: { log: [] } });
    }

    async _onDelTag(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const div = ev.currentTarget.closest(".tagdiv");
      const idx = div?.dataset?.idx != null ? parseInt(div.dataset.idx, 10) : undefined;
      const tags = [...(this.document.system.tags ?? [])];
      const tag = idx != null ? tags[idx] : undefined;
      const performDelete = await WwnDialog.confirm({ title: "Delete Tag", content: `Remove tag ${tag?.name}?` });
      if (!performDelete) return;
      if (div) div.style.display = "none";
      if (idx != null) tags.splice(idx, 1);
      await this.document.update({ system: { tags } });
    }

    async _onAddTag(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      let tagOptions = "";
      for (const tag of FACTION_TAGS) tagOptions += `<option value='${tag.name}'>${tag.name}</option>`;
      const dialogTemplate = `<div class="flex flex-col"><h1> Add Tag </h1><div class="flex flexrow"> Tag: <select id="tag">${tagOptions}</select></div></div>`;
      await WwnDialog.wait({
        title: "Add Tag",
        content: dialogTemplate,
        buttons: [
          { action: "addTag", label: "Add Tag", icon: "fa-solid fa-check", default: true, callback: (_ev, _btn, dialog) => {
            const sel = dialog.element?.querySelector?.("#tag");
            if (sel) this.addTag(sel.value);
          }},
          { action: "close", label: "Close" },
        ],
      });
    }

    async _onAddCustomTag(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const dialogTemplate = `<div class="flex flex-col"><h1> Add Tag </h1><div class="flex flex-col"><div class="flex flexrow"> Tag Name: <input type='text' id="tagname" name='tagname' class=""></input></div><div class="flex flexrow"> Tag Desc: <textarea id="tagdesc" name="tagdesc" rows="4" cols="50"></textarea></div><div class="flex flexrow"> Tag Effect: <textarea id="tageffect" name="tageffect" rows="4" cols="50"></textarea></div></div></div>`;
      await WwnDialog.wait({
        title: "Add Custom Tag",
        content: dialogTemplate,
        buttons: [
          { action: "addTag", label: "Add Custom Tag", icon: "fa-solid fa-check", default: true, callback: (_ev, _btn, dialog) => {
            const el = dialog.element;
            const name = el?.querySelector?.("#tagname")?.value ?? "";
            const desc = el?.querySelector?.("#tagdesc")?.value ?? "";
            const effect = el?.querySelector?.("#tageffect")?.value ?? "";
            this.addCustomTag(name, desc, effect);
          }},
          { action: "close", label: "Close" },
        ],
      });
    }

    async _onStartTurn(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      this.startTurn();
      const contentHtml = await renderTemplate("systems/wwn/templates/actors/dialogs/faction-action.hbs", { actions: FACTION_ACTIONS });
      await WwnDialog.wait({
        title: "Take Action",
        content: contentHtml,
        buttons: [
          { action: "setgoal", label: "Take Action", icon: "fa-solid fa-check", default: true, callback: async (_ev, _btn, dialog) => {
            const form = dialog.element?.querySelector?.("form");
            const action = form?.querySelector?.('[name="action"]')?.value;
            if (!action) return;
            for (const a of FACTION_ACTIONS) {
              if (action === a.name) {
                const title = `Faction ${this.document.name} action: ${action}`;
                const msg = a.desc;
                const longDesc = a.longDesc ?? null;
                let rollString = null;
                if (a.roll) {
                  const roll = new Roll(a.roll, this.document.system);
                  rollString = await roll.render();
                }
                this.logMessage(title, msg, longDesc, rollString);
              }
            }
          }},
          { action: "close", label: "Close" },
        ],
      });
    }

    async _onSetGoal(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const contentHtml = await renderTemplate("systems/wwn/templates/actors/dialogs/faction-goal.hbs", { goalArray: FACTION_GOALS });
      const runGoalForm = async (dialog) => {
        const form = dialog.element?.querySelector?.("form");
        const goal = form?.querySelector?.('[name="goal"]')?.value;
        const goalType = form?.querySelector?.('[name="goalType"]')?.value;
        if (goal && goal.length === 0 && goalType !== "abandon") {
          ui.notifications?.info("No goal selected. Ignoring");
          return;
        }
        for (const g of FACTION_GOALS) {
          if (g.name === goal) {
            await this.document.update({ system: { factionGoal: g.name, factionGoalDesc: g.desc } });
            let goalTypeMessage = "<b>Goal completed</b>.<br> Reminder: The faction collects the experience points for doing so and picks a new goal.";
            if (goalType === "abandon") goalTypeMessage = "<b>Goal abandoned.</b><br> Reminder: If not, it can abandon the old goal and pick a new one, but it will sacrifice its next turn's Faction Action to do so and may not trigger any Asset special abilities that round, either.";
            await this.logMessage(`Faction ${this.document.name} changed their goal to ${g.name}.`, goalTypeMessage);
            return;
          }
        }
      };
      await WwnDialog.wait({
        title: "Set Goal",
        content: contentHtml,
        buttons: [
          { action: "setgoal", label: "Set Goal", icon: "fa-solid fa-check", default: true, callback: (_ev, _btn, dialog) => runGoalForm(dialog) },
          { action: "close", label: "Close" },
        ],
      });
    }

    async _onBaseAdd(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const target = ev.currentTarget;
      const assetType = target?.dataset?.assetType;
      const givenName = target?.dataset?.assetName;
      const content = `Adding a new base from Expand Influence Action.<br> Select HP (up to Faction max HP). One treasure per HP.<br><form><div class="form-group"><label>Base HP</label><input type='text' name='inputField'></input></div></form>`;
      await WwnDialog.wait({
        title: "Add New Base",
        content,
        buttons: [
          { action: "yes", label: "Expand Influence - New Base", icon: "fa-solid fa-check", default: true, callback: (_ev, _btn, dialog) => {
            const form = dialog.element?.querySelector?.("form");
            const hp = form?.querySelector?.('[name="inputField"]')?.value;
            if (hp && hp !== "") {
              const nHp = Number(hp);
              if (nHp) {
                const itemName = givenName ? `Base of Inf. ${givenName}` : "New Base of Inf";
                const imgPath = this.getAssetImage(assetType);
                this.addBase(nHp, assetType, itemName, imgPath);
              } else ui.notifications?.error(hp + " is not a number");
            }
          }},
          { action: "close", label: "Close" },
        ],
      });
      this.render();
    }

    _onItemEdit(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const wrapper = ev.currentTarget.closest(".item");
      const item = this.document.items.get(wrapper?.dataset?.itemId);
      if (item) item.sheet?.render(true);
    }

    async _onItemDelete(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const li = ev.currentTarget.closest(".item");
      const itemId = li?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      if (!item) return;
      const performDelete = await WwnDialog.confirm({
        title: game.i18n.format("WWN.Delete", { name: item.name }),
        content: game.i18n.format("WWN.DeleteContent", { name: item.name, actor: this.document.name }),
      });
      if (!performDelete) return;
      await this.document.deleteEmbeddedDocuments("Item", [itemId]);
      if (li) li.style.display = "none";
      this.render();
    }

    async _onAssetRepair(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      ui.notifications?.info("on set _onAssetRepair");
    }

    async _onAssetUnusable(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const wrapper = ev.currentTarget.closest(".item");
      const asset = this.document.items.get(wrapper?.dataset?.itemId);
      if (!asset) return;
      const new_status = !asset.system.unusable;
      await asset.update({ system: { unusable: new_status } });
      this.render();
    }

    async _onAssetStealthed(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const wrapper = ev.currentTarget.closest(".item");
      const asset = this.document.items.get(wrapper?.dataset?.itemId);
      if (!asset) return;
      const new_status = !asset.system.stealthed;
      await asset.update({ system: { stealthed: new_status } });
      this.render();
    }

    async _onRatingUp(ev, type) {
      ev.preventDefault();
      ev.stopPropagation();
      const rating = this.document.system[`${type}Rating`] ?? 0;
      const max = 5;
      if (rating >= max) return;
      await this.document.update({ system: { [`${type}Rating`]: rating + 1 } });
      this.render();
    }

    async _onLocationChange(ev) {
      ev.preventDefault();
      const itemId = ev.currentTarget.closest(".item")?.dataset?.itemId;
      const item = this.document.items.get(itemId);
      if (item) await item.update({ "system.location": ev.target.value });
      this.render();
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      const content = this.element?.querySelector?.(".window-content") ?? this.element;
      if (!content) return;
      const on = (sel, handler) => content.querySelectorAll(sel).forEach((node) => node.addEventListener("click", handler));
      const onChange = (sel, handler) => content.querySelectorAll(sel).forEach((node) => node.addEventListener("change", handler));
      on(".asset-create", this._onAssetCreate.bind(this));
      on(".faction-turn", this._onStartTurn.bind(this));
      on(".faction-tag-add", this._onAddTag.bind(this));
      on(".faction-tag-add-custom", this._onAddCustomTag.bind(this));
      on(".faction-tag-delete", this._onDelTag.bind(this));
      on(".faction-log-delete", this._onDelLog.bind(this));
      on(".faction-log-add", this._onAddLog.bind(this));
      on(".faction-log-delete-all", this._onDelLogAll.bind(this));
      on(".force-up", (ev) => this._onRatingUp(ev, "force"));
      on(".cunning-up", (ev) => this._onRatingUp(ev, "cunning"));
      on(".wealth-up", (ev) => this._onRatingUp(ev, "wealth"));
      on(".set-goal", this._onSetGoal.bind(this));
      on(".item-fix", this._onAssetRepair.bind(this));
      on(".asset-toggle-unusable", this._onAssetUnusable.bind(this));
      on(".asset-toggle-stealthed", this._onAssetStealthed.bind(this));
      on(".add-base", this._onBaseAdd.bind(this));
      on(".item-edit", this._onItemEdit.bind(this));
      on(".item-delete", this._onItemDelete.bind(this));
      onChange(".faction-field-wide input", this._onLocationChange.bind(this));
      content.querySelectorAll(".inventory .item-titles .item-caret").forEach((node) => {
        node.addEventListener("click", (ev) => {
          const parent = ev.currentTarget.parentElement?.parentElement;
          const itemList = parent?.querySelector(".item-list");
          const icon = ev.currentTarget.querySelector(".fas");
          if (!itemList || !icon) return;
          if (itemList.style.display === "none") {
            icon.classList.remove("fa-caret-right");
            icon.classList.add("fa-caret-down");
            itemList.style.display = "";
          } else {
            icon.classList.remove("fa-caret-down");
            icon.classList.add("fa-caret-right");
            itemList.style.display = "none";
          }
        });
      });
      // Initialize active tab content (changeTab only runs on click; content needs "active" on first render)
      if (content.querySelector?.(".sheet-tabs.tabs")) {
        const initial = this.tabGroups?.primary ?? "attributes";
        this.changeTab(initial, "primary", { force: true, updatePosition: false });
      }
    }
}

// Button to show long descriptions in faction log chat messages
Hooks.on("renderChatMessage", (message, html, _user) => {
  const root = html?.length ? html[0] : html;
  const longDesc = root?.querySelector?.(".longShowDesc");
  if (longDesc) {
    longDesc.addEventListener("click", function toggleLong(event) {
      event.preventDefault();
      const hiddenDesc = root.querySelector(".hiddenLong");
      if (hiddenDesc) hiddenDesc.style.display = "";
      longDesc.style.display = "none";
      longDesc.removeEventListener("click", toggleLong);
    }, { once: true });
  }
});
