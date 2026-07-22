/**
 * Pre-load WWN Handlebars templates / partials.
 */
export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    "systems/wwn/templates/actors/character-sheet.html",
    "systems/wwn/templates/actors/monster-sheet.html",
    "systems/wwn/templates/actors/faction-sheet.html",
    "systems/wwn/templates/actors/partials/character-header.html",
    "systems/wwn/templates/actors/partials/character-attributes-tab.html",
    "systems/wwn/templates/actors/partials/character-powers-tab.html",
    "systems/wwn/templates/actors/partials/character-inventory-tab.html",
    "systems/wwn/templates/actors/partials/actor-effects.html",
    "systems/wwn/templates/actors/partials/character-notes-tab.html",
    "systems/wwn/templates/actors/partials/character-config-tab.html",
    "systems/wwn/templates/actors/partials/monster-header.html",
    "systems/wwn/templates/actors/partials/monster-attributes-tab.html",
    "systems/wwn/templates/actors/partials/monster-config-tab.html",
    "systems/wwn/templates/items/partials/item-effects.html",
    "systems/wwn/templates/items/partials/description.html",
    "systems/wwn/templates/actors/partials/faction-assets.html",
    "systems/wwn/templates/actors/dialogs/class-assignment.html",
    "systems/wwn/templates/apps/combat-set-groups.hbs",
  ];
  return foundry.applications.handlebars.loadTemplates(templatePaths);
}
