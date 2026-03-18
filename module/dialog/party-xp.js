/**
 * Party XP dialog using DialogV2 (v13-only).
 */
import { WwnDialog } from "./wwn-dialog.js";

function getPartyXPData() {
  const actors = game.actors.filter((e) => e.type === "character" && e.flags.wwn?.party === true);
  return {
    actors,
    config: CONFIG.WWN,
    user: game.user,
    settings: game.settings,
  };
}

function calculateShare(dialogEl) {
  const actors = game.actors.filter((e) => e.type === "character" && e.flags.wwn?.party === true);
  const totalInput = dialogEl?.querySelector?.('input[name="total"]');
  const toDeal = totalInput?.value;
  const shares = actors.length;
  const value = parseFloat(toDeal) / shares / 100;
  if (!value || !Number.isFinite(value)) return;
  actors.forEach((a) => {
    const row = dialogEl?.querySelector(`div[data-actor-id='${a.id}'] input`);
    if (row) row.value = Math.floor(a.system.details.xp.share * value);
  });
}

function dealXP(dialogEl) {
  dialogEl?.querySelectorAll?.(".actor").forEach((row) => {
    const input = row.querySelector("input");
    const value = input?.value;
    const id = row.dataset?.actorId;
    const actor = id ? game.actors.get(id) : null;
    if (value && actor) actor.getExperience(Math.floor(parseInt(value, 10)));
  });
}

/**
 * Open the Deal XP dialog for party characters.
 */
export async function openPartyXPDialog() {
  const data = getPartyXPData();
  const content = await renderTemplate("systems/wwn/templates/apps/party-xp.hbs", data);

  await WwnDialog.wait({
    title: game.i18n.localize("WWN.dialog.xp.deal"),
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
        label: game.i18n.localize("WWN.dialog.xp.deal"),
        icon: "fa-solid fa-gift",
        default: true,
        callback: (_ev, _btn, dialog) => {
          const root = dialog?.element;
          const el = root?.length ? root[0] : root;
          dealXP(el);
        },
      },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-times" },
    ],
  });
}
