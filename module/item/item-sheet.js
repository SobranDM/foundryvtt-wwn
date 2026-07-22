/**
 * Extend the basic ItemSheet with some very simple modifications
 */

import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { evaluatePoolFormula } from "../derivations/resource-pools.mjs";
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
} from "../config/power-subtypes.mjs";
import { formatCommitmentSummary } from "../helpers/commitment.mjs";

const ROLL_TYPE_CHOICES = {
  result: "WWN.Power.RollTypeResult",
  above: "WWN.Power.RollTypeAbove",
  below: "WWN.Power.RollTypeBelow",
};

export class WwnItemSheet extends ItemSheet {
  constructor(...args) {
    super(...args);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wwn", "sheet", "item"],
      width: 620,
      height: 560,
      resizable: true,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".sheet-body",
          initial: "description",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/wwn/templates/items";
    return `${path}/${this.item.type}-sheet.html`;
  }

  /**
   * Prepare data for rendering the Item sheet
   */
  async getData() {
    const data = super.getData().data;
    data.editable = this.document.sheet.isEditable;
    data.config = CONFIG.WWN;
    data.config.useTrauma = game.settings.get("wwn", "useTrauma");
    data.config.useFlatArmorPenalty = game.settings.get("wwn", "useFlatArmorPenalty");
    data.actor = this.actor;
    data.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.object.system.description
    );
    data.effects = prepareActiveEffectCategories(this.item.effects);
    data.rollData = this.item.actor?.getRollData() ?? {};

    if (this.item.type === "power") this.#preparePowerContext(data);
    if (this.item.type === "classEdge") this.#prepareClassEdgeContext(data);
    if (this.item.type === "weapon") this.#prepareWeaponContext(data);

    return data;
  }

  #prepareWeaponContext(data) {
    const actor = this.item.actor;
    if (!actor) {
      data.ammoChoices = null;
      return;
    }
    const choices = { "": "" };
    for (const item of actor.items) {
      if (item.type !== "item") continue;
      choices[item.id] = item.name;
    }
    data.ammoChoices = choices;
  }

  #preparePowerContext(data) {
    const systemPlain = foundry.utils.deepClone(this.item.toObject().system);
    const subType = systemPlain.subType ?? "art";

    data.subtypeChoices = Object.fromEntries(
      Object.entries(POWER_SUBTYPES).map(([k, v]) => [k, v.label])
    );
    data.commitmentLengthChoices = COMMITMENT_LENGTHS;
    data.internalResourceLengthChoices = INTERNAL_USE_REFRESH_LENGTHS;
    data.effectApplicationChoices = EFFECT_APPLICATION_CHOICES;
    data.rollTypeChoices = ROLL_TYPE_CHOICES;

    const { show, showPanel } = getPowerSheetVisibility(subType, systemPlain);
    data.show = show;
    data.showPanel = { ...showPanel, type: true };
    data.commitmentSummary = formatCommitmentSummary(
      resolveCommitmentOptions(subType, systemPlain)
    );

    if (!Array.isArray(systemPlain.commitmentOptions) || !systemPlain.commitmentOptions.length) {
      systemPlain.commitmentOptions = foundry.utils.deepClone(
        ensureCommitmentOptions(subType, systemPlain)
      );
    }
    const cfg = POWER_SUBTYPES[subType];
    data.commitmentOptionsEditable =
      data.editable && !cfg?.fixedCommitmentOptions?.length && !!show.commitmentOptions;
    data.canRemoveCommitmentOptions = systemPlain.commitmentOptions.length > 1;
    data.source = systemPlain;
    data.system = foundry.utils.mergeObject(data.system, systemPlain, { inplace: false });
  }

  #prepareClassEdgeContext(data) {
    const system = this.item.system;
    const poolGrant = system.poolGrant ?? {};
    data.slotProgressionText = (system.slotGrant?.progression ?? []).join(", ");
    data.preparedProgressionText = (system.preparedGrant?.progression ?? []).join(", ");
    data.leveledProgressionText = (system.slotGrant?.leveledProgression ?? [])
      .map((row) => row.join(", "))
      .join("\n");

    if (poolGrant.formula?.trim()) {
      const result = evaluatePoolFormula(poolGrant.formula, data.rollData);
      data.formulaValid = result.valid;
      data.formulaPreview = result.valid ? result.value : null;
      data.showFormulaInvalid = !result.valid;
    }
  }

  /** @override */
  _getSubmitData(updateData = {}) {
    const submitData = super._getSubmitData(updateData);

    if (this.item.type === "power") {
      const flat = foundry.utils.flattenObject(submitData);
      const newSubType = flat["system.subType"];
      if (newSubType && newSubType !== this.item.system.subType) {
        const merged = applySubtypeDefaults(
          newSubType,
          foundry.utils.mergeObject(this.item.toObject().system, foundry.utils.expandObject(submitData).system ?? {}, {
            inplace: false,
          })
        );
        for (const [key, value] of Object.entries(foundry.utils.flattenObject({ system: merged }))) {
          submitData[key] = value;
        }
      } else {
        const subType = this.item.system.subType;
        const cfg = POWER_SUBTYPES[subType];
        const { show } = getPowerSheetVisibility(subType, this.item.system);
        if (cfg?.fixedCommitmentOptions?.length) {
          submitData["system.commitmentOptions"] = foundry.utils.deepClone(cfg.fixedCommitmentOptions);
        } else if (show.commitmentOptions) {
          submitData["system.commitmentOptions"] = this.#commitmentOptionsFromForm();
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
        const fromForm = this.#slotGrantFromForm(flat);
        if (fromForm) {
          submitData["system.slotGrant.enabled"] = fromForm.enabled;
          submitData["system.slotGrant.progression"] = fromForm.progression;
          submitData["system.slotGrant.leveledProgression"] = fromForm.leveledProgression;
        }
        delete submitData.wwnSlotProgressionText;
        delete submitData.wwnLeveledProgressionText;
      }
      if (hasPreparedText) {
        submitData["system.preparedGrant.progression"] = this.#parseSlotProgressionText(
          flat.wwnPreparedProgressionText
        );
        delete submitData.wwnPreparedProgressionText;
      }
    }

    return submitData;
  }

  #parseSlotProgressionText(text) {
    return String(text ?? "")
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n));
  }

  #parseLeveledProgressionText(text) {
    return String(text ?? "")
      .split("\n")
      .map((line) => line.split(",").map((n) => Number(n.trim()) || 0))
      .filter((row) => row.length);
  }

  #slotGrantFromForm(flat) {
    const enabled = !!flat["system.slotGrant.enabled"];
    if (enabled) {
      return {
        enabled: true,
        progression: [],
        leveledProgression: this.#parseLeveledProgressionText(flat.wwnLeveledProgressionText),
      };
    }
    return {
      enabled: false,
      leveledProgression: [],
      progression: this.#parseSlotProgressionText(flat.wwnSlotProgressionText),
    };
  }

  #normalizeCommitmentOption(option) {
    const cost = Number(option?.cost) || 0;
    return {
      cost,
      length: option?.length ?? (cost > 0 ? "scene" : "none"),
      note: String(option?.note ?? ""),
    };
  }

  #commitmentOptionsFromForm() {
    const form = this.form;
    if (!form) {
      return foundry.utils.deepClone(this.item.system.commitmentOptions ?? []);
    }
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const fromForm = foundry.utils.expandObject(formData.object).system?.commitmentOptions;
    const coerced = coerceCommitmentOptionsArray(fromForm);
    if (coerced?.length) {
      return coerced.map((o) => this.#normalizeCommitmentOption(o));
    }
    return foundry.utils.deepClone(this.item.system.commitmentOptions ?? []);
  }

  async #onAddCommitmentOption() {
    if (!this.isEditable || this.item.type !== "power") return;
    const cfg = POWER_SUBTYPES[this.item.system.subType];
    if (cfg?.fixedCommitmentOptions?.length) return;
    const options = this.#commitmentOptionsFromForm();
    options.push({ cost: 1, length: "scene", note: "" });
    await this.item.update({ "system.commitmentOptions": options });
  }

  async #onRemoveCommitmentOption(index) {
    if (!this.isEditable || this.item.type !== "power") return;
    const cfg = POWER_SUBTYPES[this.item.system.subType];
    if (cfg?.fixedCommitmentOptions?.length) return;
    const options = this.#commitmentOptionsFromForm();
    if (options.length <= 1 || index < 0 || index >= options.length) return;
    options.splice(index, 1);
    await this.item.update({ "system.commitmentOptions": options });
  }

  /* -------------------------------------------- */

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".effect-control").click((ev) => onManageActiveEffect(ev, this.item));

    html.find('input[data-action="add-tag"]').keypress((ev) => {
      if (event.which == 13) {
        let value = $(ev.currentTarget).val();
        let values = value.split(",");
        this.object.pushTag(values);
      }
    });
    html.find(".tag-delete").click((ev) => {
      let value = ev.currentTarget.parentElement.dataset.tag;
      this.object.popTag(value);
    });
    html.find("a.melee-toggle").click(() => {
      this.object.update({ system: { melee: !this.object.system.melee } });
    });

    html.find("a.missile-toggle").click(() => {
      this.object.update({ system: { missile: !this.object.system.missile } });
    });

    html.find('input[name="system.isShield"]').change((ev) => {
      const isShield = ev.currentTarget.checked;
      const newType = isShield ? "shield" : "light";
      this.object.update({
        system: {
          type: newType,
          isShield: isShield,
        },
      });
    });

    html.find(".add-commitment-option").click(async (ev) => {
      ev.preventDefault();
      await this.#onAddCommitmentOption();
    });

    html.find(".remove-commitment-option").click(async (ev) => {
      ev.preventDefault();
      const idx = Number.parseInt(ev.currentTarget.dataset.index, 10);
      await this.#onRemoveCommitmentOption(idx);
    });

    if (this.isEditable) {
      const inputs = html.find("input");
      inputs.focus((ev) => ev.currentTarget.select());
    }
  }
}
