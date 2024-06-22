export const registerSettings = function () {

  game.settings.register("wwn", "randomHP", {
    name: game.i18n.localize("WWN.Setting.RandomHP"),
    hint: game.i18n.localize("WWN.Setting.RandomHPHint"),
    default: false,
    scope: "client",
    type: Boolean,
    config: true,
    requiresReload: true
  });

  game.settings.register("wwn", "initiative", {
    name: game.i18n.localize("WWN.Setting.Initiative"),
    hint: game.i18n.localize("WWN.Setting.InitiativeHint"),
    default: "group",
    scope: "world",
    type: String,
    config: true,
    choices: {
      individual: "WWN.Setting.InitiativeIndividual",
      group: "WWN.Setting.InitiativeGroup",
    },
    requiresReload: true
  });

  game.settings.register("wwn", "rerollInitiative", {
    name: game.i18n.localize("WWN.Setting.RerollInitiative"),
    hint: game.i18n.localize("WWN.Setting.RerollInitiativeHint"),
    default: "keep",
    scope: "world",
    type: String,
    config: true,
    choices: {
      keep: "WWN.Setting.InitiativeKeep",
    }
  });

  game.settings.register("wwn", "movementRate", {
    name: game.i18n.localize("WWN.Setting.MovementRate"),
    hint: game.i18n.localize("WWN.Setting.MovementRateHint"),
    default: "movewwn",
    scope: "world",
    type: String,
    config: true,
    choices: {
      movewwn: "WWN.Setting.MoveWWN",
      movebx: "WWN.Setting.MoveBX",
    },
    requiresReload: true
  });

  game.settings.register("wwn", "showMovement", {
    name: game.i18n.localize("WWN.Setting.showMovement"),
    hint: game.i18n.localize("WWN.Setting.showMovementHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true
  });

  game.settings.register("wwn", "morale", {
    name: game.i18n.localize("WWN.Setting.Morale"),
    hint: game.i18n.localize("WWN.Setting.MoraleHint"),
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register("wwn", "hideInstinct", {
    name: game.i18n.localize("WWN.Setting.hideInstinct"),
    hint: game.i18n.localize("WWN.Setting.hideInstinctHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true
  });

  game.settings.register("wwn", "languageList", {
    name: game.i18n.localize("WWN.Languages"),
    hint: game.i18n.localize("WWN.LanguagesHint"),
    default: "Trade Cant,Ancient Vothian,Old Vothian,Modern Vothian,Ancient Olok,Brass Speech,Ancient Lin,Emedian,Ancient Osrin,Thurian,Ancient Khalan,Llaigisan,Anak Speech,Predecessant,Abased,Recurrent,Deep Speech",
    scope: "world",
    type: String,
    config: true,
  });

  game.settings.register("wwn", "xpConfig", {
    name: game.i18n.localize("WWN.Setting.xpConfig"),
    hint: game.i18n.localize("WWN.Setting.xpConfigHint"),
    default: "xpFast",
    scope: "world",
    type: String,
    config: true,
    choices: {
      xpFast: "WWN.Setting.xpFast",
      xpSlow: "WWN.Setting.xpSlow",
      xpCustom: "WWN.Setting.xpCustom"
    },
    requiresReload: true
  });

  game.settings.register("wwn", "xpCustomList", {
    name: game.i18n.localize("WWN.Setting.xpCustomList"),
    hint: game.i18n.localize("WWN.Setting.xpCustomListHint"),
    default: [
      2000,
      4000,
      8000,
      16000,
      32000,
      64000,
      120000,
      240000,
      360000,
      480000,
      600000,
      720000,
      840000
    ],
    scope: "world",
    type: String,
    config: true,
    requiresReload: true
  });

  game.settings.register("wwn", "xpPerChar", {
    name: "Per-Character XP",
    hint: "Enable manually setting XP for each character, rather than using a global value.",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true
  });

  game.settings.register("wwn", "currencyTypes", {
    name: game.i18n.localize("WWN.items.Currency"),
    hint: game.i18n.localize("WWN.items.CurrencyHint"),
    default: "currencywwn",
    scope: "world",
    type: String,
    config: true,
    choices: {
      currencywwn: "WWN.Setting.CurrencyWWN",
      currencybx: "WWN.Setting.CurrencyBX",
    },
    requiresReload: true
  });

  game.settings.register("wwn", "useGoldStandard", {
    name: "Gold Standard",
    hint: "Use a gold standard for currency, rather than a silver standard.",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });

  game.settings.register("wwn", "attributeModType", {
    name: "Attribute Modifiers",
    hint: "Whether attribute modifiers should be calculated using the WWN or B/X method.",
    default: "wwn",
    scope: "world",
    type: String,
    config: true,
    choices: {
      wwn: "WWN",
      bx: "B/X",
    },
    requiresReload: false
  });

  game.settings.register("wwn", "removeLevelSave", {
    name: "Remove Level Save Bonus",
    hint: "Remove a character's level from the calculation used to determine saves. This can be useful if you want to configure a manual value using only Base Save in Tweaks and attribute modifiers.",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });

  game.settings.register("wwn", "replaceStrainWithWounds", {
    name: "Replace Strain with Wounds",
    hint: "Removes System Strain from the sheet and replaces it with a tracker for Injuries and Wounds from the Death and Dismemberment rules published by Goblin Punch. Additionally, this enables automatic calculation of such injuries, should damage reduce a character's HP below 0.",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });

  game.settings.register("wwn", "roundWeight", {
    name: "Round Weight Up",
    hint: "Round weight up to the nearest whole number, to most closely match WWN rules. If disabled, weight is not rounded.",
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true
  });

  game.settings.register("wwn", "flatSkillCost", {
    name: "Flat Skill Cost",
    hint: "Skills cost a flat 1 point to purchase, rather than scaling with level.",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });

  game.settings.register("wwn", "noSkillLevelReq", {
    name: "No Skill Level Requirement",
    hint: "Remove the level requirement for purchasing skills.",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });

  game.settings.register("wwn", "medRange", {
    name: "Medium Range",
    hint: "Add a box for medium range to weapons.",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true

  });

  game.settings.register("wwn", "systemMigrationVersion", {
    config: false,
    scope: "world",
    type: String,
    default: ""
  });
};
