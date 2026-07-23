/**
 * Shared WWN actor sheet behavior: tabs, item lists, powers grouping,
 * effects, rolls, and inline item-field editing.
 */
import { onManageActiveEffect, prepareActiveEffectCategories } from "../../helpers/effects.mjs";
import { prepareResourceBars } from "../helpers/resource-bar.mjs";
import { applyLegacySheetAliases, remapLegacySubmitData } from "../../helpers/sheet-legacy-bridge.mjs";
import { resetWeaponCounters } from "../../helpers/weapon-counter.mjs";
import { WwnDice } from "../../dice/dice.mjs";
import { refreshPowers } from "../../helpers/power-refresh.mjs";
import { preparePowersTabContext } from "../../helpers/power-sections.mjs";
import { reloadWeapon } from "../../helpers/ammo.mjs";
import { applySubtypeDefaults, POWER_SUBTYPES, hasActiveCommitment } from "../../config/power-subtypes.mjs";
import { syncPowerTransferEffects } from "../../helpers/power-effects.mjs";
import { isNpc, isPc } from "../../helpers/actor-types.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../../applications/wwn-dialog.mjs";
import composeMixins from "../mixins/compose-mixins.mjs";
import { ActorItemActionsMixin } from "../mixins/actor-item-actions.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Shared WWN actor sheet behavior.
 */
export class WwnBaseActorSheet extends composeMixins(ActorItemActionsMixin)(
  HandlebarsApplicationMixin(ActorSheetV2)
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["wwn", "wwn-sheet", "sheet", "actor"],
    position: { width: 780, height: 820 },
    form: { submitOnChange: true },
    window: { resizable: true, contentClasses: ["flex", "flex-col", "min-h-0"] },
    actions: {
      createItem: WwnBaseActorSheet.#onCreateItem,
      showItem: WwnBaseActorSheet.#onShowItem,
      itemSearch: WwnBaseActorSheet.#onItemSearch,
      effectAction: WwnBaseActorSheet.#onEffectAction,
      rollCheck: WwnBaseActorSheet.#onRollCheck,
      rollSave: WwnBaseActorSheet.#onRollSave,
      toggleEquipped: WwnBaseActorSheet.#onToggleEquipped,
      toggleStowed: WwnBaseActorSheet.#onToggleStowed,
      toggleFavorite: WwnBaseActorSheet.#onToggleFavorite,
      togglePrepared: WwnBaseActorSheet.#onTogglePrepared,
      toggleInstalled: WwnBaseActorSheet.#onToggleInstalled,
      toggleContainer: WwnBaseActorSheet.#onToggleContainer,
      deactivatePower: WwnBaseActorSheet.#onDeactivatePower,
      activatePower: WwnBaseActorSheet.#onActivatePower,
      powerDamage: WwnBaseActorSheet.#onPowerDamage,
      refreshScene: WwnBaseActorSheet.#onRefreshScene,
      refreshDay: WwnBaseActorSheet.#onRefreshDay,
      resetWeaponCounters: WwnBaseActorSheet.#onResetWeaponCounters,
      reloadWeapon: WwnBaseActorSheet.#onReloadWeapon,
      rollHitDice: WwnBaseActorSheet.#onRollHitDice,
      rollMorale: WwnBaseActorSheet.#onRollMorale,
    },
  };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;

    context.actor = actor;
    context.system = foundry.utils.deepClone(actor.system);
    context.flags = actor.flags;
    context.owner = actor.isOwner;
    context.editable = this.isEditable;
    context.rollData = actor.getRollData();
    context.config = CONFIG.WWN;

    context.resourceBars = prepareResourceBars(actor);
    context.collapsed = this.sectionStates ?? {};
    context.separateRangedAC = game.settings.get("wwn", "separateRangedAC");
    context.useTrauma = game.settings.get("wwn", "useTrauma");
    context.showMovement = game.settings.get("wwn", "showMovement");
    context.favoritesEnabled = isPc(actor);
    applyLegacySheetAliases(context.system, { separateRangedAC: context.separateRangedAC });

    // Save list from derived data
    context.saves = Object.entries(actor.system.saves ?? {})
      .filter(([id]) => id !== "base")
      .map(([id, save]) => ({ id, ...save }));

    this._prepareItems(context);

    if (actor.type !== "faction") {
      context.effects = prepareActiveEffectCategories(actor.allApplicableEffects?.() ?? actor.effects);
    }

    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      actor.system.biography ?? "",
      { relativeTo: actor, secrets: actor.isOwner, rollData: context.rollData }
    );

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    // context is shared across parts — never restructure context.tabs here.
    const tab = context.tabs?.[partId];
    if (tab) context.tab = tab;
    return context;
  }

  /**
   * Remap legacy form paths and collapse null/array submit quirks.
   * @override
   */
  _processFormData(event, form, formData) {
    const remapped = remapLegacySubmitData(foundry.utils.flattenObject(formData.object));
    return foundry.utils.expandObject(remapped);
  }

  /** Categorize items for rendering. Subclasses may extend via `_prepareTypeItems`. */
  _prepareItems(context) {
    const actor = this.actor;
    const items = Array.from(actor.items.values()).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const favorites = actor.system.favorites ?? [];

    context.weapons = items.filter((i) => i.type === "weapon");
    context.armors = items.filter((i) => i.type === "armor");
    context.gear = items.filter((i) => i.type === "item");
    context.currencies = items.filter((i) => i.type === "currency");
    context.skills = items.filter((i) => i.type === "skill").sort((a, b) => a.name.localeCompare(b.name));

    // Powers / ClassEdges / Foci / resource pools
    preparePowersTabContext(context, actor, {
      isSectionCollapsed: (id) => this.isSectionCollapsed?.(id) ?? false,
    });

    // Favorites dock entries (dangling IDs filtered at render time)
    context.favorites = favorites
      .map((id) => actor.items.get(id))
      .filter((i) => i)
      .map((i) => {
        const entry = { id: i.id, name: i.name, img: i.img, type: i.type };
        if (i.type === "power") {
          entry.isActive = i.system.isActive;
          entry.canActivatePower = hasActiveCommitment(i.system.subType, i.system) && !i.system.isActive;
          entry.canDeactivatePower = i.system.isActive;
        }
        if (i.type === "weapon" && isNpc(actor)) {
          entry.counter = i.system.counter;
        }
        return entry;
      });

    // Mark favorite state for star toggles
    context.isFavorite = (id) => favorites.includes(id);
    const favoritable = [
      ...context.weapons,
      ...context.gear,
      ...context.armors,
      ...context.skills,
      ...(context.powerSections ?? []).flatMap((s) => s.powers),
    ];
    for (const item of favoritable) {
      item.favorited = favorites.includes(item.id);
    }

    context.tracksWeaponCounter = isNpc(actor);

    this._prepareTypeItems?.(context, items);
  }

  /* -------------------------------------------- */
  /*  Render                                      */
  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    this._bindItemFieldEditors(this.#onItemFieldChange);
    this._bindFocusSelectInputs();

    // Drag items for macros / favorites
    if (this.actor.isOwner) {
      for (const li of this.element.querySelectorAll("[data-item-id]")) {
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
      }
    }
  }

  async #onItemFieldChange(event) {
    const input = event.currentTarget;
    const itemId = input.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const field = input.dataset.itemField;
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.type === "number" || input.dataset.dtype === "Number") value = Number(value) || 0;

    if (field === "system.internalResource.value") {
      const max = item.system.internalResource?.max ?? 0;
      if (max > 0) value = Math.max(0, Math.min(value, max));
    }

    const previous = foundry.utils.getProperty(item.toObject(), field);
    if (value === previous) return;
    await item.update({ [field]: value });
    await this.onItemFieldUpdated(item, field, value, previous);
  }

  /**
   * Hook after an inline [data-item-field] edit. Override on sheets that need side effects.
   * @param {Item} item
   * @param {string} field
   * @param {*} value
   * @param {*} previous
   */
  async onItemFieldUpdated(item, field, value, previous) {}

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    const system = {};
    const subtype = target.dataset.subtype;
    // Inventory section headers pass createSubType as data-subtype for gear
    // kinds (consumable/treasure/personal). Power create uses the same attr
    // for real power subtypes — only apply as system.subType for powers.
    if (type === "power") {
      system.subType = subtype || (await WwnBaseActorSheet.#pickPowerSubType());
      if (!system.subType) return;
      Object.assign(system, applySubtypeDefaults(system.subType, system));
    } else if (type === "item") {
      const kind = subtype;
      if (kind === "consumable" || "consumable" in target.dataset) {
        system.charges = { value: 0, max: 1 };
      } else if (kind === "treasure" || "treasure" in target.dataset) {
        system.treasure = true;
      } else if (kind === "personal" || "personal" in target.dataset) {
        system.treasure = true;
        system.personal = true;
      }
    } else if (subtype) {
      system.subType = subtype;
    }
    const name = game.i18n.format("DOCUMENT.New", {
      type: game.i18n.localize(`TYPES.Item.${type}`),
    });
    return Item.implementation.create({ name, type, system }, { parent: this.actor });
  }

  /** @returns {Promise<string|null>} Selected power subtype key, or null if cancelled. */
  static async #pickPowerSubType() {
    const subtypes = Object.entries(POWER_SUBTYPES).map(([key, cfg]) => ({
      key,
      label: game.i18n.localize(cfg.label),
    }));
    const result = await showWwnDialog({
      modifier: "power-subtype",
      title: game.i18n.localize("WWN.Power.SubType"),
      template: "systems/wwn/templates/dialog/power-subtype-picker.hbs",
      context: { subtypes },
      buttons: [confirmButton(), cancelButton()],
    });
    if (!result || result === "cancel") return null;
    return result.subType ?? null;
  }

  /** Toggle an in-row description drawer; Shift+click posts a chat card. */
  static async #onShowItem(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    if (event.shiftKey) return item.show();

    const entry = target.closest(".item-entry");
    if (!entry) return item.show();
    const row = entry.querySelector(":scope > .item");

    const existing = entry.querySelector(":scope > .item-summary");
    if (existing) {
      row?.classList.remove("expanded");
      await WwnBaseActorSheet.#slideUpRemove(existing);
      return;
    }

    const list = entry.closest(".item-list");
    const others = list
      ? [...list.querySelectorAll(":scope > .item-entry > .item-summary")]
      : [];
    await Promise.all(
      others.map((el) => {
        el.closest(".item-entry")?.querySelector(":scope > .item")?.classList.remove("expanded");
        return WwnBaseActorSheet.#slideUpRemove(el);
      })
    );

    const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.description ?? "",
      { async: true, relativeTo: item }
    );
    const summary = document.createElement("div");
    summary.classList.add("item-summary");
    summary.innerHTML = enriched || `<p><em>${game.i18n.localize("WWN.None")}</em></p>`;
    row?.classList.add("expanded");
    await WwnBaseActorSheet.#slideDownAppend(entry, summary);
  }

  /** Animate an element to height 0 then remove (legacy jQuery slideUp(200)). */
  static #slideUpRemove(el) {
    return new Promise((resolve) => {
      if (!el?.isConnected) return resolve();
      const finish = () => {
        el.removeEventListener("transitionend", onEnd);
        clearTimeout(fallback);
        el.remove();
        resolve();
      };
      const onEnd = (event) => {
        if (event.target !== el || event.propertyName !== "height") return;
        finish();
      };
      el.style.overflow = "hidden";
      el.style.height = `${el.scrollHeight}px`;
      void el.offsetHeight;
      el.style.transition = "height 200ms ease";
      el.style.height = "0px";
      el.addEventListener("transitionend", onEnd);
      const fallback = setTimeout(finish, 250);
    });
  }

  /** Append then animate from height 0 (legacy jQuery slideDown(200)). */
  static #slideDownAppend(parent, el) {
    return new Promise((resolve) => {
      const finish = () => {
        el.removeEventListener("transitionend", onEnd);
        clearTimeout(fallback);
        el.style.height = "";
        el.style.overflow = "";
        el.style.transition = "";
        resolve();
      };
      const onEnd = (event) => {
        if (event.target !== el || event.propertyName !== "height") return;
        finish();
      };
      el.style.overflow = "hidden";
      el.style.height = "0px";
      parent.appendChild(el);
      const targetHeight = el.scrollHeight;
      void el.offsetHeight;
      el.style.transition = "height 200ms ease";
      el.style.height = `${targetHeight}px`;
      el.addEventListener("transitionend", onEnd);
      const fallback = setTimeout(finish, 250);
    });
  }

  /** Search all visible compendiums for items of a type (optionally power subtype) and add one. */
  static async #onItemSearch(event, target) {
    const itemType = target.dataset.type;
    const subType = target.dataset.subtype;
    const candidateItems = {};

    for (const pack of game.packs) {
      if (pack.metadata?.ownership?.PLAYER === "NONE") continue;
      const items = (await pack.getDocuments()).filter((i) => {
        if (i.type !== itemType) return false;
        if (itemType === "power" && subType) return i.system?.subType === subType;
        return true;
      });
      for (const candidate of items.map((i) => i.toObject())) {
        candidateItems[candidate.name] = candidate;
      }
    }

    const names = Object.keys(candidateItems).sort();
    if (!names.length) {
      ui.notifications?.info(game.i18n.localize("WWN.Sheet.SearchNoResults"));
      return;
    }

    const choices = Object.fromEntries(names.map((n) => [n, n]));
    const result = await showWwnDialog({
      modifier: "item-search",
      title: game.i18n.format("WWN.Sheet.SearchAddTitle", { type: itemType }),
      content: `<div class="form-group"><div class="form-fields">
        <select name="itemName">${names
          .map((n) => `<option value="${foundry.utils.escapeHTML(n)}">${foundry.utils.escapeHTML(n)}</option>`)
          .join("")}</select>
      </div></div>`,
      buttons: [confirmButton(), cancelButton()],
    });
    if (!result || result === "cancel") return;
    const chosen = candidateItems[result.itemName];
    if (chosen) await this.actor.createEmbeddedDocuments("Item", [chosen]);
  }

  static #onEffectAction(event, target) {
    const row = target.closest("li");
    const parentId = row?.dataset.parentId;
    const owner =
      parentId && parentId !== this.actor.id ? this.actor.items.get(parentId) ?? this.actor : this.actor;
    return onManageActiveEffect(event, owner, target);
  }

  static #onRollCheck(event, target) {
    return WwnDice.rollCheck(this.actor, target.dataset.ability, { skipDialog: event.shiftKey });
  }

  static #onRollSave(event, target) {
    return WwnDice.rollSave(this.actor, target.dataset.save, { skipDialog: event.shiftKey });
  }

  static #onRollHitDice() {
    return WwnDice.rollHitDice(this.actor);
  }

  static #onRollMorale() {
    return WwnDice.rollMorale(this.actor);
  }

  static async #onResetWeaponCounters() {
    await resetWeaponCounters(this.actor);
  }

  static async #onReloadWeapon(event, target) {
    const item = this._getItem(target);
    if (item?.type === "weapon") await reloadWeapon(item);
  }

  static async #onToggleEquipped(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    const equipped = !item.system.equipped;
    await item.update({ "system.equipped": equipped, "system.stowed": !equipped });
    if (item.system.container?.isContainer) {
      const contained = this.actor.items.filter((i) => i.system.containerId === item.id);
      await this.actor.updateEmbeddedDocuments(
        "Item",
        contained.map((i) => ({ _id: i.id, "system.equipped": false, "system.stowed": equipped || item.system.stowed }))
      );
    }
  }

  static async #onToggleStowed(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    const stowed = !item.system.stowed;
    await item.update({ "system.stowed": stowed, "system.equipped": stowed ? false : item.system.equipped });
    if (item.system.container?.isContainer) {
      const contained = this.actor.items.filter((i) => i.system.containerId === item.id);
      await this.actor.updateEmbeddedDocuments(
        "Item",
        contained.map((i) => ({ _id: i.id, "system.equipped": false, "system.stowed": item.system.equipped || stowed }))
      );
    }
  }

  static async #onToggleFavorite(event, target) {
    const item = this._getItem(target) ?? this.actor.items.get(target.dataset.itemId);
    if (item) await this.actor.toggleFavorite(item.id);
  }

  static async #onTogglePrepared(event, target) {
    const item = this._getItem(target);
    if (!item || item.type !== "power" || item.system.subType !== "spell") return;

    const markingPrepared = !item.system.prepared;
    if (markingPrepared && this.actor.type === "pc") {
      const prepared = this.actor.system.casting?.prepared ?? {};
      if ((prepared.max ?? 0) > 0 && (prepared.value ?? 0) >= prepared.max) {
        return ui.notifications.warn(game.i18n.localize("WWN.Power.PreparedAtMax"));
      }
    }

    await item.update({ "system.prepared": markingPrepared });
  }

  /** Cyberware/art install toggle, with alienation adjustment. */
  static async #onToggleInstalled(event, target) {
    const item = this._getItem(target);
    if (!item || item.type !== "power") return;
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

  /** Toggle a container's open/closed state (contents visibility). */
  static async #onToggleContainer(event, target) {
    const item = this._getItem(target);
    if (!item || !item.system.container?.isContainer) return;
    await item.update({ "system.container.isOpen": !item.system.container.isOpen });
  }

  static async #onDeactivatePower(event, target) {
    const item = this._getItem(target);
    if (item) await item.deactivatePower();
  }

  static async #onActivatePower(event, target) {
    const item = this._getItem(target);
    if (item) await item.activatePower();
  }

  static async #onPowerDamage(event, target) {
    const item = this._getItem(target);
    if (item) await item.rollPowerDamage();
  }

  static #onRefreshScene() {
    return refreshPowers(this.actor, "scene");
  }

  static #onRefreshDay() {
    return refreshPowers(this.actor, "day");
  }

  /* -------------------------------------------- */
  /*  Drag                                        */
  /* -------------------------------------------- */

  _onDragStart(event) {
    const target = event.currentTarget;
    if ("link" in event.target.dataset) return;
    if (target.dataset.itemId) {
      const item = this.actor.items.get(target.dataset.itemId);
      if (item) {
        event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
      }
    }
  }
}
