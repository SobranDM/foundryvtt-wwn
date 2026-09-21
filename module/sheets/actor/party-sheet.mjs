/**
 * WWN Party sheet (AppV2/SheetV2).
 *
 * Parties do not derive from `WwnActorBase` (see module/data/actor/party.mjs)
 * and have no powers/effects/inventory-toggle concepts, so this sheet
 * extends `ActorSheetV2` directly rather than `WwnBaseActorSheet` — same
 * choice already made for `WwnFactionSheet`/`WwnStarshipSheet`.
 *
 * Consolidates the old roster/Deal-XP/Deal-Currency dialog
 * (module/dialog/party-sheet.js, retired) into a real Actor sheet: a single
 * scrollable body with the roster on top, shared currency/treasure below,
 * each pool row assignable to a carrier via a per-item "carried by" picker.
 */
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { ActorItemActionsMixin } from "../mixins/actor-item-actions.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../../applications/wwn-dialog.mjs";
import { isPc } from "../../helpers/actor-types.mjs";
import { buildCarrierClearUpdate } from "../../helpers/party-treasury.mjs";
import { showPartyXpDialog } from "../../dialog/party-xp.js";
import { showPartyCurrencyDialog } from "../../dialog/party-coin.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TPL = "systems/wwn/templates/actor/party";

export class WwnPartySheet extends composeMixins(CollapsibleSectionsMixin, ActorItemActionsMixin)(
  HandlebarsApplicationMixin(ActorSheetV2)
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["wwn", "wwn-sheet", "sheet", "actor", "party"],
    position: { width: 900, height: 700 },
    form: { submitOnChange: true },
    window: { resizable: true, contentClasses: ["flex", "flex-col", "min-h-0"] },
    actions: {
      dealXp: WwnPartySheet.#onDealXp,
      dealCurrency: WwnPartySheet.#onDealCurrency,
      openMemberSheet: WwnPartySheet.#onOpenMemberSheet,
      removeMember: WwnPartySheet.#onRemoveMember,
      splitCurrency: WwnPartySheet.#onSplitCurrency,
      createGear: WwnPartySheet.#onCreateGear,
      createCurrency: WwnPartySheet.#onCreateCurrency,
    },
  };

  /** @override */
  static PARTS = {
    header: { template: `${TPL}/header.hbs` },
    main: { template: `${TPL}/tabs/main.hbs`, scrollable: [""] },
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
    context.collapsed = this.sectionStates ?? {};

    context.isGM = game.user.isGM;
    context.resolvedMembers = (system.resolvedMembers ?? []).map((m) => {
      if (m.broken || !m.actor) return m;
      const classEdges = m.actor.items
        .filter((i) => i.type === "classEdge")
        .sort((a, b) => a.name.localeCompare(b.name));
      const classLabel = classEdges.length
        ? classEdges.map((e) => e.name).join(" · ")
        : (m.actor.system.details?.class ?? "");
      return { ...m, classLabel };
    });
    context.poolItems = system.pool?.items ?? [];
    context.poolCurrency = system.pool?.currency ?? [];
    context.carrierAssignments = system.carrierAssignments ?? {};

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? ""
    );

    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._bindFocusSelectInputs();
    this._bindItemFieldEditors(this.#onItemFieldChange);
    for (const select of this.element.querySelectorAll("[data-carrier-select]")) {
      select.addEventListener("change", (event) => this.#onCarrierChange(event));
    }
  }

  /** Inline edits on pool rows (currency carried, gear quantity). */
  async #onItemFieldChange(event) {
    const input = event.currentTarget;
    const itemId = input.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const field = input.dataset.itemField;
    let value = input.value;
    if (input.type === "number" || input.dataset.dtype === "Number") value = Number(value) || 0;
    await item.update({ [field]: value });
  }

  async #onCarrierChange(event) {
    const select = event.currentTarget;
    const itemId = select.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    // DocumentUUIDField(nullable) rejects "" -- an empty <option value="">
    // means "Unassigned", which is null, not the empty string.
    const carriedBy = select.value || null;
    await this.actor.update({ [`system.carrierAssignments.${itemId}`]: carriedBy });
  }

  /**
   * @override — dropping an Actor onto the sheet adds it as a party member,
   * same GM-only rule as the "Edit Members" action since it's the same
   * underlying roster edit via a different affordance.
   */
  async _onDropActor(_event, actor) {
    if (!this.isEditable || !actor) return null;
    if (!WwnPartySheet.#requireGM()) return null;
    if (!isPc(actor)) {
      ui.notifications.warn(game.i18n.localize("WWN.party.onlyPcMembers"));
      return null;
    }
    const members = this.actor.system.members ?? [];
    if (members.includes(actor.uuid)) return null;
    return this.actor.update({ "system.members": [...members, actor.uuid] });
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Deal XP/Currency and editing the roster are GM calls, not just Owner. */
  static #requireGM() {
    if (game.user.isGM) return true;
    ui.notifications.warn(game.i18n.localize("WWN.party.gmOnly"));
    return false;
  }

  static async #onDealXp() {
    if (!WwnPartySheet.#requireGM()) return;
    const actors = (this.actor.system.resolvedMembers ?? []).map((m) => m.actor).filter(Boolean);
    return showPartyXpDialog(actors);
  }

  static async #onDealCurrency() {
    if (!WwnPartySheet.#requireGM()) return;
    const actors = (this.actor.system.resolvedMembers ?? []).map((m) => m.actor).filter(Boolean);
    return showPartyCurrencyDialog(actors, this.actor);
  }

  static #onOpenMemberSheet(event, target) {
    const actorUuid = target.closest("[data-actor-uuid]")?.dataset.actorUuid;
    fromUuidSync(actorUuid)?.sheet?.render(true);
  }

  /** Remove one member from the roster, clearing anything they carried. */
  static async #onRemoveMember(event, target) {
    if (!WwnPartySheet.#requireGM()) return;
    const removedUuid = target.closest("[data-actor-uuid]")?.dataset.actorUuid;
    if (!removedUuid) return;
    const members = this.actor.system.members ?? [];
    const clearUpdates = buildCarrierClearUpdate(this.actor.system.carrierAssignments, removedUuid);
    await this.actor.update({
      ...clearUpdates,
      "system.members": members.filter((uuid) => uuid !== removedUuid),
    });
  }

  /** Split an amount off a currency stack onto a chosen carrier. */
  static async #onSplitCurrency(event, target) {
    const source = this._getItem(target);
    if (!source || source.type !== "currency") return;

    const members = (this.actor.system.resolvedMembers ?? []).filter((m) => m.actor);
    const result = await showWwnDialog({
      modifier: "party-split-currency",
      title: game.i18n.format("WWN.party.splitTitle", { name: source.name }),
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("WWN.dialog.amount")}</label>
          <div class="form-fields"><input type="number" name="amount" min="1" max="${source.system.carried}" /></div>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("WWN.party.carrier")}</label>
          <div class="form-fields">
            <select name="carriedBy">
              <option value="">${game.i18n.localize("WWN.party.unassigned")}</option>
              ${members.map((m) => `<option value="${m.uuid}">${foundry.utils.escapeHTML(m.actor.name)}</option>`).join("")}
            </select>
          </div>
        </div>`,
      buttons: [confirmButton(), cancelButton()],
    });
    if (!result || result === "cancel") return;

    const amount = Math.floor(Number(result.amount) || 0);
    if (amount <= 0 || amount > source.system.carried) return;

    // Decrement the source first, then create the new stack -- if the
    // create fails, roll the decrement back. Doing it the other order risks
    // duplicating currency (new stack created, then the decrement fails and
    // the source keeps its full original amount).
    const originalCarried = source.system.carried;
    await source.update({ "system.carried": originalCarried - amount });
    let created;
    try {
      [created] = await this.actor.createEmbeddedDocuments("Item", [{
        name: source.name,
        type: "currency",
        img: source.img,
        system: { multiplier: source.system.multiplier, perSlot: source.system.perSlot, carried: amount, banked: 0 },
      }]);
    } catch (err) {
      await source.update({ "system.carried": originalCarried });
      throw err;
    }
    if (result.carriedBy) {
      await this.actor.update({ [`system.carrierAssignments.${created.id}`]: result.carriedBy });
    }
  }

  static async #onCreateGear() {
    const name = game.i18n.format("DOCUMENT.New", { type: game.i18n.localize("TYPES.Item.item") });
    return Item.implementation.create({ name, type: "item" }, { parent: this.actor });
  }

  static async #onCreateCurrency() {
    const name = game.i18n.format("DOCUMENT.New", { type: game.i18n.localize("TYPES.Item.currency") });
    return Item.implementation.create({ name, type: "currency" }, { parent: this.actor });
  }
}
