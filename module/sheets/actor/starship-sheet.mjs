/**
 * WWN Starship sheet (AppV2/SheetV2).
 *
 * Starships do not derive from `WwnActorBase` (see module/data/actor/starship.mjs)
 * and have no powers/inventory-toggle concepts, so this sheet extends
 * `ActorSheetV2` directly rather than `WwnBaseActorSheet` — mirroring
 * module/sheets/actor/faction-sheet.mjs.
 *
 * Tabs: Main (stats + crew stations left, equipment collapsibles right) |
 * Details (hull picker, crew, economy, description) | Effects (shared
 * `wwnEffectsList` partial).
 *
 * Rolls (`rollStation` / `rollItem`) delegate to `module/helpers/starship-rolls.mjs`
 * (station checks) and `WwnItem#roll` (weapons), keeping this sheet thin.
 */
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { ActorItemActionsMixin } from "../mixins/actor-item-actions.mjs";
import { onManageActiveEffect, prepareActiveEffectCategories } from "../../helpers/effects.mjs";
import { prepareResourceBars } from "../helpers/resource-bar.mjs";
import {
  STATIONS,
  DEFAULT_STATION_SKILL,
  buildStationAssignmentUpdate,
} from "../../helpers/starship-crew.mjs";
import { rollStationCheck, rollSpikeDrill } from "../../helpers/starship-rolls.mjs";
import { applyHullPreset } from "../../config/starship-hulls.mjs";
import {
  captainFocusBonusesForShip,
  bridgeFocusBonusesForShip,
  effectiveStarshipDrive,
} from "../../helpers/starship-focus-bonuses.mjs";
import { remainingCombatBonusHp } from "../../helpers/starship-combat-hp.mjs";
import { showWwnDialog, cancelButton } from "../../applications/wwn-dialog.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TPL = "systems/wwn/templates/actor/starship";
const EFFECTS_TPL = "systems/wwn/templates/actor/partials/effects-tab.hbs";
const REASSIGN_TPL = "systems/wwn/templates/dialog/starship-reassign-crew.hbs";

export class WwnStarshipSheet extends composeMixins(CollapsibleSectionsMixin, ActorItemActionsMixin)(
  HandlebarsApplicationMixin(ActorSheetV2)
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["wwn", "wwn-sheet", "sheet", "actor", "starship"],
    position: { width: 1100, height: 820 },
    form: { submitOnChange: true },
    window: { resizable: true, contentClasses: ["flex", "flex-col", "min-h-0"] },
    actions: {
      applyHull: WwnStarshipSheet.#onApplyHull,
      clearStationActor: WwnStarshipSheet.#onClearStationActor,
      openStationActor: WwnStarshipSheet.#onOpenStationActor,
      reassignCrew: WwnStarshipSheet.#onReassignCrew,
      rollStation: WwnStarshipSheet.#onRollStation,
      rollSpikeDrill: WwnStarshipSheet.#onRollSpikeDrill,
      createItem: WwnStarshipSheet.#onCreateItem,
      toggleDisabled: WwnStarshipSheet.#onToggleDisabled,
      effectAction: WwnStarshipSheet.#onEffectAction,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "WWN.Tabs.Main" },
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
    details: { template: `${TPL}/tabs/details.hbs`, scrollable: [""] },
    effects: { template: EFFECTS_TPL, scrollable: [""] },
  };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

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

    context.resourceBars = prepareResourceBars(actor).filter((bar) => bar.id === "hp");
    context.collapsed = this.sectionStates ?? {};

    context.stations = this.#prepareStations();

    context.weapons = system.weapons ?? [];
    context.defenses = system.defenses ?? [];
    context.fittings = system.fittings ?? [];

    context.speedEditable = system.speed !== null && system.speed !== undefined;

    context.powerOver = (system.power?.free ?? 0) < 0;
    context.massOver = (system.mass?.free ?? 0) < 0;
    context.hardpointsOver = (system.hardpoints?.used ?? 0) > (system.hardpoints?.max ?? 0);

    context.effects = prepareActiveEffectCategories(actor.effects);

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? ""
    );

    const captainBonuses = await captainFocusBonusesForShip(actor);
    const bridgeBonuses = await bridgeFocusBonusesForShip(actor);
    context.captainFocusBonuses = captainBonuses;
    context.bridgeFocusBonuses = bridgeBonuses;
    context.effectiveCommandPoints = (Number(system.npcCp) || 0) + captainBonuses.commandPointsBonus;
    context.effectiveDrive = await effectiveStarshipDrive(actor);
    context.combatBonusHp = remainingCombatBonusHp(actor);

    return context;
  }

  /** Build station context rows for the sheet (and reassign dialog). */
  #prepareStations() {
    const stations = this.actor.system.stations ?? {};
    return STATIONS.map((key) => {
      const data = stations[key] ?? {};
      const actorUuid = data.actor ?? "";
      const linkedActor = actorUuid ? fromUuidSync(actorUuid) : null;
      return {
        key,
        label: `WWN.Starship.Station.${key}`,
        skill: DEFAULT_STATION_SKILL[key],
        actorUuid,
        actorName: linkedActor?.name ?? "",
        broken: !!actorUuid && !linkedActor,
        formula: data.formula ?? "",
      };
    });
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
    this._bindFocusSelectInputs();
  }

  /**
   * When hull type changes via the Details select, also seed preset stats.
   * @override
   */
  _prepareSubmitData(event, form, formData, updateData) {
    const submitData = super._prepareSubmitData(event, form, formData, updateData);
    const nextHull = submitData.system?.hullType;
    const prevHull = this.actor.system.hullType;
    if (nextHull && nextHull !== prevHull && CONFIG.WWN.starshipHulls?.[nextHull]) {
      foundry.utils.mergeObject(submitData, foundry.utils.expandObject(applyHullPreset(nextHull)));
    }
    return submitData;
  }

  /* -------------------------------------------- */
  /*  Crew assignment                             */
  /* -------------------------------------------- */

  /**
   * Assign an actor UUID to a station, optionally clearing the same UUID
   * from other stations on this ship.
   * @param {string} stationKey
   * @param {string|null} actorUuid
   * @param {{ exclusive?: boolean }} [options]
   */
  async assignStation(stationKey, actorUuid, { exclusive = false } = {}) {
    const updates = buildStationAssignmentUpdate(
      this.actor.system.stations,
      stationKey,
      actorUuid,
      { exclusive }
    );
    if (!Object.keys(updates).length) return;
    await this.actor.update(updates);
  }

  /**
   * Prompt for a department when an Actor is dropped on the sheet.
   * Cancel leaves assignments unchanged.
   * @param {Actor} actor
   * @returns {Promise<Actor|null>}
   */
  async #promptAssignRole(actor) {
    const choice = await showWwnDialog({
      modifier: "starship-assign-role",
      title: game.i18n.localize("WWN.Starship.AssignRoleTitle"),
      content: `<p>${game.i18n.format("WWN.Starship.AssignRolePrompt", { name: actor.name })}</p>`,
      buttons: [
        ...STATIONS.map((key) => ({
          action: key,
          label: game.i18n.localize(`WWN.Starship.Station.${key}`),
          callback: () => key,
        })),
        { ...cancelButton(), default: true },
      ],
    });
    if (!choice || choice === "cancel" || !STATIONS.includes(choice)) return null;
    await this.assignStation(choice, actor.uuid, { exclusive: true });
    return actor;
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                                */
  /* -------------------------------------------- */

  /** @override — any Actor drop prompts for a crew role. */
  async _onDropActor(_event, actor) {
    if (!this.isEditable) return null;
    return this.#promptAssignRole(actor);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onApplyHull() {
    const hullType = this.actor.system.hullType;
    if (!hullType) return ui.notifications.warn(game.i18n.localize("WWN.Starship.NoHullSelected"));
    const updates = applyHullPreset(hullType);
    if (!Object.keys(updates).length) {
      return ui.notifications.warn(game.i18n.localize("WWN.Starship.UnknownHull"));
    }
    await this.actor.update(updates);
    const label = CONFIG.WWN.starshipHulls?.[hullType]?.label ?? hullType;
    ui.notifications.info(game.i18n.format("WWN.Starship.HullApplied", { hull: label }));
  }

  static async #onClearStationActor(_event, target) {
    const station = target.dataset.station;
    if (!station) return;
    await this.assignStation(station, null);
  }

  static async #onOpenStationActor(_event, target) {
    const station = target.dataset.station;
    if (!station) return;
    const uuid = this.actor.system.stations?.[station]?.actor;
    if (!uuid) return;
    const linked = await fromUuid(uuid);
    if (!linked) {
      return ui.notifications.warn(game.i18n.localize("WWN.Starship.BrokenActor"));
    }
    linked.sheet?.render(true);
  }

  static async #onReassignCrew() {
    if (!this.isEditable) return;
    const sheet = this;

    const buildContentHtml = async () =>
      foundry.applications.handlebars.renderTemplate(REASSIGN_TPL, {
        stations: sheet.#prepareStations(),
      });

    const bind = (dialog) => {
      const root = dialog.element?.querySelector(".wwn-starship-reassign");
      if (!root) return;

      root.querySelectorAll("[data-action='clear']").forEach((el) => {
        el.addEventListener("click", async (event) => {
          event.preventDefault();
          const station = event.currentTarget.dataset.station;
          if (!station) return;
          await sheet.assignStation(station, null);
          await refresh(dialog);
        });
      });

      root.querySelectorAll(".wwn-starship-reassign-actor[draggable]").forEach((el) => {
        el.addEventListener("dragstart", (event) => {
          const uuid = event.currentTarget.dataset.uuid;
          if (!uuid) return;
          event.dataTransfer.setData(
            "text/plain",
            JSON.stringify({ type: "Actor", uuid })
          );
          event.dataTransfer.effectAllowed = "move";
        });
      });

      root.querySelectorAll(".wwn-starship-reassign-row").forEach((row) => {
        row.addEventListener("dragover", (event) => {
          event.preventDefault();
          row.classList.add("drag-over");
        });
        row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
        row.addEventListener("drop", async (event) => {
          event.preventDefault();
          row.classList.remove("drag-over");
          const station = row.dataset.station;
          if (!station) return;
          let data;
          try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
          } catch {
            return;
          }
          if (data?.type !== "Actor" || !data.uuid) return;
          const dropped = await fromUuid(data.uuid);
          if (!dropped || dropped.documentName !== "Actor") return;
          await sheet.assignStation(station, dropped.uuid, { exclusive: true });
          await refresh(dialog);
        });
      });
    };

    const refresh = async (dialog) => {
      const html = await buildContentHtml();
      const current = dialog.element?.querySelector(".wwn-starship-reassign");
      if (!current) return;
      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      const next = wrap.firstElementChild;
      if (next) current.replaceWith(next);
      bind(dialog);
    };

    await showWwnDialog({
      modifier: "starship-reassign",
      title: game.i18n.localize("WWN.Starship.ReassignCrew"),
      content: await buildContentHtml(),
      position: { width: 420 },
      buttons: [
        {
          action: "done",
          label: game.i18n.localize("Close"),
          default: true,
          callback: () => true,
        },
      ],
      onRender: (_event, dialog) => bind(dialog),
    });
  }

  static #onRollStation(event, target) {
    const station = target.dataset.station;
    if (!station) return;
    return rollStationCheck(this.actor, station, { skipDialog: event.shiftKey || event.ctrlKey });
  }

  static #onRollSpikeDrill(event, _target) {
    return rollSpikeDrill(this.actor, { skipDialog: event.shiftKey || event.ctrlKey });
  }

  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    if (!type) return;
    const name = game.i18n.format("DOCUMENT.New", {
      type: game.i18n.localize(`TYPES.Item.${type}`),
    });
    return Item.implementation.create({ name, type }, { parent: this.actor });
  }

  static async #onToggleDisabled(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    await item.update({ "system.disabled": !item.system.disabled });
  }

  static #onEffectAction(event, target) {
    return onManageActiveEffect(event, this.actor, target);
  }
}
