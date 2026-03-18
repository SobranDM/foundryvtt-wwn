import { openPartySheet } from "./dialog/party-sheet.js";

export const addControl = (object, html) => {
  const el = html instanceof jQuery ? html[0] : html;
  if (!el) return;

  const control = document.createElement("button");
  control.className = "wwn-party-sheet";
  control.type = "button";
  control.title = game.i18n.localize("WWN.dialog.partysheet");
  control.innerHTML = "<i class='fas fa-users'></i>";
  control.addEventListener("click", () => showPartySheet(object));

  const toggleSearch = el.querySelector(".toggle-search-mode");
  if (toggleSearch) {
    toggleSearch.before(control);
  } else {
    const header = el.querySelector("#actors header");
    if (header) header.prepend(control);
  }
}

export const showPartySheet = () => {
  openPartySheet();
}

/**
 * Called when an actor is updated. Party sheet is now dialog-based; no persistent sheet to refresh.
 */
export const update = (_actor, _data) => {}