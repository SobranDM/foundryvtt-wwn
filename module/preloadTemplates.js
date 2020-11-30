export const preloadHandlebarsTemplates = async function () {
    const templatePaths = [
        //Character Sheets
        'systems/wwn/templates/actors/character-html.html',
        'systems/wwn/templates/actors/monster-html.html',
        //Actor partials
        //Sheet tabs
        'systems/wwn/templates/actors/partials/character-header.html',
        'systems/wwn/templates/actors/partials/character-attributes-tab.html',
        'systems/wwn/templates/actors/partials/character-abilities-tab.html',
        'systems/wwn/templates/actors/partials/character-spells-tab.html',
        'systems/wwn/templates/actors/partials/character-inventory-tab.html',
        'systems/wwn/templates/actors/partials/character-notes-tab.html',

        'systems/wwn/templates/actors/partials/monster-header.html',
        'systems/wwn/templates/actors/partials/monster-attributes-tab.html'
    ];
    return loadTemplates(templatePaths);
};
