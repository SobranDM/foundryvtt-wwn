/**
 * Pre-load WWN Handlebars templates / partials.
 */
export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    "systems/wwn/templates/actors/dialogs/class-assignment.html",
    "systems/wwn/templates/apps/combat-set-groups.hbs",
  ];
  await foundry.applications.handlebars.loadTemplates(templatePaths);

  // AppV2 named partials (registered for `{{> partialName}}` syntax).
  return foundry.applications.handlebars.loadTemplates({
    wwnResourceBars: "systems/wwn/templates/partials/resource-bars.hbs",
    wwnCollapsibleSection: "systems/wwn/templates/partials/collapsible-section.hbs",
    wwnItemControls: "systems/wwn/templates/partials/item-controls.hbs",
    wwnEffectsList: "systems/wwn/templates/partials/effects-list.hbs",
    wwnFieldHint: "systems/wwn/templates/partials/field-hint.hbs",
    wwnRatioField: "systems/wwn/templates/partials/ratio-field.hbs",
    wwnContainerItem: "systems/wwn/templates/partials/container-item.hbs",
    wwnFactionAssetPanel: "systems/wwn/templates/partials/faction-asset-panel.hbs",
    wwnPowersTabBody: "systems/wwn/templates/partials/powers-tab-body.hbs",
  });
}
