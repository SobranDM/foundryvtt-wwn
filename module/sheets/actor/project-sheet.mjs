/**
 * WWN Project sheet (AppV2/SheetV2).
 *
 * Projects do not derive from `WwnActorBase` (see module/data/actor/project.mjs)
 * and have no powers/effects-pipeline/inventory concepts, so this sheet
 * extends `ActorSheetV2` directly — mirroring module/sheets/actor/faction-sheet.mjs.
 *
 * Header (name/rules-line/scale/magnitude/status) + two tabs:
 * - Progress: resource/time progress readout, the Contributions panel
 *   (add/link/unlink/delete contributor rows, cloned in spirit from the
 *   faction asset panel — kept compact since most projects only have a
 *   handful of contributors), and the optional suggested-cost calculator.
 * - Description: the effects/notes prose editors.
 *
 * Contribution rows are inline-editable only (no item-sheet pencil): the
 * shared `WwnItemSheet` maps unmapped item types to a generic template that
 * doesn't match this schema, so exposing `editItem` here would render a
 * mismatched sheet. Delete/open-linked-actor/unlink cover the row's needs.
 *
 * The suggested-cost calculator result is *derived*, not cached: every
 * render recomputes it straight from the persisted `system.calc` inputs
 * (see the module-level `computeCalcResult` below), so it can never go
 * stale relative to the inputs on screen — there is no separate
 * "Calculate" click step to forget.
 * "Apply" is the only action, and it fills `resource.max`/`time.max` from
 * that same live computation.
 */
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { ActorItemActionsMixin } from "../mixins/actor-item-actions.mjs";
import { computeWwnCost, computeGodboundCost, compareByName } from "../../helpers/project-calculator.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TPL = "systems/wwn/templates/actor/project";

/**
 * Pure derivation of the suggested-cost readout from a project's persisted
 * `system.calc` scratch inputs. Used both for the always-live sheet display
 * and for "Apply", so the two can never disagree.
 * @param {object} system Project actor system data (`gameLine`, `calc`).
 * @returns {{ gameLine: "wwn"|"godbound", cost: number, weeks?: number, difficulty?: number }}
 */
function computeCalcResult(system) {
  const calc = system.calc;
  if (system.gameLine === "wwn") {
    return {
      gameLine: "wwn",
      ...computeWwnCost({ effectPoints: calc.effectPoints, areaKey: calc.area, doubleSilver: calc.doubleSilver }),
    };
  }
  return {
    gameLine: "godbound",
    ...computeGodboundCost({
      scope: calc.scope,
      wardRating: calc.wardRating,
      resistanceRating: calc.resistanceRating,
      magnitudeMult: calc.magnitudeMult,
    }),
  };
}

export class WwnProjectSheet extends composeMixins(CollapsibleSectionsMixin, ActorItemActionsMixin)(
  HandlebarsApplicationMixin(ActorSheetV2)
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["wwn", "wwn-sheet", "sheet", "actor", "project"],
    position: { width: 820, height: 760 },
    form: { submitOnChange: true },
    window: { resizable: true, contentClasses: ["flex", "flex-col", "min-h-0"] },
    actions: {
      contributionCreate: WwnProjectSheet.#onContributionCreate,
      openContributionActor: WwnProjectSheet.#onOpenContributionActor,
      unlinkContribution: WwnProjectSheet.#onUnlinkContribution,
      toggleContributionNote: WwnProjectSheet.#onToggleContributionNote,
      applyCalculated: WwnProjectSheet.#onApplyCalculated,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "progress", label: "WWN.Tabs.Progress" },
        { id: "description", label: "WWN.Tabs.Description" },
      ],
      initial: "progress",
    },
  };

  /** @override */
  static PARTS = {
    header: { template: `${TPL}/header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    progress: { template: `${TPL}/tabs/progress.hbs`, scrollable: [""] },
    description: { template: `${TPL}/tabs/description.hbs`, scrollable: [""] },
  };

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
    context.calcResult = computeCalcResult(system);
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
      .sort((a, b) => compareByName(a.item, b.item));

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
   * Reveal/hide a row's Note field. Note is kept out of the always-visible
   * row (most projects only have a handful of contributors, but a note can
   * still run long) — this is a pure DOM toggle, not a document update, so
   * it doesn't cost a render.
   */
  static #onToggleContributionNote(event, target) {
    const noteRow = target.closest(".item-entry")?.querySelector(".wwn-project-contribution-note-row");
    if (!noteRow) return;
    noteRow.hidden = !noteRow.hidden;
  }

  /** Fill `resource.max` (and `time.max` for WWN) from the live calculator result. */
  static async #onApplyCalculated() {
    const result = computeCalcResult(this.actor.system);
    const updates = { "system.resource.max": result.cost };
    if (result.gameLine === "wwn") updates["system.time.max"] = result.weeks;
    await this.actor.update(updates);
    ui.notifications.info(game.i18n.localize("WWN.project.applyResult"));
  }
}
