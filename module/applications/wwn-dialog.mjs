/**
 * Dialog factory — the sole entry point for system dialogs, guaranteeing
 * consistent classes and theming (wwn wwn-dialog wwn-dialog--{modifier}).
 * No other code in the system may call DialogV2 directly.
 */

const { DialogV2 } = foundry.applications.api;

/**
 * Show a themed system dialog and await its result.
 *
 * @param {object} config
 * @param {string} config.modifier        BEM-ish modifier for CSS scoping (e.g. "roll-options")
 * @param {string} config.title           Localized window title
 * @param {string} [config.content]       Pre-rendered HTML content
 * @param {string} [config.template]      Template path rendered with `context`
 * @param {object} [config.context]       Template context
 * @param {Array}  [config.buttons]       DialogV2 button configs
 * @param {Function} [config.onRender]    Callback (event, dialog) on render
 * @param {boolean} [config.rejectClose=false]
 * @returns {Promise<*>} The chosen button's callback result, or null
 */
export async function showWwnDialog({
  modifier = "generic",
  title,
  content,
  template,
  context = {},
  buttons,
  onRender,
  rejectClose = false,
  ...rest
} = {}) {
  if (template) {
    content = await foundry.applications.handlebars.renderTemplate(template, context);
  }
  const theme = game.settings.get("wwn", "uiTheme") ?? "wwn";
  return DialogV2.wait({
    window: { title },
    classes: ["wwn", "wwn-dialog", `wwn-dialog--${modifier}`, "themed", `theme-${theme}`],
    content,
    buttons: buttons ?? [confirmButton()],
    rejectClose,
    render: onRender,
    ...rest,
  }).catch(() => null);
}

/** Standard confirm button. */
export function confirmButton({ label = "WWN.Dialog.Confirm", callback } = {}) {
  return {
    action: "confirm",
    icon: "fa-solid fa-check",
    label,
    default: true,
    callback: callback ?? ((event, button) => new foundry.applications.ux.FormDataExtended(button.form).object),
  };
}

/** Standard cancel button. */
export function cancelButton({ label = "WWN.Dialog.Cancel" } = {}) {
  return { action: "cancel", icon: "fa-solid fa-xmark", label, callback: () => null };
}

/** Standard roll button: resolves with the dialog's form data. */
export function rollButton({ label = "WWN.Dialog.Roll" } = {}) {
  return {
    action: "roll",
    icon: "fa-solid fa-dice-d20",
    label,
    default: true,
    callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
  };
}

/** Simple yes/no confirmation. */
export async function confirmWwnDialog({ title, content, modifier = "confirm" }) {
  const result = await showWwnDialog({
    modifier,
    title,
    content,
    buttons: [
      { action: "yes", icon: "fa-solid fa-check", label: "WWN.Dialog.Yes", default: true, callback: () => true },
      { action: "no", icon: "fa-solid fa-xmark", label: "WWN.Dialog.No", callback: () => false },
    ],
  });
  return result === true;
}
