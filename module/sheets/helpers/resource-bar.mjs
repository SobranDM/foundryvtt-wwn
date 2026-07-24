/**
 * Header resource bar preparation (HP / Strain / Alienation / Stress / XP).
 *
 * Uses WWN's tracker registry (`WWN.headerTrackers`) and settings namespace
 * ("wwn"). Imports `WWN` directly from module/config/index.mjs (rather than
 * the global `CONFIG.WWN`) so this helper stays unit-testable under plain
 * Node, matching the existing convention used by
 * module/helpers/power-sections.mjs.
 */
import { WWN } from "../../config/index.mjs";

/**
 * Build render data for the universal header trackers of an actor
 * (HP, Strain always; Alienation/Stress gated by settings).
 * @param {Actor} actor
 * @returns {Array<object>} bar contexts for templates/partials/resource-bars.hbs
 */
export function prepareResourceBars(actor) {
  const bars = [];
  const trackers = WWN.headerTrackers ?? [];
  for (const tracker of trackers) {
    if (!tracker.always && tracker.setting) {
      if (!game.settings.get("wwn", tracker.setting)) continue;
    }
    const data = foundry.utils.getProperty(actor.system, tracker.path);
    if (!data) continue;

    const ceiling = data[tracker.ceiling ?? "max"] ?? 0;
    const value = data.value ?? 0;
    const overflow = tracker.ceiling === "valueMax" && value > ceiling;
    let pct = ceiling > 0 ? Math.clamp((value / ceiling) * 100, 0, 100) : 0;
    if (overflow) pct = 100;

    bars.push({
      id: tracker.id,
      label: tracker.label,
      mode: tracker.mode,
      value,
      ceiling,
      pct: Math.round(pct),
      overflow,
      valuePath: `system.${tracker.path}.value`,
      maxPath: tracker.editableMax ? `system.${tracker.path}.${tracker.ceiling ?? "max"}` : null,
      barClass: [
        "wwn-resource-bar",
        `wwn-resource-bar--${tracker.mode}`,
        `wwn-resource-bar--${tracker.id}`,
        overflow ? "wwn-resource-bar--overflow" : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  return bars;
}

/**
 * Build render data for the PC XP fill bar (value / next), shown separately
 * from the universal trackers since it lives in `system.details.xp` rather
 * than the header-tracker registry.
 * @param {Actor} actor
 * @returns {object|null} bar context for templates/partials/resource-bars.hbs, or null if unavailable
 */
export function prepareXpBar(actor) {
  const xp = actor.system?.details?.xp;
  if (!xp) return null;

  const value = xp.value ?? 0;
  const next = xp.next ?? 0;
  const pct = next > 0 ? Math.clamp((value / next) * 100, 0, 100) : 0;

  return {
    id: "xp",
    label: "WWN.Sheet.XP",
    mode: "positive",
    value,
    ceiling: next,
    pct: Math.round(pct),
    overflow: false,
    valuePath: "system.details.xp.value",
    maxPath: null,
    barClass: ["wwn-resource-bar", "wwn-resource-bar--positive", "wwn-resource-bar--xp"].join(" "),
  };
}
