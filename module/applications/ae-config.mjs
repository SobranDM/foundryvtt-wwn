/**
 * Plain-English Active Effect editor.
 *
 * Replaces only the "changes" part of the core ActiveEffectConfig: each
 * change row renders a grouped dropdown of registry targets (no raw data
 * path input anywhere). Mode and phase are constrained per target; the mode
 * select is locked when only one mode is legal.
 */

import { confirmWwnDialog } from "./wwn-dialog.mjs";
import { getFocusEffectLevel } from "../helpers/focus-effects.mjs";

const CoreActiveEffectConfig = foundry.applications.sheets.ActiveEffectConfig;
const FLAG = "wwn";

export class WwnActiveEffectConfig extends CoreActiveEffectConfig {
  /** @type {boolean|undefined} */
  #priorTransfer;

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["active-effect-config", "wwn", "wwn-sheet"],
    position: { width: 620 },
  };

  /** @override */
  static PARTS = {
    ...super.PARTS,
    details: {
      template: "systems/wwn/templates/effects/details.hbs",
      scrollable: [""],
    },
    changes: {
      template: "systems/wwn/templates/effects/changes.hbs",
      scrollable: ["ol[data-changes]"],
    },
  };

  /** Resolve the actor type owning this effect (for target filtering). */
  get #parentItem() {
    return this.document.parent?.documentName === "Item" ? this.document.parent : null;
  }

  get #actorType() {
    let doc = this.document.parent;
    while (doc) {
      if (doc.documentName === "Actor") return doc.type;
      doc = doc.parent;
    }
    return null;
  }

  #useItemRegistryFor(transfer = this.document.transfer) {
    return !!this.#parentItem && transfer === false;
  }

  #getTargetGroups(transfer = this.document.transfer) {
    return this.#useItemRegistryFor(transfer)
      ? CONFIG.WWN.getFilteredItemAeTargetGroups({ itemType: this.#parentItem.type })
      : CONFIG.WWN.getFilteredAeTargetGroups({ actorType: this.#actorType });
  }

  #getFlatTargets(transfer = this.document.transfer) {
    return this.#useItemRegistryFor(transfer)
      ? CONFIG.WWN.getItemAeTargets()
      : CONFIG.WWN.getAeTargets();
  }

  #localizeTarget(target, transfer = this.document.transfer) {
    return this.#useItemRegistryFor(transfer)
      ? CONFIG.WWN.localizeItemAeTarget(target)
      : CONFIG.WWN.localizeAeTarget(target);
  }

  #hasChanges(changes) {
    if (changes) return changes.some((c) => c?.key);
    if (this.form) {
      const submitData = this._processFormData(
        null,
        this.form,
        new foundry.applications.ux.FormDataExtended(this.form)
      );
      const formChanges = Object.values(submitData.system?.changes ?? {});
      return formChanges.some((c) => c?.key);
    }
    return (this.document.system.changes ?? []).some((c) => c?.key);
  }

  #buildOptgroups(transfer = this.document.transfer) {
    const groups = this.#getTargetGroups(transfer);
    const optgroups = [];
    for (const group of Object.values(groups)) {
      const options = [];
      for (const [path, target] of Object.entries(group.targets)) {
        options.push({ value: path, label: this.#localizeTarget(target, transfer) });
      }
      options.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
      optgroups.push({ label: game.i18n.localize(group.label), options });
    }
    return optgroups;
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#priorTransfer = this.document.transfer;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    if (partId === "details") {
      const parentItem = this.#parentItem;
      const showFocusLevel = parentItem?.type === "focus" && this.document.transfer;
      partContext.showFocusLevel = showFocusLevel;
      if (showFocusLevel) {
        partContext.focusLevel = getFocusEffectLevel(this.document) ?? "";
      }
      return partContext;
    }
    if (partId !== "changes") return partContext;

    // Recognition uses the full registry so setting-gated keys (e.g. trauma
    // when useTrauma is off) still show as known. Optgroups stay filtered.
    const flat = this.#getFlatTargets();
    const optgroups = this.#buildOptgroups();
    const inOptgroups = new Set();
    for (const group of optgroups) {
      for (const opt of group.options) inOptgroups.add(opt.value);
    }

    partContext.wwnChanges = foundry.utils.deepClone(this.document.system.changes ?? []).map((change, index) => {
      const target = flat[change.key];
      const known = !!target;
      const modes = target?.modes ?? ["add"];
      const modeOptions = modes.map((m) => ({
        value: m,
        label: game.i18n.localize(`EFFECT.CHANGES.TYPES.${m}`),
        selected: m === change.type,
      }));
      return {
        ...change,
        index,
        known,
        knownLabel: known ? this.#localizeTarget(target) : null,
        inOptgroups: known && inOptgroups.has(change.key),
        keyPath: `system.changes.${index}.key`,
        typePath: `system.changes.${index}.type`,
        valuePath: `system.changes.${index}.value`,
        phasePath: `system.changes.${index}.phase`,
        phase: target?.phase ?? change.phase ?? "initial",
        valueInputType: target?.valueType === "number" ? "number" : "text",
        modeLocked: modes.length === 1,
        lockedModeValue: modeOptions[0]?.value,
        lockedModeLabel: modeOptions[0]?.label,
        modes: modeOptions,
        optgroups,
      };
    });
    partContext.optgroups = optgroups;
    return partContext;
  }

  /** @override */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    const parentItem = this.#parentItem;
    if (parentItem?.type === "focus" && (submitData.transfer ?? this.document.transfer)) {
      const raw = formData.object[`flags.${FLAG}.focusLevel`];
      const parsed = raw === "" || raw == null ? null : Number(raw);
      if (parsed != null && Number.isFinite(parsed) && parsed >= 1) {
        foundry.utils.setProperty(submitData, `flags.${FLAG}.focusLevel`, parsed);
      } else {
        foundry.utils.setProperty(submitData, `flags.${FLAG}.focusLevel`, new foundry.data.operators.ForcedDeletion());
      }
    }
    if (!foundry.utils.isPlainObject(submitData.system?.changes)) return submitData;

    const transfer = submitData.transfer ?? this.document.transfer;
    const flat = this.#getFlatTargets(transfer);
    for (const change of Object.values(submitData.system.changes)) {
      const target = flat[change.key];
      if (!target) continue;
      change.phase = target.phase;
      if (!target.modes.includes(change.type)) change.type = target.modes[0];
    }
    return submitData;
  }

  /** @override */
  _onChangeForm(formConfig, event) {
    if (event.target?.name === "transfer" && this.#parentItem) {
      void this.#onTransferChange(event);
      return;
    }

    super._onChangeForm(formConfig, event);
    if (event.target?.name?.endsWith(".key")) {
      this.submit({ render: true });
    }
  }

  async #onTransferChange(event) {
    const newTransfer = event.target.checked;
    if (newTransfer === this.#priorTransfer) return;

    if (!this.#hasChanges()) {
      this.#priorTransfer = newTransfer;
      await this.submit({ render: true });
      return;
    }

    const confirmed = await confirmWwnDialog({
      title: "WWN.Effects.TransferClearChangesTitle",
      content: game.i18n.localize("WWN.Effects.TransferClearChangesWarning"),
      modifier: "ae-transfer",
    });
    if (!confirmed) {
      event.target.checked = this.#priorTransfer;
      return;
    }

    await this.document.update({ transfer: newTransfer, "system.changes": [] });
    this.#priorTransfer = newTransfer;
    await this.render({ force: true });
  }
}
