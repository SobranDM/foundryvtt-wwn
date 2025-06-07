import { WwnPartySheet } from "./dialog/party-sheet.js";

export const addControl = (object, html) => {
  // Convert html to jQuery if it's not already
  const $html = html instanceof jQuery ? html : $(html);

  let control = `<button class='wwn-party-sheet' type="button" title='${game.i18n.localize('WWN.dialog.partysheet')}'><i class='fas fa-users'></i></button>`;

  // Try to find the toggle-search-mode element first since we know it exists
  const toggleSearch = $html.find(".toggle-search-mode");
  if (toggleSearch.length) {
    toggleSearch.before($(control));
  } else {
    // Fallback to inserting at the start of the header
    $html.find("#actors").find("header").prepend($(control));
  }

  $html.find('.wwn-party-sheet').click(ev => {
    showPartySheet(object);
  });
}

export const showPartySheet = (object) => {
  event.preventDefault();
  new WwnPartySheet(object, {
    top: window.screen.height / 2 - 180,
    left: window.screen.width / 2 - 140,
  }).render(true);
}

export const update = (actor, data) => {
  if (actor.getFlag('wwn', 'party')) {
    Object.values(ui.windows).forEach(w => {
      if (w instanceof WwnPartySheet) {
        w.render(true);
      }
    })
  }
}