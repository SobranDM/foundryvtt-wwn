export const registerSettings = function () {

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
    default: "reset",
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
};
