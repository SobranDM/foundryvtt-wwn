import { isPc } from "./actor-types.mjs";

const FLAG = "wwn";
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * @param {Item} classEdge
 * @returns {boolean}
 */
export function classEdgeNeedsAttributeChoice(classEdge) {
  if (classEdge?.type !== "classEdge") return false;
  const mode = classEdge.system?.attributeGrant?.mode ?? "";
  if (!mode) return false;
  return !String(classEdge.system?.attributeGrant?.chosen ?? "").trim();
}

/**
 * @param {string} mode
 * @param {string} ability
 * @returns {object[]} AE change objects
 */
export function attributeGrantChanges(mode, ability) {
  const key = String(ability ?? "").toLowerCase();
  if (!ABILITY_KEYS.includes(key)) return [];
  if (mode === "modPlus1Cap2") {
    return [{ key: `system.abilities.${key}.mod`, type: "add", value: 1, phase: "final" }];
  }
  if (mode === "modMinus1") {
    return [{ key: `system.abilities.${key}.mod`, type: "add", value: -1, phase: "final" }];
  }
  if (mode === "prodigy") {
    return [
      { key: `system.abilities.${key}.value`, type: "override", value: 18, phase: "initial" },
      { key: `system.abilities.${key}.mod`, type: "override", value: 3, phase: "final" },
    ];
  }
  return [];
}

/**
 * @param {Item} classEdge
 * @returns {string[]}
 */
function pickOptions(classEdge) {
  const exclude = new Set(
    (classEdge.system?.attributeGrant?.exclude ?? []).map((s) => String(s).trim().toLowerCase()),
  );
  return ABILITY_KEYS.filter((k) => !exclude.has(k));
}

/**
 * @param {Item} classEdge
 * @returns {Promise<string|null>}
 */
async function promptAttributeChoice(classEdge) {
  const options = pickOptions(classEdge);
  if (!options.length) return null;
  const { showWwnDialog, confirmButton, cancelButton } = await import("../applications/wwn-dialog.mjs");
  const labels = {
    str: game.i18n.localize("WWN.scores.str.long"),
    dex: game.i18n.localize("WWN.scores.dex.long"),
    con: game.i18n.localize("WWN.scores.con.long"),
    int: game.i18n.localize("WWN.scores.int.long"),
    wis: game.i18n.localize("WWN.scores.wis.long"),
    cha: game.i18n.localize("WWN.scores.cha.long"),
  };
  const skillOptions = options.map((slug) => ({ slug, label: labels[slug] ?? slug }));
  const result = await showWwnDialog({
    modifier: "focus-bonus-skills",
    title: game.i18n.format("WWN.ClassEdge.AttributePickDialogTitle", { edge: classEdge.name }),
    template: "systems/wwn/templates/dialog/focus-bonus-skills.hbs",
    context: { skillOptions, pick: 1, focusName: classEdge.name },
    buttons: [confirmButton(), cancelButton()],
  });
  if (!result || result === "cancel") return null;
  const slug = String(result.skill ?? "").toLowerCase();
  return options.includes(slug) ? slug : null;
}

/**
 * Apply or refresh the transferred AE that encodes the attribute grant.
 * @param {Item} classEdge
 */
export async function syncClassEdgeAttributeGrantEffect(classEdge) {
  if (classEdge?.type !== "classEdge") return;
  const mode = classEdge.system?.attributeGrant?.mode ?? "";
  const chosen = String(classEdge.system?.attributeGrant?.chosen ?? "").trim().toLowerCase();
  const changes = mode && chosen ? attributeGrantChanges(mode, chosen) : [];

  const existing = classEdge.effects.find((e) => e.getFlag(FLAG, "attributeGrantEffect"));
  if (!changes.length) {
    if (existing) await existing.delete();
    return;
  }

  const effectData = {
    name: game.i18n.format("WWN.ClassEdge.AttributeGrantEffect", { edge: classEdge.name }),
    img: "icons/svg/aura.svg",
    transfer: true,
    disabled: false,
    flags: { [FLAG]: { attributeGrantEffect: true } },
    system: { changes },
  };

  if (existing) {
    await existing.update({
      name: effectData.name,
      "system.changes": changes,
      disabled: false,
    });
  } else {
    await classEdge.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}

/**
 * @param {Item} classEdge
 * @param {Actor} actor
 * @param {{ prompt?: boolean }} [options]
 */
export async function syncClassEdgeAttributeGrant(classEdge, actor, { prompt = false } = {}) {
  if (classEdge?.type !== "classEdge" || !isPc(actor)) return;
  const mode = classEdge.system?.attributeGrant?.mode ?? "";
  if (!mode) return;

  let chosen = String(classEdge.system?.attributeGrant?.chosen ?? "").trim().toLowerCase();
  if (!chosen && classEdgeNeedsAttributeChoice(classEdge)) {
    if (!prompt) return;
    chosen = await promptAttributeChoice(classEdge);
    if (!chosen) return;
    await classEdge.update({ "system.attributeGrant.chosen": chosen });
  }
  if (!chosen) return;
  await syncClassEdgeAttributeGrantEffect(classEdge);
}
