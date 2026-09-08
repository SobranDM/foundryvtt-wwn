/**
 * WWN Project sheet (AppV2/SheetV2).
 *
 * Projects do not derive from `WwnActorBase` (see module/data/actor/project.mjs)
 * and have no powers/effects-pipeline/inventory concepts, so this sheet
 * extends `ActorSheetV2` directly — mirroring module/sheets/actor/faction-sheet.mjs.
 *
 * Single "main" tab: header (name/rules-line/scale/magnitude/status) + a
 * resource/time progress readout + an optional suggested-cost calculator on
 * the left, a Contributions panel (add/link/unlink/delete contributor rows,
 * cloned in spirit from the faction asset panel) on the right, and
 * effects/notes prose editors below.
 *
 * Contribution rows are inline-editable only (no item-sheet pencil): the
 * shared `WwnItemSheet` maps unmapped item types to a generic template that
 * doesn't match this schema, so exposing `editItem` here would render a
 * mismatched sheet. Delete/open-linked-actor/unlink cover the row's needs.
 */
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { ActorItemActionsMixin } from "../mixins/actor-item-actions.mjs";
import { computeWwnCost, computeGodboundCost } from "../../helpers/project-calculator.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TPL = "systems/wwn/templates/actor/project";

export class WwnProjectSheet extends composeMixins(CollapsibleSectionsMixin, ActorItemActionsMixin)(
  HandlebarsApplicationMixin(ActorSheetV2)
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["wwn", "wwn-sheet", "sheet", "actor", "project"],
    position: { width: 900, height: 760 },
    form: { submitOnChange: true },
    window: { resizable: true, contentClasses: ["flex", "flex-col", "min-h-0"] },
    actions: {
      contributionCreate: WwnProjectSheet.#onContributionCreate,
      openContributionActor: WwnProjectSheet.#onOpenContributionActor,
      unlinkContribution: WwnProjectSheet.#onUnlinkContribution,
      calculate: WwnProjectSheet.#onCalculate,
      applyCalculated: WwnProjectSheet.#onApplyCalculated,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [{ id: "main", label: "WWN.Tabs.Main" }],
      initial: "main",
    },
  };

  /** @override */
  static PARTS = {
    header: { template: `${TPL}/header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: `${TPL}/tabs/main.hbs`, scrollable: [""] },
  };

  /** Last calculator result, kept only for the "apply" button; not persisted. */
  #calcResult = null;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    context.actor = actor;
    context.system = system;
    context.source = actor.toObject().system;
    context.owner = actor.isOwner;
    context.editable = this.isEditable;
    context.config = CONFIG.WWN;
    context.isWwn = system.gameLine === "wwn";
    context.isGodbound = system.gameLine === "godbound";
    context.fundedPct = Math.round((system.fundedFraction ?? 0) * 100);
    context.calcResult = this.#calcResult;
    context.resourceLabelDefault = game.i18n.localize(
      context.isGodbound ? "WWN.project.resourceLabelDefaultGodbound" : "WWN.project.resourceLabelDefaultWwn"
    );

    context.contributions = actor.items
      .filter((i) => i.type === "contribution")
      .map((item) => {
        const linked = item.system.actorUuid ? fromUuidSync(item.system.actorUuid) : null;
        return {
          item,
          linkedActor: linked,
          broken: !!item.system.actorUuid && !linked,
        };
      })
      .sort((a, b) => (a.item.name > b.item.name ? 1 : -1));

    context.enrichedEffects = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.effects ?? ""
    );
    context.enrichedNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.notes ?? ""
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
    this._bindItemFieldEditors(this.#onItemFieldChange);
    this._bindFocusSelectInputs();
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

  /* -------------------------------------------- */
  /*  Drag and Drop                                */
  /* -------------------------------------------- */

  /**
   * Drop an actor onto a contribution row to link it there; drop anywhere
   * else on the sheet to create a new contribution for that actor.
   * @override
   */
  async _onDropActor(event, actor) {
    if (!this.isEditable || !actor) return null;
    const row = event.target?.closest?.("[data-item-id]");
    const itemId = row?.dataset.itemId;
    const existing = itemId ? this.actor.items.get(itemId) : null;
    if (existing?.type === "contribution") {
      await existing.update({ "system.actorUuid": actor.uuid, name: actor.name });
      return actor;
    }
    await this.#createContribution(actor);
    return actor;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  async #createContribution(actor = null) {
    const name = actor?.name ?? "New Contribution";
    await Item.implementation.create(
      {
        name,
        type: "contribution",
        img: CONFIG.WWN.defaultIcons.contribution ?? "icons/svg/card-hand.svg",
        system: { actorUuid: actor?.uuid ?? null },
      },
      { parent: this.actor }
    );
  }

  static async #onContributionCreate() {
    await this.#createContribution();
  }

  static async #onOpenContributionActor(event, target) {
    const item = this._getItem(target);
    const uuid = item?.system.actorUuid;
    if (!uuid) return;
    const linked = await fromUuid(uuid);
    if (!linked) return ui.notifications.warn(game.i18n.localize("WWN.project.brokenLink"));
    linked.sheet?.render(true);
  }

  static async #onUnlinkContribution(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    await item.update({ "system.actorUuid": null });
  }

  /**
   * Compute a suggested cost (and, for WWN, time) from `system.calc` and
   * stash it on the sheet instance for the "apply" button/inline readout.
   * Pure display — never writes to `resource`/`time` on its own.
   */
  static async #onCalculate() {
    const system = this.actor.system;
    const calc = system.calc;
    if (system.gameLine === "wwn") {
      const result = computeWwnCost({
        effectPoints: calc.effectPoints,
        areaKey: calc.area,
        doubleSilver: calc.doubleSilver,
      });
      this.#calcResult = { gameLine: "wwn", ...result };
    } else {
      const result = computeGodboundCost({
        scopeBase: calc.scopeBase,
        wardRating: calc.wardRating,
        resistanceRating: calc.resistanceRating,
        magnitudeMult: calc.magnitudeMult,
      });
      this.#calcResult = { gameLine: "godbound", ...result };
    }
    this.render({ parts: ["main"] });
  }

  /** Fill `resource.max` (and `time.max` for WWN) from the last calculator result. */
  static async #onApplyCalculated() {
    const result = this.#calcResult;
    if (!result) return;
    const updates = { "system.resource.max": result.cost };
    if (result.gameLine === "wwn") updates["system.time.max"] = result.weeks;
    await this.actor.update(updates);
    ui.notifications.info(game.i18n.localize("WWN.project.applyResult"));
  }
}
