/**
 * Item sheet using Foundry ItemSheetV2 and HandlebarsApplicationMixin.
 * Uses ApplicationV2 TABS and _prepareTabs() for tabbed navigation.
 * One sheet class for all item types; templates are chosen by document.type.
 */
import { onManageActiveEffect, prepareActiveEffectCategories } from "../effects.mjs";

const api = typeof foundry !== "undefined" ? foundry.applications.api : {};
const sheets = typeof foundry !== "undefined" ? foundry.applications.sheets : null;
const ItemSheetV2 = sheets?.ItemSheetV2;

const WwnItemSheetV2Base = ItemSheetV2 && api.HandlebarsApplicationMixin ? api.HandlebarsApplicationMixin(ItemSheetV2) : null;

/** Types with info + description + effects (or info + description for spell/asset) */
const HAS_INFO = ["item", "weapon", "armor", "ability", "art", "spell", "asset"];
/** Types with effects tab */
const HAS_EFFECTS = ["item", "weapon", "armor", "ability", "art", "focus", "fitting", "cargo", "shipweapon", "crewmember"];
/** Types with custom description tab (editor + stats) vs standard description partial */
const CUSTOM_DESCRIPTION = ["fitting", "cargo", "shipweapon", "crewmember"];
/** Skill uses single main tab */
const SKILL_TYPE = "skill";

/**
 * WWN Item Sheet V2. Uses ApplicationV2 TABS for tabbed navigation.
 * Exported as null when ItemSheetV2 is not available (e.g. Node test env).
 */
export const WwnItemSheetV2 = WwnItemSheetV2Base
  ? class WwnItemSheetV2 extends WwnItemSheetV2Base {
  static DEFAULT_OPTIONS = Object.freeze(
    foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
      classes: ["wwn", "sheet", "item"],
      position: { width: 550, height: 510 },
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: {},
    })
  );

  static TABS = {
    primary: {
      tabs: [
        { id: "info" },
        { id: "description" },
        { id: "effects" },
        { id: "main" },
      ],
      initial: "info",
      labelPrefix: "WWN.Item.Tabs",
    },
  };

  static PARTS = {
    root: {
      template: "systems/wwn/templates/items/item-sheet-root.hbs",
      root: true,
    },
    header: {
      template: "systems/wwn/templates/items/partials/item-header.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    info: {
      template: "systems/wwn/templates/items/partials/item-tab-info.hbs",
    },
    description: {
      template: "systems/wwn/templates/items/partials/item-tab-description.hbs",
    },
    effects: {
      template: "systems/wwn/templates/items/partials/item-tab-effects.hbs",
    },
    main: {
      template: "systems/wwn/templates/items/partials/skill-tab-main.hbs",
    },
  };

  get item() {
    return this.document;
  }

  /** @inheritdoc */
  _configureRenderParts(options) {
    const type = this.document?.type ?? "item";
    const parts = foundry.utils.deepClone(this.constructor.PARTS);

    if (type === SKILL_TYPE) {
      delete parts.info;
      delete parts.description;
      delete parts.effects;
      parts.header.template = "systems/wwn/templates/items/partials/skill-header.hbs";
      return parts;
    }

    const headerTpl = `systems/wwn/templates/items/partials/${type}-header.hbs`;
    parts.header.template = headerTpl;

    if (HAS_INFO.includes(type)) {
      const infoTpl = type === "asset"
        ? "systems/wwn/templates/items/partials/asset-tab-info.hbs"
        : `systems/wwn/templates/items/partials/${type}-tab-info.hbs`;
      parts.info.template = infoTpl;
    } else {
      delete parts.info;
    }

    if (CUSTOM_DESCRIPTION.includes(type)) {
      parts.description.template = `systems/wwn/templates/items/partials/${type}-tab-description.hbs`;
    } else if (type === "focus") {
      parts.description.template = "systems/wwn/templates/items/partials/focus-tab-description.hbs";
    } else {
      parts.description.template = "systems/wwn/templates/items/partials/item-tab-description.hbs";
    }

    if (!HAS_EFFECTS.includes(type)) {
      delete parts.effects;
    }

    delete parts.main;
    return parts;
  }

  /** @inheritdoc */
  _prepareTabs(group) {
    const type = this.document?.type ?? "item";

    if (type === SKILL_TYPE && group === "primary") {
      const active = this.tabGroups?.primary === "main";
      const cssClass = [active ? "active" : "", "item"].filter(Boolean).join(" ");
      return {
        main: {
          group: "primary",
          id: "main",
          active,
          cssClass,
          label: "WWN.Item.Tabs.main",
        },
      };
    }

    const tabs = super._prepareTabs(group);
    if (group === "primary") {
      if (!HAS_INFO.includes(type)) delete tabs.info;
      if (!HAS_EFFECTS.includes(type)) delete tabs.effects;
      delete tabs.main;
      for (const tab of Object.values(tabs)) {
        tab.cssClass = [tab.cssClass, "item"].filter(Boolean).join(" ");
      }
    }
    return tabs;
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const type = this.document?.type ?? "item";
    this.tabGroups = this.tabGroups ?? {};
    if (type === SKILL_TYPE) {
      this.tabGroups.primary = "main";
    } else if (!HAS_INFO.includes(type)) {
      this.tabGroups.primary = "description";
    }

    const context = await super._prepareContext(options);
    const doc = this.document;

    const sys = doc?.system ?? {};
    const system = typeof sys.toObject === "function" ? sys.toObject() : foundry.utils.deepClone(sys);
    const description = system.description ?? "";

    Object.assign(context, {
      config: {
        ...(CONFIG.WWN ?? {}),
        useTrauma: game.settings.get("wwn", "useTrauma"),
        useFlatArmorPenalty: game.settings.get("wwn", "useFlatArmorPenalty"),
      },
      actor: doc?.parent ?? null,
      enrichedDescription: await TextEditor.enrichHTML(description, { async: true }),
      effects: prepareActiveEffectCategories(doc?.effects ?? []),
      system,
      showInfo: HAS_INFO.includes(type),
      showEffects: HAS_EFFECTS.includes(type),
      showMain: type === SKILL_TYPE,
      // Backward-compat for templates (item-sheet-root.hbs uses {{cssClass}}; editors use owner/editable)
      cssClass: context.cssClass ?? [...(this.options?.classes ?? []), type ?? "item"].filter(Boolean).join(" "),
      owner: context.owner ?? !!doc?.isOwner,
      editable: context.editable ?? !!this.isEditable,
    });
    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context, options) {
    const c = await super._preparePartContext?.(partId, context, options) ?? context;

    if (c.tabs && partId in c.tabs) {
      c.tab = c.tabs[partId];
    }

    switch (partId) {
      case "description":
        c.enrichedDescription = c.enrichedDescription ?? await TextEditor.enrichHTML(
          c.system?.description ?? "",
          { async: true }
        );
        break;
      case "effects":
        c.effects = c.effects ?? prepareActiveEffectCategories(this.document?.effects ?? []);
        break;
    }
    return c;
  }

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const el = this.element;
    if (!el) return;
    const content = el.querySelector?.(".window-content") ?? el;
    const item = this.document;

    // Initialize active tab content (changeTab only runs on click; content needs "active" on first render)
    const type = item?.type ?? "item";
    const initial = this.tabGroups?.primary ?? (type === SKILL_TYPE ? "main" : (HAS_INFO.includes(type) ? "info" : "description"));
    const tabEl = content.querySelector?.(`.sheet-tabs.tabs [data-group="primary"][data-tab="${initial}"]`);
    if (tabEl) {
      this.changeTab(initial, "primary", { force: true, updatePosition: false });
    }

    if (this.isEditable) {
      content.querySelectorAll?.("input").forEach((input) => {
        input.addEventListener("focus", (ev) => ev.target?.select());
      });
    }
    content.querySelectorAll?.(".effect-control").forEach((node) => {
      node.addEventListener("click", (ev) => onManageActiveEffect(ev, item));
    });
    content.querySelectorAll?.('input[data-action="add-tag"]').forEach((node) => {
      node.addEventListener("keypress", (ev) => {
        if (ev.key === "Enter" && item) {
          const value = ev.currentTarget.value;
          const values = value.split(",").map((v) => v.trim()).filter(Boolean);
          if (values.length) item.pushTag(values);
        }
      });
    });
    content.querySelectorAll?.(".tag-delete").forEach((node) => {
      node.addEventListener("click", (ev) => {
        const tag = ev.currentTarget?.closest?.(".tag")?.dataset?.tag;
        if (tag != null && item) item.popTag(tag);
      });
    });
    content.querySelectorAll?.("a.melee-toggle").forEach((node) => {
      node.addEventListener("click", (ev) => { ev.preventDefault(); if (item) item.update({ system: { melee: !item.system.melee } }); });
    });
    content.querySelectorAll?.("a.missile-toggle").forEach((node) => {
      node.addEventListener("click", (ev) => { ev.preventDefault(); if (item) item.update({ system: { missile: !item.system.missile } }); });
    });
    content.querySelectorAll?.('input[name="system.isShield"]').forEach((node) => {
      node.addEventListener("change", (ev) => {
        const isShield = ev.currentTarget.checked;
        if (item) item.update({ system: { type: isShield ? "shield" : "light", isShield } });
      });
    });
  }

  /** @inheritdoc */
  async _onChangeForm(formConfig, event) {
    const target = event?.target;
    if (!target || !this.document) return super._onChangeForm?.(formConfig, event);
    if (target.classList.contains("quantity") || target.closest(".quantity")) {
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = itemId ? this.document : null;
      if (item) await item.update({ "system.quantity": Math.max(0, parseInt(target.value, 10) || 0) });
      return;
    }
    if (target.classList.contains("charges") || target.closest(".charges")) {
      const itemId = target.closest(".item")?.dataset?.itemId;
      const item = itemId ? this.document : null;
      if (item) await item.update({ "system.charges.value": Math.max(0, parseInt(target.value, 10) || 0) });
      return;
    }
    return super._onChangeForm?.(formConfig, event);
  }
  }
  : null;
