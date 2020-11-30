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

  game.settings.register("wwn", "ascendingAC", {
    name: game.i18n.localize("WWN.Setting.AscendingAC"),
    hint: game.i18n.localize("WWN.Setting.AscendingACHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    onChange: _ => window.location.reload()
  });

  game.settings.register("wwn", "morale", {
    name: game.i18n.localize("WWN.Setting.Morale"),
    hint: game.i18n.localize("WWN.Setting.MoraleHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register("wwn", "encumbranceOption", {
    name: game.i18n.localize("WWN.Setting.Encumbrance"),
    hint: game.i18n.localize("WWN.Setting.EncumbranceHint"),
    default: "detailed",
    scope: "world",
    type: String,
    config: true,
    choices: {
      disabled: "WWN.Setting.EncumbranceDisabled",
      basic: "WWN.Setting.EncumbranceBasic",
      detailed: "WWN.Setting.EncumbranceDetailed",
      complete: "WWN.Setting.EncumbranceComplete",
    },
    onChange: _ => window.location.reload()
  });

  game.settings.register("wwn", "significantTreasure", {
    name: game.i18n.localize("WWN.Setting.SignificantTreasure"),
    hint: game.i18n.localize("WWN.Setting.SignificantTreasureHint"),
    default: 800,
    scope: "world",
    type: Number,
    config: true,
    onChange: _ => window.location.reload()
  });
};
