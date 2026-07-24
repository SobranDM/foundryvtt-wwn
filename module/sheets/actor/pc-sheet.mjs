/**
 * WWN PC sheet: Main (+ Favorites dock), Powers, Inventory, Details, Effects.
 */
import { WwnBaseActorSheet } from "./base-actor-sheet.mjs";
import composeMixins from "../mixins/compose-mixins.mjs";
import { CollapsibleSectionsMixin } from "../mixins/collapsible-sections.mjs";
import { prepareXpBar } from "../helpers/resource-bar.mjs";
import { maybeShowClassAssignmentDialog } from "../../dialog/class-assignment.mjs";
import { computeSkillPurchaseCost } from "../../helpers/skill-points.mjs";

const TPL = "systems/wwn/templates/actor/pc";

/**
 * PC sheet.
 */
export class WwnPcSheet extends composeMixins(CollapsibleSectionsMixin)(WwnBaseActorSheet) {
  constructor(...args) {
    super(...args);
    /** @type {boolean} */
    this._wwnClassAssignmentPrompted = false;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["pc"],
    actions: {
      generateScores: WwnPcSheet.#onGenerateScores,
      adjustCurrency: WwnPcSheet.#onAdjustCurrency,
      showModifiers: WwnPcSheet.#onShowModifiers,
      addLanguage: WwnPcSheet.#onAddLanguage,
      removeLanguage: WwnPcSheet.#onRemoveLanguage,
      addSkills: WwnPcSheet.#onAddSkills,
      skillUp: WwnPcSheet.#onSkillUp,
      toggleSkillLevelsUnlock: WwnPcSheet.#onToggleSkillLevelsUnlock,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "WWN.Tabs.Main" },
        { id: "powers", label: "WWN.Tabs.Powers" },
        { id: "inventory", label: "WWN.Tabs.Inventory" },
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
    powers: { template: `${TPL}/tabs/powers.hbs`, scrollable: [""] },
    inventory: { template: `${TPL}/tabs/inventory.hbs`, scrollable: [""] },
    details: { template: `${TPL}/tabs/details.hbs`, scrollable: [""] },
    effects: { template: "systems/wwn/templates/actor/partials/effects-tab.hbs", scrollable: [""] },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    context.abilities = Object.entries(system.abilities ?? {}).map(([key, ability]) => ({
      key,
      label: CONFIG.WWN.abilityAbbreviations?.[key] ?? key,
      ...ability,
    }));

    context.xpBar = prepareXpBar(actor);
    context.isNew = actor.isNew?.() ?? false;
    context.showMovement = game.settings.get("wwn", "showMovement");
    context.replaceStrainWithWounds = game.settings.get("wwn", "replaceStrainWithWounds");
    context.xpPerChar = game.settings.get("wwn", "xpPerChar");
    context.useTrauma = game.settings.get("wwn", "useTrauma");
    context.immuneToSurprise = !!actor.system.combat?.immuneToSurprise
      && actor.system.combat.immuneToSurprise !== "false";
    context.stabilized = !!actor.getFlag("wwn", "stabilized");

    context.classEdges = context.classEdges ?? [];

    context.inventorySections = ["weapons", "armors", "gear", "treasure", "currency"].map((id) => ({
      id: `inventory.${id}`,
      collapsed: this.isSectionCollapsed(`inventory.${id}`),
    }));

    context.enrichedNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.details?.notes ?? "",
      { relativeTo: actor, secrets: actor.isOwner, rollData: context.rollData }
    );

    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    if (!this._wwnClassAssignmentPrompted && this.isEditable) {
      this._wwnClassAssignmentPrompted = true;
      queueMicrotask(() => {
        maybeShowClassAssignmentDialog(this.actor).catch((err) => {
          console.error("WWN | Class assignment dialog failed:", err);
        });
      });
    }
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** 3d6-in-order ability score generation for a fresh PC. */
  static #onGenerateScores() {
    return import("../../dialog/character-creation.js").then(({ WwnCharacterCreator }) => {
      new WwnCharacterCreator(this.actor, {
        position: {
          top: (this.position?.top ?? 0) + 40,
          left: (this.position?.left ?? 0) + ((this.position?.width ?? 780) - 400) / 2,
        },
      }).render({ force: true });
    });
  }

  /** Currency adjustment dialog. */
  static #onAdjustCurrency() {
    return import("../../dialog/adjust-currency.js").then(({ showAdjustCurrencyDialog }) => {
      return showAdjustCurrencyDialog(this.actor);
    });
  }

  /** Show modifiers breakdown dialog. */
  static #onShowModifiers() {
    return import("../../dialog/character-modifiers.js").then(({ showCharacterModifiersDialog }) => {
      return showCharacterModifiersDialog(this.actor);
    });
  }

  /** Bulk-add primary skills from the configured skill pack. */
  static async #onAddSkills() {
    const { getPrimarySkillData } = await import("../../helpers/skill-set.mjs");
    const primary = await getPrimarySkillData();
    if (primary.length) await Item.createDocuments(primary, { parent: this.actor });
  }

  /** Add a language chosen from the configured language list. */
  static async #onAddLanguage() {
    const list = (game.settings.get("wwn", "languageList") ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l);
    if (!list.length) return;
    const choices = Object.fromEntries(list.map((l) => [l, l]));
    const { showWwnDialog, confirmButton, cancelButton } = await import("../../applications/wwn-dialog.mjs");
    const result = await showWwnDialog({
      modifier: "language",
      title: game.i18n.localize("WWN.category.languages"),
      content: `<div class="form-group"><div class="form-fields">
        <select name="language">${list
          .map((l) => `<option value="${foundry.utils.escapeHTML(l)}">${foundry.utils.escapeHTML(l)}</option>`)
          .join("")}</select>
      </div></div>`,
      buttons: [confirmButton(), cancelButton()],
    });
    if (!result || result === "cancel" || !result.language) return;
    const languages = [...(this.actor.system.languages ?? [])];
    if (!languages.includes(result.language)) {
      languages.push(result.language);
      await this.actor.update({ "system.languages": languages });
    }
  }

  static async #onRemoveLanguage(event, target) {
    const language = target.dataset.language;
    const languages = (this.actor.system.languages ?? []).filter((l) => l !== language);
    await this.actor.update({ "system.languages": languages });
  }

  /** Spend unspent skill points to raise a skill's owned level by one. */
  static async #onSkillUp(event, target) {
    const item = this._getItem(target);
    if (!item || item.type !== "skill") return;

    const rank = item.system.ownedLevel;
    const level = this.actor.system.details?.level ?? 1;
    if (!game.settings.get("wwn", "noSkillLevelReq")) {
      const minLevel = rank === 1 ? 3 : rank === 2 ? 6 : rank === 3 ? 9 : Infinity;
      if (rank >= 0 && level < minLevel) {
        return ui.notifications.error(game.i18n.localize("WWN.Skills.LevelTooLow"));
      }
    }
    const { fromInvested, fromUnspent } = computeSkillPurchaseCost(item, this.actor);
    const unspent = Number(this.actor.system.skills?.unspent) || 0;
    if (fromUnspent > unspent) return ui.notifications.error(game.i18n.localize("WWN.Skills.NotEnoughPoints"));

    const invested = item.system.pointsInvested ?? 0;
    await item.update({
      "system.ownedLevel": rank + 1,
      "system.pointsInvested": Math.max(invested - fromInvested, 0),
    });
    if (fromUnspent > 0) {
      await this.actor.update({ "system.skills.unspent": unspent - fromUnspent });
    }
  }

  static async #onToggleSkillLevelsUnlock() {
    await this.actor.update({ "system.skills.levelsUnlocked": !this.actor.system.skills?.levelsUnlocked });
  }
}
