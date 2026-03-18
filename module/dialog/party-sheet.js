/**
 * Party sheet and select dialogs using DialogV2 (v13-only).
 */
import { WwnDialog } from "./wwn-dialog.js";
import { openPartyXPDialog } from "./party-xp.js";
import { openPartyCurrencyDialog } from "./party-coin.js";

function getPartySheetData() {
  const partyActors = game.actors.filter((e) => e.type === "character" && e.flags.wwn?.party === true);
  return {
    data: { documents: partyActors },
    config: CONFIG.WWN,
    user: game.user,
    settings: game.settings,
    useGoldStandard: game.settings.get("wwn", "useGoldStandard"),
  };
}

/**
 * Open the Select Party Characters dialog.
 */
export async function openPartySelectDialog() {
  const allCharacterActors = game.actors.filter((e) => e.type === "character");
  const templateData = { actors: allCharacterActors };
  const content = await renderTemplate("systems/wwn/templates/apps/party-select.hbs", templateData);
  await WwnDialog.wait({
    title: game.i18n.localize("WWN.dialog.partysheet") + " – " + game.i18n.localize("WWN.dialog.selectActors"),
    content,
    position: { width: 220, height: "auto" },
    buttons: [
      {
        action: "set",
        icon: "fa-solid fa-save",
        label: game.i18n.localize("WWN.Update"),
        default: true,
        callback: (_ev, _btn, dialog) => {
          const root = dialog?.element;
          const el = root?.length ? root[0] : root;
          const checks = el?.querySelectorAll?.("input[data-action='select-actor']") ?? [];
          checks.forEach(async (c) => {
            const key = c.getAttribute("name");
            if (key != null && allCharacterActors[key]) {
              await allCharacterActors[key].setFlag("wwn", "party", c.checked);
            }
          });
        },
      },
    ],
  });
}

/**
 * Open the Party Sheet dialog (party member list with actions).
 */
export async function openPartySheet() {
  const data = getPartySheetData();
  const content = await renderTemplate("systems/wwn/templates/apps/party-sheet.hbs", data);

  await WwnDialog.wait({
    classes: ["wwn", "dialog", "party-sheet"],
    title: game.i18n.localize("WWN.dialog.partysheet"),
    content,
    position: { width: 600, height: 480 },
    buttons: [
      {
        action: "select",
        icon: "fa-solid fa-user-plus",
        label: game.i18n.localize("WWN.dialog.selectActors"),
        callback: async () => { await openPartySelectDialog(); },
      },
      {
        action: "xp",
        icon: "fa-solid fa-star",
        label: game.i18n.localize("WWN.dialog.xp.deal"),
        callback: async () => { await openPartyXPDialog(); },
      },
      {
        action: "currency",
        icon: "fa-solid fa-coins",
        label: game.settings.get("wwn", "useGoldStandard")
          ? game.i18n.localize("WWN.dialog.currency.dealGold")
          : game.i18n.localize("WWN.dialog.currency.deal"),
        callback: async () => { await openPartyCurrencyDialog(); },
      },
      { action: "close", label: "Close", icon: "fa-solid fa-times", default: true },
    ],
  });
}
