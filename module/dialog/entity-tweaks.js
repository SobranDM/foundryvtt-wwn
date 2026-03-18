import { WwnDialog } from "./wwn-dialog.js";

const FormDataExtended = foundry?.applications?.ux?.FormDataExtended ?? null;

function getTweaksData(actor) {
  const data = foundry.utils.deepClone(actor);
  if (data.type === "character") data.isCharacter = true;
  data.user = game.user;
  data.config = CONFIG.WWN;
  return data;
}

function formToObject(form) {
  if (FormDataExtended) return new FormDataExtended(form).object;
  const obj = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") obj[el.name] = el.checked;
    else obj[el.name] = el.value;
  }
  return obj;
}

/**
 * Open the Entity Tweaks dialog for an actor.
 * @param {Actor} actor
 * @param {object} [options]
 */
export async function openEntityTweaks(actor, options = {}) {
  const data = getTweaksData(actor);
  const content = await renderTemplate(
    "systems/wwn/templates/actors/dialogs/tweaks-dialog.hbs",
    data
  );

  await WwnDialog.wait({
    title: `${actor.name}: ${game.i18n.localize("WWN.dialog.tweaks")}`,
    content,
    position: { width: 580 },
    buttons: [
      {
        action: "save",
        label: game.i18n.localize("Save Changes"),
        icon: "fa-solid fa-save",
        callback: async (_event, _button, dialog) => {
          const form = dialog?.element?.querySelector?.("form");
          if (!form) return;
          const formData = formToObject(form);
          const expanded = foundry.utils.expandObject(formData);
          await actor.update(expanded);
          if (actor.sheet?.rendered) actor.sheet.render(true);
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
}
