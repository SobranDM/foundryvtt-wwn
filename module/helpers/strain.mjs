import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";

/**
 * Parse a strain cost string ("", "1", "0,1" for optional spend).
 * @param {string} raw
 * @returns {{kind: "none"|"flat"|"choice", values: number[]}}
 */
export function parseStrainField(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { kind: "none", values: [] };
  const parts = text.split(",").map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n))) return { kind: "none", values: [] };
  if (parts.length === 1) {
    return parts[0] > 0 ? { kind: "flat", values: parts } : { kind: "none", values: [] };
  }
  return { kind: "choice", values: parts };
}

/**
 * Resolve a parsed strain field to an amount, prompting when kind is "choice".
 * @param {{kind: string, values: number[]}} parsed
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.hintKey]
 * @param {string} [options.labelKey]
 * @returns {Promise<number|null>} null when cancelled or none
 */
export async function resolveStrainAmount(parsed, { title, hintKey, labelKey } = {}) {
  if (parsed.kind === "none") return 0;
  if (parsed.kind === "flat") return parsed.values[0];
  if (parsed.kind !== "choice") return 0;

  const choice = await showWwnDialog({
    modifier: "strain-choice",
    title: title ?? game.i18n.localize("WWN.Power.StrainChoiceTitleGeneric"),
    template: "systems/wwn/templates/dialog/strain-choice.hbs",
    context: {
      values: parsed.values,
      hintKey: hintKey ?? "WWN.Power.StrainChoiceHint",
      labelKey: labelKey ?? "WWN.Power.UserStrain",
    },
    buttons: [confirmButton(), cancelButton()],
  });
  if (!choice || choice === "cancel") return null;
  return Number(choice.strain) || 0;
}

/**
 * Apply system strain to one actor; returns false when over capacity.
 * @param {Actor} actor
 * @param {number} amount
 * @returns {Promise<boolean>}
 */
export async function applyStrainToActor(actor, amount) {
  if (!amount || amount <= 0) return true;
  const newStrain = actor.system.strain.value + amount;
  if (newStrain > actor.system.strain.max) {
    ui.notifications.warn(
      game.i18n.format("WWN.Power.StrainFullActor", { name: actor.name })
    );
    return false;
  }
  await actor.update({ "system.strain.value": newStrain });
  return true;
}
