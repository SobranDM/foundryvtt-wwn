/**
 * Character creation dialog using DialogV2 (v13-only).
 * Uses renderDialogV2 hook to bind roll and stats listeners to content.
 */
import { WwnDialog } from "./wwn-dialog.js";
import { WwnDice } from "../dice.js";

const CREATOR_CLASS = "wwn-character-creator";

function getCreatorData(actor) {
  const data = foundry.utils.deepClone(actor);
  data.user = game.user;
  data.config = CONFIG.WWN;
  return data;
}

function doStats(ev, element) {
  const list = ev.currentTarget?.closest?.(".attribute-list");
  if (!list) return;
  const values = [];
  list.querySelectorAll(".score-value").forEach((s) => {
    if (s.value != null && s.value !== "" && Number(s.value) !== 0) values.push(parseInt(s.value, 10));
  });
  const n = values.length;
  if (!n) return;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const std = Math.sqrt(values.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / n);
  const stats = list.parentElement?.querySelector?.(".roll-stats");
  if (stats) {
    const sumEl = stats.querySelector(".sum");
    const avgEl = stats.querySelector(".avg");
    const stdEl = stats.querySelector(".std");
    if (sumEl) sumEl.textContent = sum;
    if (avgEl) avgEl.textContent = Math.round((10 * sum) / n) / 10;
    if (stdEl) stdEl.textContent = Math.round(100 * std) / 100;
  }
  const form = element?.querySelector?.("form");
  const submitBtn = form?.querySelector?.('button[type="submit"]');
  if (submitBtn && n >= 6) submitBtn.removeAttribute("disabled");
}

function bindCreatorListeners(element, actor) {
  if (!element || !actor) return;
  const counters = { str: 0, wis: 0, dex: 0, int: 0, cha: 0, con: 0, silver: 0 };
  element.querySelectorAll("a.score-roll").forEach((node) => {
    node.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const row = ev.currentTarget?.closest?.("[data-score]") ?? ev.currentTarget?.parentElement?.parentElement;
      const score = row?.dataset?.score;
      if (!score) return;
      counters[score]++;
      const label = game.i18n.localize(`WWN.scores.${score}.long`);
      const r = await WwnDice.Roll({
        event: ev,
        parts: ["3d6"],
        data: { roll: { type: "result" } },
        skipDialog: true,
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: game.i18n.format("WWN.dialog.generateScore", { score: label, count: counters[score] }),
        title: game.i18n.format("WWN.dialog.generateScore", { score: label, count: counters[score] }),
      });
      const input = row?.querySelector?.("input");
      if (input) {
        input.value = r.total;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });
  element.querySelectorAll("a.silver-roll").forEach((node) => {
    node.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const row = ev.currentTarget?.closest?.(".form-group") ?? ev.currentTarget?.parentElement?.parentElement?.parentElement;
      counters.silver++;
      const r = await WwnDice.Roll({
        event: ev,
        parts: ["3d6"],
        data: { roll: { type: "result" } },
        skipDialog: true,
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: game.i18n.format("WWN.dialog.generateScore", { score: "Silver", count: counters.silver }),
        title: game.i18n.format("WWN.dialog.generateScore", { score: "Silver", count: counters.silver }),
      });
      const silverInput = row?.querySelector?.(".silver-value");
      if (silverInput) silverInput.value = r.total * 10;
    });
  });
  element.querySelectorAll("input.score-value").forEach((node) => {
    node.addEventListener("change", (ev) => doStats(ev, element));
  });
}

/**
 * Open the Character Creator dialog for an actor.
 * @param {Actor} actor - The character actor to configure
 * @param {object} [options] - Optional position (for compatibility; DialogV2 may ignore)
 */
export async function openCharacterCreator(actor, options = {}) {
  const data = getCreatorData(actor);
  const content = await renderTemplate("systems/wwn/templates/actors/dialogs/character-creation.hbs", data);

  const hook = (app, element) => {
    if (!app.options?.classes?.includes(CREATOR_CLASS)) return;
    const el = element?.length ? element[0] : element;
    bindCreatorListeners(el, actor);
  };
  Hooks.once("renderDialogV2", hook);

  const result = await WwnDialog.wait({
    classes: ["wwn", "dialog", "creator", CREATOR_CLASS],
    title: `${actor.name}: ${game.i18n.localize("WWN.dialog.generator")}`,
    content,
    position: { width: 235 },
    buttons: [
      {
        action: "generate",
        label: game.i18n.localize("Save Changes"),
        icon: "fa-solid fa-save",
        default: true,
        callback: async (_ev, _btn, dialog) => {
          const root = dialog?.element;
          const el = root?.length ? root[0] : root;
          const form = el?.querySelector?.("form");
          if (!form || !actor) return;
          const scores = {};
          form.querySelectorAll(".attribute-list [data-score]").forEach((gr) => {
            const scoreKey = gr?.dataset?.score;
            const valEl = gr?.querySelector?.(".score-value");
            if (scoreKey != null) scores[scoreKey] = valEl?.value ?? "";
          });
          const silverEl = form.querySelector(".silver-value");
          const silver = parseInt(silverEl?.value, 10) || 0;
          const updateData = {};
          for (const [key, val] of Object.entries(scores)) {
            updateData[`system.scores.${key}.value`] = parseInt(val, 10) || 0;
          }
          updateData["system.currency.sp"] = silver;
          await actor.update(updateData);
          if (actor.sheet?.rendered) actor.sheet.render(true);
          const templateData = {
            config: CONFIG.WWN,
            scores,
            title: game.i18n.localize("WWN.dialog.generator"),
            stats: { sum: 0, avg: 0, std: 0 },
            silver: String(silver),
          };
          const chatContent = await renderTemplate("systems/wwn/templates/chat/roll-creation.hbs", templateData);
          ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });
        },
      },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-times" },
    ],
  });

  Hooks.off("renderDialogV2", hook);
  return result;
}

/** @deprecated Use openCharacterCreator(actor) instead. Kept for backwards compatibility. */
export class WwnCharacterCreator {
  constructor(actor, options = {}) {
    this.object = actor;
    this.options = options;
  }
  render(force = false) {
    return openCharacterCreator(this.object, this.options);
  }
}
