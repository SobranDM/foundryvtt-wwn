import { WwnPartySheet } from "./dialog/party-sheet.js";

/**
 * @param {import("../../foundryvtt/client/applications/sidebar/tabs/actor-directory.mjs").default} object
 * @param {HTMLElement} html
 */
export const addControl = (object, html) => {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "wwn-party-sheet";
  control.title = game.i18n.localize("WWN.dialog.partysheet");
  control.innerHTML = `<i class="fas fa-users"></i>`;
  control.addEventListener("click", (ev) => showPartySheet(object, ev));

  // Try to find the toggle-search-mode element first since we know it exists
  const toggleSearch = html.querySelector(".toggle-search-mode");
  if (toggleSearch) {
    toggleSearch.before(control);
  } else {
    // Fallback to inserting at the start of the header
    html.querySelector("header")?.prepend(control);
  }
};

export const showPartySheet = (object, event) => {
  event?.preventDefault();
  new WwnPartySheet(object, {
    top: window.screen.height / 2 - 180,
    left: window.screen.width / 2 - 140,
  }).render(true);
};

export const update = (actor) => {
  if (actor.getFlag("wwn", "party")) {
    Object.values(ui.windows).forEach((w) => {
      if (w instanceof WwnPartySheet) {
        w.render(true);
      }
    });
  }
};
