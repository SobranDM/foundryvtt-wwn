import { WwnDialog } from "./wwn-dialog.js";

function getModifiersData(actor) {
  const doc = actor.document ?? actor;
  const data = foundry.utils.deepClone(doc.data ?? doc);
  data.user = game.user;
  return data;
}

/**
 * Open the Character Modifiers (display) dialog.
 * @param {Actor} actor
 * @param {object} [options]
 */
export async function openCharacterModifiers(actor, options = {}) {
  const data = getModifiersData(actor);
  const fullHtml = await renderTemplate(
    "systems/wwn/templates/actors/dialogs/modifiers-dialog.hbs",
    data
  );
  const wrap = document.createElement("div");
  wrap.innerHTML = fullHtml;
  const form = wrap.querySelector("form");
  const inner = form ? form.innerHTML : wrap.innerHTML;

  await WwnDialog.wait({
    classes: ["wwn", "dialog", "modifiers"],
    title: `${actor.name}: Modifiers`,
    content: inner,
    position: { width: 240 },
    buttons: [
      { action: "ok", label: "OK", icon: "fa-solid fa-check", default: true },
    ],
  });
}
