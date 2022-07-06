export const registerSettings = function () {

  game.settings.register("wwn", "randomHP", {
    name: game.i18n.localize("WWN.Setting.RandomHP"),
    hint: game.i18n.localize("WWN.Setting.RandomHPHint"),
    default: false,
    scope: "client",
    type: Boolean,
    config: true,
    onChange: _ => window.location.reload()
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
    onChange: _ => window.location.reload()
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
      reset: "WWN.Setting.InitiativeReset",
      reroll: "WWN.Setting.InitiativeReroll",
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
    onChange: _ => window.location.reload()
  });

  game.settings.register("wwn", "showMovement", {
    name: game.i18n.localize("WWN.Setting.showMovement"),
    hint: game.i18n.localize("WWN.Setting.showMovementHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    onChange: _ => window.location.reload()
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
    default: [
      "Trade Cant",
      "Ancient Vothian",
      "Old Vothian",
      "Modern Vothian",
      "Ancient Olok",
      "Brass Speech",
      "Ancient Lin",
      "Emedian",
      "Ancient Osrin",
      "Thurian",
      "Ancient Khalan",
      "Llaigisan",
      "Anak Speech",
      "Predecessant",
      "Abased",
      "Recurrent",
      "Deep Speech"
    ],
    scope: "world",
    type: String,
    config: true,
    onChange: _ => window.location.reload()
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
    onChange: _ => window.location.reload()
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
    onChange: _ => window.location.reload()
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
    onChange: _ => window.location.reload()
  });
};