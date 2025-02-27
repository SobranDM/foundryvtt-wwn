export const preloadHandlebarsTemplates = async function () {
  const templatePaths = [
    //Character Sheets
    'systems/wwn/templates/actors/character-sheet.html',
    'systems/wwn/templates/actors/monster-sheet.html',
    'systems/wwn/templates/actors/faction-sheet.html',
    //Actor partials
    //Sheet tabs
    'systems/wwn/templates/actors/partials/character-header.html',
    'systems/wwn/templates/actors/partials/character-attributes-tab.html',
    'systems/wwn/templates/actors/partials/character-spells-tab.html',
    'systems/wwn/templates/actors/partials/character-inventory-tab.html',
    'systems/wwn/templates/actors/partials/actor-effects.html',
    'systems/wwn/templates/actors/partials/character-notes-tab.html',

    'systems/wwn/templates/actors/partials/monster-header.html',
    'systems/wwn/templates/actors/partials/monster-attributes-tab.html',

    'systems/wwn/templates/items/partials/item-effects.html',
    'systems/wwn/templates/items/partials/description.html',

    'systems/wwn/templates/actors/partials/faction-assets.html',

    // Combat Tab
    'systems/wwn/templates/sidebar/combat-tracker.hbs',
    'systems/wwn/templates/sidebar/combat-tracker-combatant-individual.hbs',
    'systems/wwn/templates/sidebar/combat-tracker-combatant-group.hbs',
    'systems/wwn/templates/apps/combat-set-groups.hbs',
  ];
  return loadTemplates(templatePaths);
};
