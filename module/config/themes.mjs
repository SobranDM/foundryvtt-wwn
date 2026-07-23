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
 * Add the active theme class to a rendered chat message.
 * @param {ChatMessage} _message
 * @param {HTMLElement} html
 */
export function themeChatMessage(_message, html) {
  const theme = game.settings.get("wwn", "uiTheme") ?? "wwn";
  html.classList.add("themed", `theme-${theme}`);
}
