const FLAG_SCOPE = "wwn";
const FLAG_KEY = "treasure";

/**
 * Add a "Treasure Mode" toggle to the RollTableSheet header controls menu, and (when active) a "Roll Treasure"
 * button to the sheet footer. Hooked to `getHeaderControlsRollTableSheet` and `renderRollTableSheet`.
 * @param {import("../../foundryvtt/client/applications/sheets/roll-table-sheet.mjs").default} app
 * @param {object[]} controls
 */
export const addTreasureToggleControl = (app, controls) => {
  const table = app.document;
  const isTreasure = !!table.getFlag(FLAG_SCOPE, FLAG_KEY);
  controls.push({
    icon: "fas fa-gem",
    label: isTreasure ? "WWN.table.treasure.disable" : "WWN.table.treasure.enable",
    onClick: () => table.setFlag(FLAG_SCOPE, FLAG_KEY, !isTreasure),
  });
};

/**
 * @param {import("../../foundryvtt/client/applications/sheets/roll-table-sheet.mjs").default} app
 * @param {HTMLElement} html
 */
export const augmentTable = (app, html) => {
  const table = app.document;
  const isTreasure = !!table.getFlag(FLAG_SCOPE, FLAG_KEY);
  html.classList.toggle("wwn-treasure-table", isTreasure);
  if (!isTreasure) return;

  const footer = html.querySelector(".form-footer");
  if (!footer || footer.querySelector(".roll-treasure")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "roll-treasure";
  button.innerHTML = `<i class="fas fa-gem"></i> <span>${game.i18n.localize("WWN.table.treasure.roll")}</span>`;
  button.addEventListener("click", () => rollTreasure(table));
  footer.append(button);
};

/**
 * Recursively draw treasure from a table, cascading into any linked sub-tables.
 * @param {RollTable} table
 * @param {object} data
 * @returns {Promise<object>}
 */
async function drawTreasure(table, data) {
  const rollPercent = async (chance) => {
    const roll = await new Roll("1d100").roll();
    return roll.total <= chance;
  };

  data.treasure = {};
  if (table.getFlag(FLAG_SCOPE, FLAG_KEY)) {
    for (const r of table.results) {
      if (!(await rollPercent(r.weight))) continue;
      data.treasure[r.id] = { img: r.img, text: await r.getHTML() };

      if (r.type === CONST.TABLE_RESULT_TYPES.DOCUMENT) {
        const linked = await fromUuid(r.documentUuid);
        if (linked?.documentName === "RollTable") {
          await drawTreasure(linked, data.treasure[r.id]);
        }
      }
    }
  } else {
    const tableRoll = await table.roll();
    for (const result of tableRoll.results) {
      data.treasure[result.id] = { img: result.img, text: await result.getHTML() };
    }
  }
  return data;
}

async function rollTreasure(table) {
  const data = await drawTreasure(table, {});
  const templateData = {
    treasure: data.treasure,
    table: table,
  };

  const html = await foundry.applications.handlebars.renderTemplate(
    "systems/wwn/templates/chat/roll-treasure.html",
    templateData
  );

  const chatData = {
    content: html,
  };

  const rollMode = game.settings.get("core", "rollMode");
  if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
  if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
  if (rollMode === "blindroll") chatData["blind"] = true;

  ChatMessage.create(chatData);
}
