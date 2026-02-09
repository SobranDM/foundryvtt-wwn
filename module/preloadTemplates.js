const preloadHandlebarsTemplates = async function () {
  const templatePaths = [
    //Character Sheets
    'systems/wwn/templates/actors/character-sheet.html',
    'systems/wwn/templates/actors/monster-sheet.html',
    'systems/wwn/templates/actors/faction-sheet.html',
    'systems/wwn/templates/actors/ship-sheet.html', 
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

    // Ship partials
    'systems/wwn/templates/actors/partials/ship-header.html', 
    'systems/wwn/templates/actors/partials/ship-crew-list.html',
    'systems/wwn/templates/actors/partials/ship-attributes-tab.html',
    'systems/wwn/templates/actors/partials/ship-inventory-tab.html',
    'systems/wwn/templates/actors/partials/ship-notes-tab.html', 

    // Combat Tab
    'systems/wwn/templates/apps/combat-set-groups.hbs',
  ];
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};

export default preloadHandlebarsTemplates;
