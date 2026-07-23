import { showWwnDialog, cancelButton } from "../applications/wwn-dialog.mjs";
import { applyLegacySheetAliases } from "../helpers/sheet-legacy-bridge.mjs";

/**
 * Open the read-only modifiers summary dialog for an actor.
 * @param {Actor} actor
 */
export async function showCharacterModifiersDialog(actor) {
  const system = foundry.utils.deepClone(actor.system);
  applyLegacySheetAliases(system, {
    separateRangedAC: game.settings.get("wwn", "separateRangedAC"),
  });
  await showWwnDialog({
    modifier: "modifiers",
    title: `${actor.name}: Modifiers`,
    template: "systems/wwn/templates/actors/dialogs/modifiers-dialog.html",
    context: {
      system,
      languages: actor.system.languages ?? [],
      user: game.user,
    },
    position: { width: 240 },
    buttons: [cancelButton({ label: "Close" })],
  });
}

/** @deprecated Prefer {@link showCharacterModifiersDialog} */
export class WwnCharacterModifiers {
  constructor(object) {
    this.object = object;
  }
  render() {
    return showCharacterModifiersDialog(this.object);
  }
}
