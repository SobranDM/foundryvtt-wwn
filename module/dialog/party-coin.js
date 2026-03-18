/**
 * Party Currency dialog using DialogV2 (v13-only).
 */
import { WwnDialog } from "./wwn-dialog.js";

function getPartyCurrencyData() {
  const actors = game.actors.filter((e) => e.type === "character" && e.flags.wwn?.party === true);
  return {
    actors,
    config: CONFIG.WWN,
    user: game.user,
    settings: game.settings,
    useGoldStandard: game.settings.get("wwn", "useGoldStandard"),
  };
}

function calculateShare(dialogEl) {
  const actors = game.actors.filter((e) => e.type === "character" && e.flags.wwn?.party === true);
  const totalInput = dialogEl?.querySelector?.('input[name="total"]');
  const toDeal = totalInput?.value;
  let shares = 0;
  actors.forEach((a) => { shares += a.system.currency.share; });
  const value = parseFloat(toDeal) / shares;
  if (!value || !Number.isFinite(value)) return;
  actors.forEach((a) => {
    const row = dialogEl?.querySelector(`div[data-actor-id='${a.id}'] input`);
    if (row) row.value = Math.floor(a.system.currency.share * value);
  });
}

function dealCurrency(dialogEl) {
  dialogEl?.querySelectorAll?.(".actor").forEach((row) => {
    const input = row.querySelector("input");
    const value = input?.value;
    const id = row.dataset?.actorId;
    const actor = id ? game.actors.get(id) : null;
    if (value && actor) actor.getBank(Math.floor(parseInt(value, 10)));
  });
}

/**
 * Open the Deal Currency dialog for party characters.
 */
export async function openPartyCurrencyDialog() {
  const data = getPartyCurrencyData();
  const content = await renderTemplate("systems/wwn/templates/apps/party-coin.hbs", data);

  await WwnDialog.wait({
    title: game.settings.get("wwn", "useGoldStandard")
      ? game.i18n.localize("WWN.dialog.currency.dealGold")
      : game.i18n.localize("WWN.dialog.currency.deal"),
    content,
    position: { width: 280, height: 400 },
    buttons: [
      {
        action: "calculate",
        label: "Calculate Share",
        icon: "fa-solid fa-calculator",
        callback: (_ev, _btn, dialog) => {
          const root = dialog?.element;
          const el = root?.length ? root[0] : root;
          calculateShare(el);
          return null;
        },
      },
      {
        action: "deal",
        label: game.settings.get("wwn", "useGoldStandard")
          ? game.i18n.localize("WWN.dialog.currency.dealGold")
          : game.i18n.localize("WWN.dialog.currency.deal"),
        icon: "fa-solid fa-coins",
        default: true,
        callback: (_ev, _btn, dialog) => {
          const root = dialog?.element;
          const el = root?.length ? root[0] : root;
          dealCurrency(el);
        },
      },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-times" },
    ],
  });
}
