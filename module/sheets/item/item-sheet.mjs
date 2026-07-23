/**
 * Unified WWN item sheet (AppV2/SheetV2). The "info"/"attributes" body part
 * swaps template per item type; Power and ClassEdge sheets additionally hide
 * fields whose subtype default is undefined via `getPowerSheetVisibility`.
 *
 * Ported from games-without-number/module/sheets/item/item-sheet.mjs and
 * adapted to WWN's item types (weapon/armor/item/skill/power/focus/classEdge/
 * asset/currency) and the pre-existing legacy `module/item/item-sheet.js`
 * behaviors (tag add/delete, melee/missile toggle, shield toggle, commitment
 * option add/remove, ClassEdge progression text parsing).
 */
import { onManageActiveEffect, prepareActiveEffectCategories } from "../../helpers/effects.mjs";
import { evaluatePoolFormula } from "../../derivations/resource-pools.mjs";
import {
  COMMITMENT_LENGTHS,
  EFFECT_APPLICATION_CHOICES,
  POWER_SUBTYPES,
  applySubtypeDefaults,
  getPowerSheetVisibility,
  INTERNAL_USE_REFRESH_LENGTHS,
  resolveCommitmentOptions,
  ensureCommitmentOptions,
  coerceCommitmentOptionsArray,
} from "../../config/power-subtypes.mjs";
import { formatCommitmentSummary } from "../../helpers/commitment.mjs";

const ROLL_TYPE_CHOICES = {
  result: "WWN.Power.RollTypeResult",
  above: "WWN.Power.RollTypeAbove",
  below: "WWN.Power.RollTypeBelow",
};

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

const TPL = "systems/wwn/templates/item";

export class WwnItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["wwn", "wwn-sheet", "sheet", "item"],
    position: { width: 720, height: 560 },
    form: { submitOnChange: true },
    window: { resizable: true, contentClasses: ["flex", "flex-col", "min-h-0"] },
    actions: {
      effectAction: WwnItemSheet.#onEffectAction,
      deleteTag: WwnItemSheet.#onDeleteTag,
      toggleMelee: WwnItemSheet.#onToggleMelee,
      toggleMissile: WwnItemSheet.#onToggleMissile,
      addCommitmentOption: WwnItemSheet.#onAddCommitmentOption,
      removeCommitmentOption: WwnItemSheet.#onRemoveCommitmentOption,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "info", label: "WWN.category.attributes" },
        { id: "description", label: "WWN.Tabs.Description" },
        { id: "effects", label: "WWN.Tabs.Effects" },
      ],
      initial: "info",
    },
  };

  /** @override */
  static PARTS = {
    header: { template: `${TPL}/header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    info: { template: `${TPL}/attributes/item.hbs`, scrollable: [""] },
    description: { template: `${TPL}/description.hbs`, scrollable: [""] },
    effects: { template: `${TPL}/effects.hbs`, scrollable: [""] },
  };

  /** @override */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    const type = this.document.type;
    const byType = {
      item: "item",
      weapon: "weapon",
      armor: "armor",
      skill: "skill",
      power: "power",
      classEdge: "class-edge",
      focus: "focus",
      asset: "asset",
      currency: "currency",
      shipFitting: "ship-fitting",
      shipWeapon: "ship-weapon",
      shipDefense: "ship-defense",
      armorFitting: "armor-fitting",
    };
    parts.info.template = `${TPL}/attributes/${byType[type] ?? "item"}.hbs`;
    return parts;
  }

  get item() {
    return this.document;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;

    context.item = item;
    context.editable = this.isEditable;
    context.owner = item.isOwner;
    context.system = item.system;
    context.source = item.toObject().system;
    context.flags = item.flags;
    context.config = CONFIG.WWN;
    context.actor = item.actor;
    context.rollData = item.actor?.getRollData() ?? {};
    context.useTrauma = game.settings.get("wwn", "useTrauma");
    context.separateRangedAC = game.settings.get("wwn", "separateRangedAC");
    context.useFlatArmorPenalty = game.settings.get("wwn", "useFlatArmorPenalty");
    context.medRange = game.settings.get("wwn", "medRange");

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.description ?? "",
      { relativeTo: item, secrets: item.isOwner, rollData: context.rollData }
    );

    context.effects = prepareActiveEffectCategories(item.effects);

    if (item.type === "power") this.#preparePowerContext(context);
    if (item.type === "classEdge") this.#prepareClassEdgeContext(context);
    if (item.type === "focus") this.#prepareFocusContext(context);
    if (item.type === "weapon") this.#prepareWeaponContext(context);

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === "info" && this.item.type === "power") this.#preparePowerContext(context);
    const tab = context.tabs?.[partId];
    if (tab) context.tab = tab;
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const input of this.element.querySelectorAll("input")) {
      input.addEventListener("focus", (event) => event.currentTarget.select());
    }
    // Legacy free-text tag entry (Enter to add; comma-separated). `system.tags`
    // is a plain string array; the pre-AppV2 `pushTag`/`popTag` item methods no
    // longer exist post-DataModel-migration, so tags are updated directly here.
    const tagInput = this.element.querySelector("[data-tag-input]");
    tagInput?.addEventListener("keypress", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const values = String(event.currentTarget.value ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      event.currentTarget.value = "";
      if (!values.length) return;
      const tags = Array.from(new Set([...(this.item.system.tags ?? []), ...values]));
      this.item.update({ "system.tags": tags });
    });
  }

  /** Field visibility from explicit visibleFields matrix. */
  #preparePowerContext(context) {
    const systemPlain = foundry.utils.deepClone(this.item.toObject().system);
    const subType = systemPlain.subType ?? "art";

    context.subtypeChoices = Object.fromEntries(Object.entries(POWER_SUBTYPES).map(([k, v]) => [k, v.label]));
    context.commitmentLengthChoices = COMMITMENT_LENGTHS;
    context.internalResourceLengthChoices = INTERNAL_USE_REFRESH_LENGTHS;
    context.effectApplicationChoices = EFFECT_APPLICATION_CHOICES;
    context.rollTypeChoices = ROLL_TYPE_CHOICES;

    const { show, showPanel } = getPowerSheetVisibility(subType, systemPlain);
    context.show = show;
    context.showPanel = { ...showPanel, type: true };
    context.commitmentSummary = formatCommitmentSummary(resolveCommitmentOptions(subType, systemPlain));

    if (!Array.isArray(systemPlain.commitmentOptions) || !systemPlain.commitmentOptions.length) {
      systemPlain.commitmentOptions = foundry.utils.deepClone(ensureCommitmentOptions(subType, systemPlain));
    }
    const cfg = POWER_SUBTYPES[subType];
    context.commitmentOptionsEditable = context.editable && !cfg?.fixedCommitmentOptions?.length && !!show.commitmentOptions;
    context.canRemoveCommitmentOptions = systemPlain.commitmentOptions.length > 1;
    context.source = systemPlain;
  }

  /** Formula validation + progression grids as editable text. */
  #prepareClassEdgeContext(context) {
    const system = this.item.system;
    const poolGrant = system.poolGrant ?? {};
    context.slotProgressionText = (system.slotGrant?.progression ?? []).join(", ");
    context.leveledProgressionText = (system.slotGrant?.leveledProgression ?? []).map((row) => row.join(", ")).join("\n");
    context.preparedProgressionText = (system.preparedGrant?.progression ?? []).join(", ");

    if (poolGrant.formula?.trim()) {
      const result = evaluatePoolFormula(poolGrant.formula, context.rollData);
      context.formulaValid = result.valid;
      context.formulaPreview = result.valid ? result.value : null;
      context.showFormulaInvalid = !result.valid;
    }
  }

  /** Linked ammo dropdown from the owning actor's gear (legacy `#prepareWeaponContext`). */
  #prepareWeaponContext(context) {
    const actor = this.item.actor;
    if (!actor) {
      context.ammoChoices = null;
      return;
    }
    const choices = { "": "" };
    for (const gear of actor.items) {
      if (gear.type !== "item") continue;
      choices[gear.id] = gear.name;
    }
    context.ammoChoices = choices;
  }

  /** Primary skill slugs/names from the configured skill pack. */
  #prepareFocusContext(context) {
    context.skillBonusChoices = { ...(CONFIG.WWN.skillSetCache?.labels ?? {}) };
  }

  /** @override */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);

    if (this.item.type === "power") {
      const flat = foundry.utils.flattenObject(submitData);
      const newSubType = flat["system.subType"];
      if (newSubType && newSubType !== this.item.system.subType) {
        submitData.system = applySubtypeDefaults(
          newSubType,
          foundry.utils.mergeObject(this.item.toObject().system, submitData.system ?? {}, { inplace: false })
        );
      }
      if (submitData.system) {
        const subType = submitData.system.subType ?? this.item.system.subType;
        const cfg = POWER_SUBTYPES[subType];
        const merged = foundry.utils.mergeObject(this.item.toObject().system, submitData.system, { inplace: false });
        const { show } = getPowerSheetVisibility(subType, merged);

        if (cfg?.fixedCommitmentOptions?.length) {
          submitData.system.commitmentOptions = foundry.utils.deepClone(cfg.fixedCommitmentOptions);
        } else if (show.commitmentOptions) {
          submitData.system.commitmentOptions = WwnItemSheet.#commitmentOptionsFromForm(this);
        } else {
          delete submitData.system.commitmentOptions;
        }
      }
    }

    if (this.item.type === "classEdge") {
      const flat = foundry.utils.flattenObject(submitData);
      const hasSlotText = "wwnSlotProgressionText" in flat;
      const hasLeveledText = "wwnLeveledProgressionText" in flat;
      const hasEnabled = "system.slotGrant.enabled" in flat;
      const hasPreparedText = "wwnPreparedProgressionText" in flat;

      if (hasSlotText || hasLeveledText || hasEnabled) {
        const fromForm = WwnItemSheet.#slotGrantFromForm(this);
        if (fromForm) {
          foundry.utils.setProperty(submitData, "system.slotGrant.enabled", fromForm.enabled);
          foundry.utils.setProperty(submitData, "system.slotGrant.progression", fromForm.progression);
          foundry.utils.setProperty(submitData, "system.slotGrant.leveledProgression", fromForm.leveledProgression);
        }
        delete submitData.wwnSlotProgressionText;
        delete submitData.wwnLeveledProgressionText;
      }
      if (hasPreparedText) {
        foundry.utils.setProperty(
          submitData,
          "system.preparedGrant.progression",
          WwnItemSheet.#parseSlotProgressionText(flat.wwnPreparedProgressionText)
        );
        delete submitData.wwnPreparedProgressionText;
      }
      if (submitData.system) {
        const rawSkills = submitData.system.bonusSkills;
        if (typeof rawSkills === "string") {
          submitData.system.bonusSkills = rawSkills
            .split(",")
            .map((s) => s.trim().toLowerCase().replace(/\s+/g, ""))
            .filter(Boolean);
        }
      }
    }

    if (this.item.type === "focus" && submitData.system) {
      const rawSkills = submitData.system.bonusSkills;
      if (typeof rawSkills === "string") {
        submitData.system.bonusSkills = rawSkills
          .split(",")
          .map((s) => s.trim().toLowerCase().replace(/\s+/g, ""))
          .filter(Boolean);
      }
      if (submitData.system.bonusDice === "" || submitData.system.bonusDice === undefined) {
        submitData.system.bonusDice = null;
      }
    }

    if (this.item.type === "power" && submitData.system) {
      const rawSkills = submitData.system.bonusSkills;
      if (typeof rawSkills === "string") {
        submitData.system.bonusSkills = rawSkills
          .split(",")
          .map((s) => s.trim().toLowerCase().replace(/\s+/g, ""))
          .filter(Boolean);
      }
    }

    return submitData;
  }

  static #onEffectAction(event, target) {
    return onManageActiveEffect(event, this.item, target);
  }

  static async #onDeleteTag(event, target) {
    const value = target.closest("[data-tag]")?.dataset.tag;
    if (!value) return;
    const tags = (this.item.system.tags ?? []).filter((t) => t !== value);
    await this.item.update({ "system.tags": tags });
  }

  static async #onToggleMelee() {
    await this.item.update({ "system.melee": !this.item.system.melee });
  }

  static async #onToggleMissile() {
    await this.item.update({ "system.missile": !this.item.system.missile });
  }

  static #parseSlotProgressionText(text) {
    return String(text ?? "").split(",").map((n) => Number(n.trim())).filter((n) => Number.isFinite(n));
  }

  static #parseLeveledProgressionText(text) {
    return String(text ?? "")
      .split("\n")
      .map((line) => line.split(",").map((n) => Number(n.trim()) || 0))
      .filter((row) => row.length);
  }

  /** @param {WwnItemSheet} sheet */
  static #slotGrantFromForm(sheet) {
    const form = sheet.form;
    if (!form) return null;
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const flat = foundry.utils.flattenObject(formData.object);
    const enabled = !!flat["system.slotGrant.enabled"];
    if (enabled) {
      return {
        enabled: true,
        progression: [],
        leveledProgression: WwnItemSheet.#parseLeveledProgressionText(flat.wwnLeveledProgressionText),
      };
    }
    return {
      enabled: false,
      leveledProgression: [],
      progression: WwnItemSheet.#parseSlotProgressionText(flat.wwnSlotProgressionText),
    };
  }

  static #normalizeCommitmentOption(option) {
    const cost = Number(option?.cost) || 0;
    return { cost, length: option?.length ?? (cost > 0 ? "scene" : "none"), note: String(option?.note ?? "") };
  }

  /** @param {WwnItemSheet} sheet */
  static #commitmentOptionsFromForm(sheet) {
    const form = sheet.form;
    if (!form) return foundry.utils.deepClone(sheet.item.system.commitmentOptions ?? []);
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const fromForm = foundry.utils.expandObject(formData.object).system?.commitmentOptions;
    const coerced = coerceCommitmentOptionsArray(fromForm);
    if (coerced?.length) return coerced.map((o) => WwnItemSheet.#normalizeCommitmentOption(o));
    return foundry.utils.deepClone(sheet.item.system.commitmentOptions ?? []);
  }

  static async #onAddCommitmentOption() {
    const sheet = this;
    if (!sheet.isEditable || sheet.item.type !== "power") return;
    const cfg = POWER_SUBTYPES[sheet.item.system.subType];
    if (cfg?.fixedCommitmentOptions?.length) return;
    const options = WwnItemSheet.#commitmentOptionsFromForm(sheet);
    options.push({ cost: 1, length: "scene", note: "" });
    await sheet.item.update({ "system.commitmentOptions": options });
  }

  static async #onRemoveCommitmentOption(event, target) {
    const sheet = this;
    if (!sheet.isEditable || sheet.item.type !== "power") return;
    const cfg = POWER_SUBTYPES[sheet.item.system.subType];
    if (cfg?.fixedCommitmentOptions?.length) return;
    const idx = Number.parseInt(target.dataset.index, 10);
    if (!Number.isFinite(idx) || idx < 0) return;
    const options = WwnItemSheet.#commitmentOptionsFromForm(sheet);
    if (options.length <= 1 || idx >= options.length) return;
    options.splice(idx, 1);
    await sheet.item.update({ "system.commitmentOptions": options });
  }
}
