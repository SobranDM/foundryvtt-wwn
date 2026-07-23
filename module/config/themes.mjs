/**
 * Theme registry for Worlds Without Number.
 * CSS variables live in scss/themes/_*.scss (compiled into styles/).
 */
export const THEMES = {
  wwn: { label: "WWN.Theme.WWN", colorScheme: "light" },
  swn: { label: "WWN.Theme.SWN", colorScheme: "dark" },
  awn: { label: "WWN.Theme.AWN", colorScheme: "dark" },
  cwn: { label: "WWN.Theme.CWN", colorScheme: "dark" },
};

/** Theme choices for sheet registration ({ key: i18nLabel }). */
export function sheetThemeChoices() {
  return Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.label]));
}

/**
 * Apply the chosen theme to the document body so sheets, dialogs, and chat inherit variables.
 * @param {string} theme  Theme key (wwn|swn|awn|cwn)
 */
export function applyUiTheme(theme) {
  if (!(theme in THEMES)) theme = "wwn";
  for (const key of Object.keys(THEMES)) {
    document.body.classList.remove(`wwn-theme-${key}`, `theme-${key}`);
  }
  document.body.classList.add(`wwn-theme-${theme}`);
}

/**
 * Active UI theme key (wwn|swn|awn|cwn).
 * @returns {string}
 */
export function getUiTheme() {
  let theme = "wwn";
  try {
    theme = game?.settings?.get("wwn", "uiTheme") ?? "wwn";
  } catch {
    theme = "wwn";
  }
  return theme in THEMES ? theme : "wwn";
}

/**
 * Foundry `themed theme-{key}` class for the active UI theme.
 * @returns {string}
 */
export function getUiThemeClass() {
  return `theme-${getUiTheme()}`;
}

/**
 * Apply/refresh Foundry theme classes on an Application root element.
 * @param {HTMLElement} element
 */
export function applyAppThemeClasses(element) {
  if (!element) return;
  element.classList.add("themed");
  for (const key of Object.keys(THEMES)) {
    element.classList.remove(`theme-${key}`);
  }
  element.classList.add(getUiThemeClass());
}

/**
 * Build consistent app classes for dialogs and long-lived ApplicationV2 windows.
 * @param {object} [options]
 * @param {"dialog"|"app"} [options.kind="dialog"]
 * @param {string} [options.modifier]  BEM modifier (e.g. "roll-options" → wwn-dialog--roll-options)
 * @param {string[]} [options.extra]   Additional classes appended after the base set
 * @returns {string[]}
 */
export function buildWwnAppClasses({ kind = "dialog", modifier, extra = [] } = {}) {
  const base = kind === "app" ? "wwn-app" : "wwn-dialog";
  const classes = ["wwn", base, "themed", getUiThemeClass()];
  if (modifier) classes.push(`${base}--${modifier}`);
  if (extra.length) classes.push(...extra);
  return classes;
}

/**
 * Add the active theme class to a rendered chat message.
 * @param {ChatMessage} _message
 * @param {HTMLElement} html
 */
export function themeChatMessage(_message, html) {
  html.classList.add("themed", getUiThemeClass());
}
