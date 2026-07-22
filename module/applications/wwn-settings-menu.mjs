const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;
const fields = foundry.data.fields;

/**
 * Build a form-group entry for a registered game setting.
 * @param {SettingConfig} setting
 * @returns {object|null}
 */
function settingToFormEntry(setting) {
  if (!setting) return null;

  const entry = {
    label: setting.value,
    value: game.settings.get(setting.namespace, setting.key),
  };

  if (setting.type instanceof fields.DataField) {
    entry.field = setting.type;
    entry.input = setting.input;
  } else if (setting.type === Boolean) {
    entry.field = new fields.BooleanField({ initial: setting.default ?? false });
  } else if (setting.type === Number) {
    const { min, max, step } = setting.range ?? {};
    entry.field = new fields.NumberField({
      required: true,
      choices: setting.choices,
      initial: setting.default,
      min,
      max,
      step,
    });
  } else {
    entry.field = new fields.StringField({ required: true, choices: setting.choices });
  }

  entry.field.name = `${setting.namespace}.${setting.key}`;
  entry.field.label ||= game.i18n.localize(setting.name ?? "");
  entry.field.hint ||= game.i18n.localize(setting.hint ?? "");
  return entry;
}

/**
 * A Foundry settings submenu that renders WWN settings in grouped fieldsets.
 */
export class WwnSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {import("../settings/menu-config.mjs").WWN_SETTING_MENUS[string]} */
  static MENU_CONFIG;

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "wwn-settings-menu",
    tag: "form",
    window: {
      title: "WWN.Setting.Menu.Title",
      icon: "fa-solid fa-gears",
      contentClasses: ["standard-form"],
    },
    position: { width: 560 },
    form: {
      closeOnSubmit: true,
      handler: WwnSettingsMenu.#onSubmit,
    },
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/wwn/templates/settings/wwn-settings-menu.hbs",
      scrollable: [""],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext() {
    const config = this.constructor.MENU_CONFIG;
    const sections = config.sections.map((section) => ({
      legend: section.legend,
      hint: section.hint,
      entries: section.settings
        .map((key) => game.settings.settings.get(`wwn.${key}`))
        .map(settingToFormEntry)
        .filter(Boolean),
    }));

    return {
      sections,
      buttons: [{ type: "submit", label: "SETTINGS.Save", icon: "fa-solid fa-floppy-disk" }],
    };
  }

  /* -------------------------------------------- */

  /**
   * Persist submitted settings and prompt for reload when required.
   * @this {WwnSettingsMenu}
   */
  static async #onSubmit(_event, _form, formData) {
    let requiresClientReload = false;
    let requiresWorldReload = false;

    for (const [key, value] of Object.entries(formData.object)) {
      const setting = game.settings.settings.get(key);
      if (!setting) continue;

      const priorValue = game.settings.get(setting.namespace, setting.key, { document: true })?._source.value;
      let newSetting;
      try {
        newSetting = await game.settings.set(setting.namespace, setting.key, value, { document: true });
      } catch (error) {
        ui.notifications.error(error);
        continue;
      }

      if (priorValue === newSetting?._source.value) continue;
      requiresClientReload ||= setting.scope !== CONST.SETTING_SCOPES.WORLD && setting.requiresReload;
      requiresWorldReload ||= setting.scope === CONST.SETTING_SCOPES.WORLD && setting.requiresReload;
    }

    if (requiresClientReload || requiresWorldReload) {
      await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: requiresWorldReload });
    }
  }
}

/**
 * Create a dedicated Application subclass for a settings submenu.
 * @param {string} menuKey
 * @param {import("../settings/menu-config.mjs").WWN_SETTING_MENUS[string]} menuConfig
 */
export function defineWwnSettingsMenu(menuKey, menuConfig) {
  return class extends WwnSettingsMenu {
    static MENU_CONFIG = menuConfig;

    static DEFAULT_OPTIONS = {
      ...super.DEFAULT_OPTIONS,
      id: `wwn-settings-${menuKey}`,
      window: {
        ...super.DEFAULT_OPTIONS.window,
        title: menuConfig.name,
        icon: menuConfig.icon,
      },
    };
  };
}
