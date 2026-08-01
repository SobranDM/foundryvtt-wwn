/**
 * WWN settings submenu layout: menu → concept sections → setting keys.
 * Keys must match those registered in settings.mjs.
 *
 * Section `settings` entries are either a string key or `{ key, tags }` where
 * `tags` is a list of game-line ids (e.g. `"cwn"`, `"awn"`) shown as chips.
 */
export const WWN_SETTING_MENUS = {
  appearance: {
    name: "WWN.Setting.Menu.Appearance.Name",
    label: "WWN.Setting.Menu.Appearance.Label",
    hint: "WWN.Setting.Menu.Appearance.Hint",
    icon: "fa-solid fa-palette",
    restricted: false,
    sections: [
      {
        legend: "WWN.Setting.Section.Interface",
        settings: ["uiTheme"],
      },
    ],
  },
  core: {
    name: "WWN.Setting.Menu.CoreRules.Name",
    label: "WWN.Setting.Menu.CoreRules.Label",
    hint: "WWN.Setting.Menu.CoreRules.Hint",
    icon: "fa-solid fa-book",
    restricted: true,
    sections: [
      {
        legend: "WWN.Setting.Section.Combat",
        settings: [
          "initiative",
          "collapseSidesInGroupInitiative",
          "rerollInitiative",
          "randomHP",
          "morale",
          { key: "separateRangedAC", tags: ["cwn"] },
          { key: "useTrauma", tags: ["cwn", "awn"] },
        ],
      },
      {
        legend: "WWN.Setting.Section.ResourceTrackers",
        settings: [
          { key: "useAlienation", tags: ["cwn"] },
          { key: "useStress", tags: ["awn"] },
        ],
      },
      {
        legend: "WWN.Setting.Section.AttributesSaves",
        settings: ["saveSet", "removeLevelSave"],
      },
      {
        legend: "WWN.Setting.Section.Skills",
        settings: ["skillSet", "bonusSkillsGrantPointsAtFirstLevel", "flatSkillCost", "noSkillLevelReq"],
      },
      {
        legend: "WWN.Setting.Section.Experience",
        settings: ["xpConfig", "xpCustomList", "xpPerChar"],
      },
      {
        legend: "WWN.Setting.Section.Movement",
        settings: ["showMovement"],
      },
      {
        legend: "WWN.Setting.Section.Equipment",
        settings: [
          "roundWeight",
          "defaultCurrencySet",
          { key: "useFlatArmorPenalty", tags: ["cwn"] },
        ],
      },
      {
        legend: "WWN.Setting.Section.WorldNpc",
        settings: ["hideInstinct", "languageList"],
      },
    ],
  },
  houseRules: {
    name: "WWN.Setting.Menu.HouseRules.Name",
    label: "WWN.Setting.Menu.HouseRules.Label",
    hint: "WWN.Setting.Menu.HouseRules.Hint",
    icon: "fa-solid fa-screwdriver-wrench",
    restricted: true,
    sections: [
      {
        legend: "WWN.Setting.Section.AttributesSaves",
        settings: ["attributeModType"],
      },
      {
        legend: "WWN.Setting.Section.Movement",
        settings: ["movementRate"],
      },
      {
        legend: "WWN.Setting.Section.Combat",
        settings: ["medRange"],
      },
      {
        legend: "WWN.Setting.Section.Equipment",
        settings: ["currencyTypes", "useGoldStandard"],
      },
      {
        legend: "WWN.Setting.Section.Character",
        settings: ["replaceStrainWithWounds", "showAlignment"],
      },
    ],
  },
  godbound: {
    name: "WWN.Setting.Menu.Godbound.Name",
    label: "WWN.Setting.Menu.Godbound.Label",
    hint: "WWN.Setting.Menu.Godbound.Hint",
    icon: "fa-solid fa-sun",
    restricted: true,
    sections: [
      {
        legend: "WWN.Setting.Section.Damage",
        settings: ["godboundDamage"],
      },
      {
        legend: "WWN.Setting.Section.AttributesSaves",
        hint: "WWN.Setting.Section.GodboundSavesHint",
        settings: [],
      },
    ],
  },
};
