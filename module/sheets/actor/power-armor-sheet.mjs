/**
 * Modular power armor sheet — PC-like chrome with live pilot overlay.
 */
import { WwnBaseActorSheet } from "./base-actor-sheet.mjs";
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { prepareActiveEffectCategories } from "../../helpers/effects.mjs";
import { preparePowersTabContext } from "../../helpers/power-sections.mjs";
import { applyFramePreset, integralFittingDocuments } from "../../config/power-armor-frames.mjs";
import {
  rollSuitCheck,
  rollSuitSave,
  rollSuitSkill,
  rollSuitWeapon,
} from "../../helpers/power-armor-rolls.mjs";
import { useEmergencyPowerCell } from "../../helpers/power-armor-ops.mjs";
import { DEFAULT_RUNTIME_MINUTES } from "../../helpers/power-armor-derive.mjs";
import { hasActiveCommitment } from "../../config/power-subtypes.mjs";
import { isNpc } from "../../helpers/actor-types.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../../applications/wwn-dialog.mjs";

const TPL = "systems/wwn/templates/actor/power-armor";

/**
 * Build a favorites-dock entry from an owned item.
 * @param {Item} item
 * @param {"suit"|"pilot"} source
 */
function favoriteEntry(item, source) {
  const entry = {
    id: item.id,
    name: item.name,
    img: item.img,
    type: item.type,
    source,
  };
  if (item.type === "power") {
    entry.isActive = item.system.isActive;
    entry.canActivatePower = hasActiveCommitment(item.system.subType, item.system) && !item.system.isActive;
    entry.canDeactivatePower = item.system.isActive;
  }
  if (item.type === "weapon" && isNpc(item.actor)) {
    entry.counter = item.system.counter;
  }
  return entry;
}

export class WwnPowerArmorSheet extends composeMixins(CollapsibleSectionsMixin)(WwnBaseActorSheet) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["power-armor"],
    position: { width: 820, height: 820 },
    actions: {
      applyFrame: WwnPowerArmorSheet.#onApplyFrame,
      clearPilot: WwnPowerArmorSheet.#onClearPilot,
      openPilot: WwnPowerArmorSheet.#onOpenPilot,
      togglePowered: WwnPowerArmorSheet.#onTogglePowered,
      refreshSoak: WwnPowerArmorSheet.#onRefreshSoak,
      insertPowerCell: WwnPowerArmorSheet.#onInsertPowerCell,
      useEmergencyCell: WwnPowerArmorSheet.#onUseEmergencyCell,
      markMaintenance: WwnPowerArmorSheet.#onMarkMaintenance,
      skipMaintenance: WwnPowerArmorSheet.#onSkipMaintenance,
      togglePilotTrained: WwnPowerArmorSheet.#onTogglePilotTrained,
      transferFromPilot: WwnPowerArmorSheet.#onTransferFromPilot,
      toggleDisabled: WwnPowerArmorSheet.#onToggleDisabled,
      toggleFavorite: WwnPowerArmorSheet.#onToggleFavorite,
      rollCheck: WwnPowerArmorSheet.#onRollCheck,
      rollSave: WwnPowerArmorSheet.#onRollSave,
      rollSkill: WwnPowerArmorSheet.#onRollSkill,
      rollItem: WwnPowerArmorSheet.#onRollItem,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "WWN.Tabs.Main" },
        { id: "armor", label: "WWN.Tabs.Armor" },
        { id: "inventory", label: "WWN.Tabs.Inventory" },
        { id: "powers", label: "WWN.Tabs.Powers" },
        { id: "details", label: "WWN.Tabs.Details" },
        { id: "effects", label: "WWN.Tabs.Effects" },
      ],
      initial: "main",
    },
  };

  /** @override */
  static PARTS = {
    header: { template: `${TPL}/header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: `${TPL}/tabs/main.hbs`, scrollable: [""] },
    armor: { template: `${TPL}/tabs/armor.hbs`, scrollable: [""] },
    inventory: { template: `${TPL}/tabs/inventory.hbs`, scrollable: [""] },
    powers: { template: `${TPL}/tabs/powers.hbs`, scrollable: [""] },
    details: { template: `${TPL}/tabs/details.hbs`, scrollable: [""] },
    effects: { template: `${TPL}/tabs/effects.hbs`, scrollable: [""] },
  };

  /** @override */
  _prepareItems(context) {
    // Suit inventory only — pilot skills/powers are prepared in `_prepareContext`.
    const items = Array.from(this.actor.items.values()).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.weapons = items.filter((i) => i.type === "weapon");
    context.armors = items.filter((i) => i.type === "armor");
    context.gear = items.filter((i) => i.type === "item" || i.type === "armor");
    context.currencies = [];
    context.skills = [];
    context.powerSections = [];
    context.classEdges = [];
    context.foci = [];
  }

  /**
   * Resolve suit item first, then linked pilot item (favorites / powers overlay).
   * @override
   */
  _getItem(target) {
    const itemId = target.closest?.("[data-item-id]")?.dataset.itemId
      ?? target.dataset?.itemId;
    if (!itemId) return null;
    const suitItem = this.actor.items.get(itemId);
    if (suitItem) return suitItem;
    const pilot = this.actor.system.pilotResolved?.actor;
    return pilot?.items.get(itemId) ?? null;
  }

  /**
   * @param {Actor} owner
   * @param {"suit"|"pilot"} source
   * @returns {object[]}
   */
  static #favoritesFromActor(owner, source) {
    if (!owner) return [];
    const ids = owner.system.favorites ?? [];
    return ids
      .map((id) => owner.items.get(id))
      .filter((i) => i)
      .map((i) => favoriteEntry(i, source));
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const derived = system.derived ?? {};

    context.config = CONFIG.WWN;
    context.collapsed = this.sectionStates ?? {};
    context.derived = derived;
    context.overBudget = !!system.overBudget;
    context.massOver = (system.mass?.free ?? 0) < 0;
    context.powerOver = (system.power?.free ?? 0) < 0;
    context.favoritesEnabled = true;

    const pilotResolved = system.pilotResolved ?? { mode: "unassigned" };
    context.pilot = {
      uuid: system.pilot?.actor ?? "",
      name: pilotResolved.actor?.name ?? "",
      broken: !!pilotResolved.broken,
      linked: pilotResolved.mode === "actor",
      trained: !!system.pilotTrained,
      actor: pilotResolved.actor ?? null,
    };

    // Overlay display from pilot when linked
    const pilot = pilotResolved.actor;
    const suitFavIds = new Set(system.favorites ?? []);
    const pilotFavIds = new Set(pilot?.system?.favorites ?? []);

    if (pilot) {
      const abilities = Object.entries(pilot.system.abilities ?? {}).map(([key, ability]) => {
        const row = { key, label: CONFIG.WWN.abilityAbbreviations?.[key] ?? key, ...ability };
        if (key === "str" && derived.effectiveStrength != null) {
          row.value = derived.effectiveStrength;
          row.mod = derived.effectiveStrengthMod ?? ability.mod;
          row.overlay = true;
        }
        return row;
      });
      context.abilities = abilities;
      context.saves = Object.entries(pilot.system.saves ?? {})
        .filter(([id]) => id !== "base")
        .map(([id, save]) => ({
          id,
          ...save,
        }));
      context.skills = pilot.items
        .filter((i) => i.type === "skill")
        .sort((a, b) => a.name.localeCompare(b.name));
      context.pilotHp = pilot.system.hp;
      context.pilotSystem = pilot.system;
      preparePowersTabContext(context, pilot, {
        isSectionCollapsed: (id) => this.isSectionCollapsed?.(id) ?? false,
      });
      for (const section of context.powerSections ?? []) {
        for (const power of section.powers ?? []) {
          power.favorited = pilotFavIds.has(power.id);
        }
      }
    } else {
      context.abilities = [];
      context.saves = [];
      context.skills = [];
      context.pilotHp = { value: 0, max: 0 };
      context.powerSections = [];
    }

    context.fittings = system.fittings ?? [];
    context.weapons = system.weapons ?? context.weapons ?? [];
    context.gear = system.gear ?? context.gear ?? [];
    for (const item of [...context.weapons, ...context.gear]) {
      item.favorited = suitFavIds.has(item.id);
    }

    // Composite favorites: suit first, then pilot
    context.favorites = [
      ...WwnPowerArmorSheet.#favoritesFromActor(actor, "suit"),
      ...WwnPowerArmorSheet.#favoritesFromActor(pilot, "pilot"),
    ];
    context.isFavorite = (id) => suitFavIds.has(id) || pilotFavIds.has(id);

    context.ac = derived.ac ?? system.ac ?? 10;
    context.useTrauma = game.settings.get("wwn", "useTrauma");

    context.effects = prepareActiveEffectCategories(actor.effects);
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? "",
    );

    context.frameOptions = Object.fromEntries(
      Object.entries(CONFIG.WWN.powerArmorFrames ?? {}).map(([key, frame]) => [key, frame.label]),
    );

    return context;
  }

  /** @override */
  _prepareSubmitData(event, form, formData, updateData) {
    const submitData = super._prepareSubmitData(event, form, formData, updateData);
    const nextFrame = submitData.system?.frameType;
    const prevFrame = this.actor.system.frameType;
    if (nextFrame && nextFrame !== prevFrame && CONFIG.WWN.powerArmorFrames?.[nextFrame]) {
      foundry.utils.mergeObject(submitData, foundry.utils.expandObject(applyFramePreset(nextFrame)));
    }

    // Strip pilot ability edits — abilities are display-only from the pilot
    if (submitData.system?.abilities) delete submitData.system.abilities;

    // Pilot HP edits arrive as system.pilotHp.* via form names — redirect
    const pilotHp = submitData.system?.pilotHp;
    if (pilotHp) {
      delete submitData.system.pilotHp;
      this._pendingPilotHp = pilotHp;
    }

    return submitData;
  }

  /** @override */
  async _processSubmitData(event, form, submitData, options) {
    await super._processSubmitData(event, form, submitData, options);
    if (this._pendingPilotHp) {
      const pilotUuid = this.actor.system.pilot?.actor;
      const pilot = pilotUuid ? await fromUuid(pilotUuid) : null;
      if (pilot) {
        const update = {};
        if (this._pendingPilotHp.value !== undefined) update["system.hp.value"] = this._pendingPilotHp.value;
        if (this._pendingPilotHp.max !== undefined) update["system.hp.max"] = this._pendingPilotHp.max;
        if (Object.keys(update).length) await pilot.update(update);
      }
      this._pendingPilotHp = null;
    }
  }

  /** @override */
  async _onDropActor(event, data) {
    const actor = await fromUuid(data.uuid);
    if (!actor || actor.documentName !== "Actor") return;
    if (!["character", "pc"].includes(actor.type)) {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.PilotMustBePc"));
    }
    await this.actor.update({ "system.pilot.actor": actor.uuid });
  }

  /** @override */
  async _onDropItem(event, data) {
    const item = await fromUuid(data.uuid);
    if (!item) return super._onDropItem?.(event, data);
    // Allow armorFitting / weapon / gear onto the suit
    return super._onDropItem(event, data);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onApplyFrame() {
    const frameType = this.actor.system.frameType;
    if (!frameType) {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoFrameSelected"));
    }
    const preset = applyFramePreset(frameType);
    if (!Object.keys(preset).length) {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.UnknownFrame"));
    }
    await this.actor.update(preset);

    // Remove previous integral fittings, then add frame integrals
    const toDelete = this.actor.items.filter((i) => i.type === "armorFitting" && i.system.integral).map((i) => i.id);
    if (toDelete.length) await this.actor.deleteEmbeddedDocuments("Item", toDelete);
    const docs = integralFittingDocuments(frameType);
    if (docs.length) await this.actor.createEmbeddedDocuments("Item", docs);

    // Seed soak from derived plating after recreate
    this.actor.prepareData();
    const soakMax = this.actor.system.derived?.soakMax ?? 0;
    const runtimeMax = this.actor.system.derived?.runtimeMax ?? DEFAULT_RUNTIME_MINUTES;
    await this.actor.update({
      "system.soak.value": soakMax,
      "system.soak.max": soakMax,
      "system.runtime.max": runtimeMax,
      "system.runtime.remaining": this.actor.system.perpetual ? null : runtimeMax,
    });

    ui.notifications.info(
      game.i18n.format("WWN.PowerArmor.FrameApplied", {
        frame: CONFIG.WWN.powerArmorFrames[frameType]?.label ?? frameType,
      }),
    );
  }

  static async #onClearPilot() {
    await this.actor.update({ "system.pilot.actor": null });
  }

  static async #onOpenPilot() {
    const uuid = this.actor.system.pilot?.actor;
    const pilot = uuid ? await fromUuid(uuid) : null;
    pilot?.sheet?.render(true);
  }

  static async #onTogglePowered() {
    await this.actor.update({ "system.powered": !this.actor.system.powered });
  }

  static async #onRefreshSoak() {
    const max = this.actor.system.derived?.soakMax ?? this.actor.system.soak.max ?? 0;
    await this.actor.update({ "system.soak.value": max, "system.soak.max": max });
  }

  static async #onInsertPowerCell() {
    if (this.actor.system.perpetual || this.actor.system.derived?.perpetual) {
      return ui.notifications.info(game.i18n.localize("WWN.PowerArmor.PerpetualPower"));
    }
    const max = this.actor.system.derived?.runtimeMax ?? DEFAULT_RUNTIME_MINUTES;
    await this.actor.update({
      "system.powered": true,
      "system.runtime.max": max,
      "system.runtime.remaining": max,
    });
  }

  static async #onUseEmergencyCell() {
    return useEmergencyPowerCell(this.actor);
  }

  static async #onMarkMaintenance() {
    await this.actor.update({ "system.maintenance.skipped": 0 });
  }

  static async #onSkipMaintenance() {
    const skipped = (this.actor.system.maintenance?.skipped ?? 0) + 1;
    await this.actor.update({ "system.maintenance.skipped": skipped });
  }

  static async #onTogglePilotTrained() {
    const uuid = this.actor.system.pilot?.actor;
    if (!uuid) return;
    const list = [...(this.actor.system.trainedPilots ?? [])];
    const idx = list.indexOf(uuid);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(uuid);
    await this.actor.update({ "system.trainedPilots": list });
  }

  static async #onTransferFromPilot() {
    const uuid = this.actor.system.pilot?.actor;
    const pilot = uuid ? await fromUuid(uuid) : null;
    if (!pilot) {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
    }
    const weapons = pilot.items.filter((i) => i.type === "weapon");
    if (!weapons.length) {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilotWeapons"));
    }

    const options = weapons.map((w) => `<option value="${w.id}">${w.name}</option>`).join("");
    const content = `<form><div class="form-group"><label>${game.i18n.localize("WWN.PowerArmor.TransferWeapon")}</label><select name="weaponId">${options}</select></div></form>`;
    const result = await showWwnDialog({
      modifier: "power-armor-transfer",
      title: game.i18n.localize("WWN.PowerArmor.TransferFromPilot"),
      content,
      buttons: [
        confirmButton({ label: "WWN.PowerArmor.Transfer" }),
        cancelButton(),
      ],
    });
    if (!result || result === "cancel") return;
    const weapon = pilot.items.get(result.weaponId);
    if (!weapon) return;

    const data = weapon.toObject();
    delete data._id;
    // Prefer advanced mount if present, else basic, else heavy
    const mounts = this.actor.system.derived?.mounts ?? [];
    const preferred =
      mounts.find((m) => m.effectId?.includes("Advanced"))
      ?? mounts.find((m) => m.effectId?.includes("Basic"))
      ?? mounts[0];
    if (preferred?.effectId) {
      data.flags = foundry.utils.mergeObject(data.flags ?? {}, {
        wwn: { armorMountEffectId: preferred.effectId },
      });
    }
    await this.actor.createEmbeddedDocuments("Item", [data]);
    await weapon.delete();
  }

  static async #onToggleDisabled(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    await item.update({ "system.disabled": !item.system.disabled });
  }

  static async #onToggleFavorite(event, target) {
    const item = this._getItem(target) ?? this.actor.items.get(target.dataset.itemId);
    if (!item?.actor) return;
    await item.actor.toggleFavorite(item.id);
  }

  static #onRollCheck(event, target) {
    return rollSuitCheck(this.actor, target.dataset.ability, { skipDialog: event.shiftKey });
  }

  static #onRollSave(event, target) {
    return rollSuitSave(this.actor, target.dataset.save, { skipDialog: event.shiftKey });
  }

  static async #onRollSkill(event, target) {
    const name = target.dataset.skillName;
    const uuid = this.actor.system.pilot?.actor;
    const pilot = uuid ? await fromUuid(uuid) : null;
    const skill = pilot?.items.find((i) => i.type === "skill" && i.name === name);
    if (!skill) {
      return ui.notifications.warn(game.i18n.localize("WWN.PowerArmor.NoPilot"));
    }
    return rollSuitSkill(this.actor, skill, { skipDialog: event.shiftKey });
  }

  static async #onRollItem(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    if (item.type === "weapon") {
      return rollSuitWeapon(this.actor, item, { skipDialog: event.shiftKey });
    }
    return item.roll?.({ skipDialog: event.shiftKey });
  }
}
