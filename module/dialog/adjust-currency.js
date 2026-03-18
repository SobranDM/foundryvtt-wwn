/**
 * Adjust Currency dialog using DialogV2 (v13-only).
 */
import { WwnDialog } from "./wwn-dialog.js";

function getDialogData(actor) {
  const data = foundry.utils.deepClone(actor);
  if (data.type === "character") data.isCharacter = true;
  data.showBank = actor.type !== "vehicle";
  data.useGoldStandard = game.settings.get("wwn", "useGoldStandard");
  data.bankLabel = data.useGoldStandard
    ? game.i18n.localize("WWN.items.bank.shortGold")
    : game.i18n.localize("WWN.items.bank.short");
  data.user = game.user;
  data.config = CONFIG.WWN;
  return data;
}

/**
 * Read form and update actor currency. Uses native DOM (no jQuery).
 * @param {Actor} actor
 * @param {HTMLFormElement} form
 */
async function applyCurrencyFromForm(actor, form) {
  const getVal = (name) => parseInt(form.querySelector(`[name="${name}"]`)?.value, 10) || 0;
  let updatedCurrency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, bank: 0 };
  updatedCurrency.cp = getVal("copper");
  updatedCurrency.sp = getVal("silver");
  updatedCurrency.gp = getVal("gold");
  if (actor.type !== "vehicle") {
    updatedCurrency.bank = getVal("bank");
  }
  if (game.settings.get("wwn", "currencyTypes") === "currencybx") {
    updatedCurrency.ep = getVal("electrum");
    updatedCurrency.pp = getVal("platinum");
  }
  const sys = actor.system?.currency ?? {};
  updatedCurrency = {
    cp: updatedCurrency.cp + (sys.cp ?? 0),
    sp: updatedCurrency.sp + (sys.sp ?? 0),
    ep: updatedCurrency.ep + (sys.ep ?? 0),
    gp: updatedCurrency.gp + (sys.gp ?? 0),
    pp: updatedCurrency.pp + (sys.pp ?? 0),
    bank: actor.type === "vehicle" ? 0 : (updatedCurrency.bank + (sys.bank ?? 0)),
  };
  const invalidEntries = Object.entries(updatedCurrency).filter(([, v]) => v < 0);
  if (invalidEntries.length > 0) {
    ui.notifications?.warn(`Cannot reduce ${invalidEntries[0][0].toUpperCase()} below 0!`);
    return;
  }
  await actor.update({ "system.currency": updatedCurrency });
}

/**
 * Open the Adjust Currency dialog for an actor. Uses DialogV2 when available.
 * @param {Actor} actor - The actor whose currency to adjust
 * @param {object} [options] - Optional sheet render options (for backward compatibility, ignored when using DialogV2)
 */
export async function openAdjustCurrency(actor, options = {}) {
  const data = getDialogData(actor);
  const fullHtml = await renderTemplate(
    "systems/wwn/templates/actors/dialogs/adjust-currency.hbs",
    data
  );
  const wrap = document.createElement("div");
  wrap.innerHTML = fullHtml;
  const inner = wrap.querySelector(".currency-adjustment")?.innerHTML ?? wrap.innerHTML;

  await WwnDialog.wait({
    title: game.i18n.localize("WWN.items.adjustCurrency"),
    content: inner,
    position: { width: 280 },
    buttons: [
      {
        action: "apply",
        label: game.i18n.localize("WWN.items.adjustCurrency"),
        icon: "fa-solid fa-balance-scale",
        callback: async (_event, button, dialog) => {
          const form = dialog.element?.querySelector?.("form");
          if (form) await applyCurrencyFromForm(actor, form);
        },
      },
      {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-times",
        default: true,
      },
    ],
  });

  if (actor.sheet?.rendered) actor.sheet.render(true);
}
