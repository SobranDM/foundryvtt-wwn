/**
 * One-time classEdge assignment dialog for migrated PCs.
 */

import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";
import {
  CLASS_EDGE_CATALOG,
  precheckClassEdgesFromClassField,
} from "../helpers/class-assignment-guess.mjs";
import { findSystemPackItemByName } from "../helpers/class-edge-grants.mjs";
import { isPc } from "../helpers/actor-types.mjs";

const NS = "wwn";

/**
 * Load system pack classEdge documents for the picker.
 * @returns {Promise<Array<{ name: string, uuid: string, group: "full"|"partial" }>>}
 */
export async function loadClassEdgeOptions() {
  const byName = new Map();
  for (const pack of game.packs) {
    if (pack.metadata?.packageType !== "system") continue;
    if (pack.documentName !== "Item") continue;
    if (!String(pack.collection).startsWith(`${NS}.`)) continue;
    const index = await pack.getIndex({ fields: ["name", "type"] });
    for (const entry of index) {
      if (entry.type !== "classEdge") continue;
      const name = String(entry.name ?? "").trim();
      if (!name || byName.has(name)) continue;
      const group = name.startsWith("Full ") ? "full" : "partial";
      byName.set(name, { name, uuid: entry.uuid, group });
    }
  }

  // Prefer catalog order; append any extras
  const ordered = [];
  for (const name of CLASS_EDGE_CATALOG) {
    if (byName.has(name)) ordered.push(byName.get(name));
    byName.delete(name);
  }
  for (const opt of byName.values()) ordered.push(opt);
  return ordered;
}

/**
 * @param {Actor} actor
 * @returns {Promise<boolean>} true if dialog was shown
 */
export async function maybeShowClassAssignmentDialog(actor) {
  if (!actor || !isPc(actor)) return false;
  if (!actor.isOwner) return false;
  if (actor.items.some((i) => i.type === "classEdge")) {
    await actor.unsetFlag(NS, "needsClassAssignment");
    return false;
  }
  if (actor.getFlag(NS, "classAssignmentDismissed")) return false;
  if (!actor.getFlag(NS, "needsClassAssignment")) return false;

  const options = await loadClassEdgeOptions();
  if (!options.length) {
    console.warn("WWN | Class assignment: no system classEdge items found.");
    // Leave the flag set so a later pack load can still prompt.
    return false;
  }

  const prechecked = new Set(precheckClassEdgesFromClassField(actor.system.details?.class ?? ""));
  const full = options.filter((o) => o.group === "full");
  const partial = options.filter((o) => o.group === "partial");

  const result = await showWwnDialog({
    modifier: "class-assignment",
    title: game.i18n.localize("WWN.ClassAssignment.Title"),
    template: "systems/wwn/templates/actors/dialogs/class-assignment.html",
    context: {
      hint: game.i18n.localize("WWN.ClassAssignment.Hint"),
      fullLabel: game.i18n.localize("WWN.ClassAssignment.Full"),
      partialLabel: game.i18n.localize("WWN.ClassAssignment.Partial"),
      full: full.map((o) => ({ ...o, checked: prechecked.has(o.name) })),
      partial: partial.map((o) => ({ ...o, checked: prechecked.has(o.name) })),
    },
    buttons: [
      confirmButton({
        label: "WWN.ClassAssignment.Submit",
        callback: (_event, button) => {
          const form = button.form;
          const names = [...form.querySelectorAll('input[name="classEdge"]:checked')].map(
            (el) => el.value
          );
          return { action: "submit", names };
        },
      }),
      cancelButton({ label: "WWN.ClassAssignment.Skip" }),
    ],
  });

  if (!result || result.action !== "submit") {
    await actor.setFlag(NS, "classAssignmentDismissed", true);
    await actor.unsetFlag(NS, "needsClassAssignment");
    return true;
  }

  await actor.unsetFlag(NS, "needsClassAssignment");
  await actor.unsetFlag(NS, "classAssignmentDismissed");

  const toCreate = [];
  for (const name of result.names ?? []) {
    const doc = await findSystemPackItemByName(name);
    if (!doc || doc.type !== "classEdge") {
      console.warn(`WWN | Class assignment: missing classEdge "${name}"`);
      continue;
    }
    const data = doc.toObject();
    delete data._id;
    delete data._key;
    delete data.folder;
    delete data.sort;
    delete data.ownership;
    if (Array.isArray(data.effects)) {
      data.effects = data.effects.map((e) => {
        const effect = foundry.utils.deepClone(e);
        delete effect._id;
        delete effect._key;
        return effect;
      });
    }
    toCreate.push(data);
  }

  if (toCreate.length) {
    await actor.createEmbeddedDocuments("Item", toCreate);
  }
  return true;
}
