import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";
import { formatCommitmentOption } from "./commitment.mjs";

/**
 * Prompt for a shared-pool commitment tier when multiple options exist.
 * @param {Item} power
 * @param {object} options
 * @param {{ cost: number, length: string, note?: string }[]} options.options
 * @param {boolean} [options.skipDialog=false]
 * @returns {Promise<{ cost: number, length: string, note?: string }|null>}
 */
export async function pickCommitmentOption(power, { options, skipDialog = false } = {}) {
  if (!options?.length) return null;
  if (options.length === 1 || skipDialog) return options[0];

  const choice = await showWwnDialog({
    modifier: "commitment-choice",
    title: game.i18n.format("WWN.Power.CommitmentChoiceTitle", { name: power.name }),
    template: "systems/wwn/templates/dialog/commitment-choice.hbs",
    context: {
      options: options.map((o) => ({ ...o, label: formatCommitmentOption(o) })),
    },
    buttons: [confirmButton(), cancelButton()],
  });
  if (!choice || choice === "cancel") return null;
  const idx = Number(choice.optionIndex);
  return options[idx] ?? null;
}
