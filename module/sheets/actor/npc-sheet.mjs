/**
 * WWN NPC (monster) sheet: Main, Details, Effects.
 *
 * No Favorites UI. Monster data model: manual AC, flat `hd`, morale/instinct/
 * reaction/appearing rolls, and pattern-color cycling for attack items.
 * Powers live on the Main tab (right column); former Config fields live on Details.
 */
import { WwnBaseActorSheet } from "./base-actor-sheet.mjs";
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { WwnDice } from "../../dice/dice.mjs";

const TPL = "systems/wwn/templates/actor/npc";

/**
 * NPC sheet. No Favorites dock.
 *
 * Tabs: Main | Details | Effects.
 */
export class WwnNpcSheet extends composeMixins(CollapsibleSectionsMixin)(WwnBaseActorSheet) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
    actions: {
      rollNpcHp: WwnNpcSheet.#onRollNpcHp,
      rollInstinct: WwnNpcSheet.#onRollInstinct,
      rollReaction: WwnNpcSheet.#onRollReaction,
      rollAppearing: WwnNpcSheet.#onRollAppearing,
      rollNpcSkill: WwnNpcSheet.#onRollNpcSkill,
      cyclePattern: WwnNpcSheet.#onCyclePattern,
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
    effects: { template: "systems/wwn/templates/actor/pc/tabs/effects.hbs", scrollable: [""] },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    // NPCs have no Favorites UI — HP tracker only.
    context.resourceBars = context.resourceBars.filter((bar) => bar.id === "hp");
    context.favorites = [];
    context.favoritesEnabled = false;

    // Legacy "attributes" tab lists weapons as an attack-pattern group, then
    // armor/gear beneath. Both lists already come from the base sheet's
    // `_prepareItems` (context.weapons/armors/gear); just merge armor+gear here.
    context.attackPatterns = [...context.weapons].sort((a, b) => a.name.localeCompare(b.name));
    context.otherItems = [...context.armors, ...context.gear].sort((a, b) => a.name.localeCompare(b.name));

    // Schema stores a RollTable UUID (or legacy `{ table }` object).
    const instinctUuid = system.details?.instinctTable;
    let instinctLink = "";
    if (typeof instinctUuid === "string" && instinctUuid.trim()) {
      instinctLink = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        `@UUID[${instinctUuid.trim()}]`
      );
    }
    context.instinctTableLink = instinctLink;

    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.biography ?? system.notes ?? "",
      { relativeTo: actor, secrets: actor.isOwner, rollData: context.rollData }
    );

    return context;
  }

  /** @override */
  async _onDrop(event) {
    const result = await super._onDrop?.(event);
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (err) {
      return result;
    }
    if (data?.type !== "RollTable") return result;
    const uuid = data.uuid ?? (data.id ? `RollTable.${data.id}` : null);
    if (uuid) await this.actor.update({ "system.details.instinctTable": uuid });
    return result;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onRollNpcHp() {
    return WwnDice.rollNpcHp(this.actor);
  }

  static #onRollInstinct() {
    return WwnDice.rollInstinct(this.actor);
  }

  static #onRollReaction() {
    return WwnDice.rollReaction(this.actor);
  }

  static #onRollAppearing(event, target) {
    return WwnDice.rollAppearing(this.actor, target.dataset.which ?? "d");
  }

  static #onRollNpcSkill(event, target) {
    return WwnDice.rollNpcSkill(this.actor, { skipDialog: event.shiftKey });
  }

  /** Cycle an item's pattern-color badge (legacy `.item-pattern` behavior). */
  static async #onCyclePattern(event, target) {
    const item = this._getItem(target);
    if (!item) return;
    const colors = Object.keys(CONFIG.WWN.colors ?? {});
    if (!colors.length) return;
    const index = colors.indexOf(item.system.pattern);
    const next = colors[(index + 1) % colors.length];
    await item.update({ "system.pattern": next });
  }
}
