/**
 * Minimal theme stubs for settings registration.
 * WWN uses its own SCSS; these keep theme-related hooks from breaking.
 */
export const THEMES = {
  wwn: { label: "WWN.Theme.WWN", colorScheme: "light" },
};

export function sheetThemeChoices() {
  return Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.label]));
}

export function applyUiTheme(_theme) {
  /* no-op: WWN uses its own SCSS */
}

export function themeChatMessage(_message, _html) {
  /* no-op */
}
