import { THEMES, applyUiTheme } from "./config/themes.mjs";
import { defineWwnSettingsMenu } from "./applications/wwn-settings-menu.mjs";
import { WWN_SETTING_MENUS } from "./settings/menu-config.mjs";

const NS = "wwn";

/**
 * Register a WWN setting. World/client settings are shown in submenus, not the flat config list.
 * @param {string} key
 * @param {object} data
 */
function registerWwnSetting(key, data) {
  if (data.config === undefined) data.config = false;
  game.settings.register(NS, key, data);
}

/**
 * Register all WWN settings. Called once during init.
 */
export function registerSettings() {
  /* ---- Theme (client) ---- */
  registerWwnSetting("uiTheme", {
    name: "WWN.Setting.UiTheme",
    hint: "WWN.Setting.UiThemeHint",
    scope: "client",
    type: String,
    default: "wwn",
    choices: Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.label])),
    onChange: (value) => {
      applyUiTheme(value);
      const scheme = THEMES[value]?.colorScheme ?? "light";
      game.settings.set("core", "uiConfig", {
        ...game.settings.get("core", "uiConfig"),
        colorScheme: { applications: scheme, interface: scheme },
      }).catch(() => {});
    },
  });

  /* ---- Combat ---- */
  registerWwnSetting("initiative", {
    name: "WWN.Setting.Initiative",
    hint: "WWN.Setting.InitiativeHint",
    scope: "world",
    type: String,
    default: "group",
    choices: {
      individual: "WWN.Setting.InitiativeIndividual",
      group: "WWN.Setting.InitiativeGroup",
    },
  });

  registerWwnSetting("collapseSidesInGroupInitiative", {
    name: "WWN.Setting.CollapseSidesInGroupInitiative",
    hint: "WWN.Setting.CollapseSidesInGroupInitiativeHint",
    scope: "world",
    type: Boolean,
    default: true,
  });

  registerWwnSetting("rerollInitiative", {
    name: "WWN.Setting.RerollInitiative",
    hint: "WWN.Setting.RerollInitiativeHint",
    scope: "world",
    type: String,
    default: "keep",
    choices: {
      keep: "WWN.Setting.InitiativeKeep",
      reroll: "WWN.Setting.InitiativeReroll",
      reset: "WWN.Setting.InitiativeReset",
    },
  });

  registerWwnSetting("randomHP", {
    name: "WWN.Setting.RandomHP",
    hint: "WWN.Setting.RandomHPHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("morale", {
    name: "WWN.Setting.Morale",
    hint: "WWN.Setting.MoraleHint",
    scope: "world",
    type: Boolean,
    default: true,
  });

  /* ---- Movement ---- */
  registerWwnSetting("movementRate", {
    name: "WWN.Setting.MovementRate",
    hint: "WWN.Setting.MovementRateHint",
    scope: "world",
    type: String,
    default: "movewwn",
    choices: { movewwn: "WWN.Setting.MoveWWN", movebx: "WWN.Setting.MoveBX" },
  });

  registerWwnSetting("showMovement", {
    name: "WWN.Setting.ShowMovement",
    hint: "WWN.Setting.ShowMovementHint",
    scope: "world",
    type: Boolean,
    default: true,
  });

  /* ---- Attributes / saves ---- */
  registerWwnSetting("attributeModType", {
    name: "WWN.Setting.AttributeModType",
    hint: "WWN.Setting.AttributeModTypeHint",
    scope: "world",
    type: String,
    default: "wwn",
    choices: { wwn: "WWN.Setting.AttributeModWWN", bx: "WWN.Setting.AttributeModBX" },
  });

  registerWwnSetting("saveSet", {
    name: "WWN.Setting.SaveSet",
    hint: "WWN.Setting.SaveSetHint",
    scope: "world",
    type: String,
    default: "wwn",
    choices: { wwn: "WWN.SaveSet.wwn", godbound: "WWN.SaveSet.godbound" },
    requiresReload: true,
  });

  registerWwnSetting("removeLevelSave", {
    name: "WWN.Setting.RemoveLevelSave",
    hint: "WWN.Setting.RemoveLevelSaveHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  /* ---- XP ---- */
  registerWwnSetting("xpConfig", {
    name: "WWN.Setting.XpConfig",
    hint: "WWN.Setting.XpConfigHint",
    scope: "world",
    type: String,
    default: "xpFast",
    choices: {
      xpFast: "WWN.Setting.XpFast",
      xpSlow: "WWN.Setting.XpSlow",
      xpCustom: "WWN.Setting.XpCustom",
    },
  });

  registerWwnSetting("xpCustomList", {
    name: "WWN.Setting.XpCustomList",
    hint: "WWN.Setting.XpCustomListHint",
    scope: "world",
    type: String,
    default: "2000,4000,8000,16000,32000,64000,120000,240000,360000,480000,600000,720000,840000",
  });

  registerWwnSetting("xpPerChar", {
    name: "WWN.Setting.XpPerChar",
    hint: "WWN.Setting.XpPerCharHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  /* ---- Skills ---- */
  registerWwnSetting("skillSet", {
    name: "WWN.Setting.SkillSet",
    hint: "WWN.Setting.SkillSetHint",
    scope: "world",
    type: String,
    default: "wwn",
    choices: {
      wwn: "WWN.Setting.SkillSetWWN",
      swn: "WWN.Setting.SkillSetSWN",
      awn: "WWN.Setting.SkillSetAWN",
      cwn: "WWN.Setting.SkillSetCWN",
    },
    onChange: () => {
      import("./helpers/skill-set.mjs").then(({ refreshSkillSetCache }) => refreshSkillSetCache({ notify: true }));
    },
  });

  registerWwnSetting("flatSkillCost", {
    name: "WWN.Setting.FlatSkillCost",
    hint: "WWN.Setting.FlatSkillCostHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("noSkillLevelReq", {
    name: "WWN.Setting.NoSkillLevelReq",
    hint: "WWN.Setting.NoSkillLevelReqHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("bonusSkillsGrantPointsAtFirstLevel", {
    name: "WWN.Setting.BonusSkillsGrantPointsAtFirstLevel",
    hint: "WWN.Setting.BonusSkillsGrantPointsAtFirstLevelHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  /* ---- Encumbrance / currency ---- */
  registerWwnSetting("roundWeight", {
    name: "WWN.Setting.RoundWeight",
    hint: "WWN.Setting.RoundWeightHint",
    scope: "world",
    type: Boolean,
    default: true,
  });

  registerWwnSetting("defaultCurrencySet", {
    name: "WWN.Setting.DefaultCurrencySet",
    hint: "WWN.Setting.DefaultCurrencySetHint",
    scope: "world",
    type: String,
    default: "silver",
    choices: {
      silver: "WWN.Setting.CurrencySilver",
      gold: "WWN.Setting.CurrencyGold",
      credits: "WWN.Setting.CurrencyCredits",
    },
  });

  /* ---- Game-line toggles ---- */
  registerWwnSetting("useTrauma", {
    name: "WWN.Setting.UseTrauma",
    hint: "WWN.Setting.UseTraumaHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("useFlatArmorPenalty", {
    name: "WWN.Setting.UseFlatArmorPenalty",
    hint: "WWN.Setting.UseFlatArmorPenaltyHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("separateRangedAC", {
    name: "WWN.Setting.SeparateRangedAC",
    hint: "WWN.Setting.SeparateRangedACHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("useAlienation", {
    name: "WWN.Setting.UseAlienation",
    hint: "WWN.Setting.UseAlienationHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("useStress", {
    name: "WWN.Setting.UseStress",
    hint: "WWN.Setting.UseStressHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("godboundDamage", {
    name: "WWN.Setting.GodboundDamage",
    hint: "WWN.Setting.GodboundDamageHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("medRange", {
    name: "WWN.Setting.MedRange",
    hint: "WWN.Setting.MedRangeHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  /* ---- NPC / Profile ---- */
  registerWwnSetting("hideInstinct", {
    name: "WWN.Setting.HideInstinct",
    hint: "WWN.Setting.HideInstinctHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("languageList", {
    name: "WWN.Setting.Languages",
    hint: "WWN.Setting.LanguagesHint",
    scope: "world",
    type: String,
    default:
      "Trade Cant,Ancient Vothian,Old Vothian,Modern Vothian,Ancient Olok,Brass Speech,Ancient Lin,Emedian,Ancient Osrin,Thurian,Ancient Khalan,Llaigisan,Anak Speech,Predecessant,Abased,Recurrent,Deep Speech",
  });

  registerWwnSetting("currencyTypes", {
    name: "WWN.items.Currency",
    hint: "WWN.items.CurrencyHint",
    scope: "world",
    type: String,
    default: "currencywwn",
    choices: {
      currencywwn: "WWN.Setting.CurrencyWWN",
      currencybx: "WWN.Setting.CurrencyBX",
    },
  });

  registerWwnSetting("useGoldStandard", {
    name: "WWN.Setting.UseGoldStandard",
    hint: "WWN.Setting.UseGoldStandardHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("replaceStrainWithWounds", {
    name: "WWN.Setting.ReplaceStrainWithWounds",
    hint: "WWN.Setting.ReplaceStrainWithWoundsHint",
    scope: "world",
    type: Boolean,
    default: false,
  });

  /* ---- Hidden / infrastructure ---- */
  registerWwnSetting("collapsedSections", {
    scope: "client",
    type: Object,
    default: {},
  });

  registerWwnSetting("systemMigrationVersion", {
    scope: "world",
    type: String,
    default: "",
  });

  registerWwnSetting("pcCompendiumItemSyncDone", {
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("classAbilityCleanupDone", {
    scope: "world",
    type: Boolean,
    default: false,
  });

  registerWwnSetting("classAssignmentFlagRepairDone", {
    scope: "world",
    type: Boolean,
    default: false,
  });

  /* ---- Submenus (game line → concept sections) ---- */
  for (const [key, config] of Object.entries(WWN_SETTING_MENUS)) {
    const MenuClass = defineWwnSettingsMenu(key, config);
    game.settings.registerMenu(NS, key, {
      name: config.name,
      label: config.label,
      hint: config.hint,
      icon: config.icon,
      type: MenuClass,
      restricted: config.restricted ?? true,
    });
  }
}
