/**
 * WWN settings submenu layout: game line → concept sections → setting keys.
 * Keys must match those registered in settings.mjs.
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
  wwn: {
    name: "WWN.Setting.Menu.WWN.Name",
    label: "WWN.Setting.Menu.WWN.Label",
    hint: "WWN.Setting.Menu.WWN.Hint",
    icon: "fa-solid fa-castle",
    restricted: true,
    sections: [
      {
        legend: "WWN.Setting.Section.Combat",
        settings: ["initiative", "collapseSidesInGroupInitiative", "rerollInitiative", "randomHP", "morale"],
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
        legend: "WWN.Setting.Section.HouseRules",
        settings: ["attributeModType"],
      },
      {
        legend: "WWN.Setting.Section.Experience",
        settings: ["xpConfig", "xpCustomList", "xpPerChar"],
      },
      {
        legend: "WWN.Setting.Section.Movement",
        settings: ["movementRate", "showMovement"],
      },
      {
        legend: "WWN.Setting.Section.Equipment",
        settings: ["roundWeight", "defaultCurrencySet", "useFlatArmorPenalty"],
      },
      {
        legend: "WWN.Setting.Section.WorldNpc",
        settings: ["hideInstinct", "languageList"],
      },
      {
        legend: "WWN.Setting.Section.AWN",
        hint: "WWN.Setting.Section.AWNHint",
        settings: ["useStress"],
      },
    ],
  },
  cwn: {
    name: "WWN.Setting.Menu.CWN.Name",
    label: "WWN.Setting.Menu.CWN.Label",
    hint: "WWN.Setting.Menu.CWN.Hint",
    icon: "fa-solid fa-city",
    restricted: true,
    sections: [
      {
        legend: "WWN.Setting.Section.TraumaHorror",
        settings: ["useTrauma", "useAlienation"],
      },
      {
        legend: "WWN.Setting.Section.Combat",
        settings: ["separateRangedAC", "medRange"],
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
