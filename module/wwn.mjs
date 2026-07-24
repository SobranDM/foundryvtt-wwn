/**
 * Worlds Without Number — system entry point.
 */
import { WWN as WWN_CORE } from "./config/index.mjs";
import { registerSettings } from "./settings.mjs";
import * as models from "./data/_module.mjs";
import { WwnActor } from "./documents/actor.mjs";
import { WwnItem } from "./documents/item.mjs";
import { WwnActiveEffect } from "./documents/active-effect.mjs";
import { WwnTableResult } from "./documents/table-result.mjs";
import { WwnActiveEffectConfig } from "./applications/ae-config.mjs";
import { WwnDice } from "./dice/dice.mjs";
import { WwnRoll, WwnAttackRoll, WwnSkillRoll, WwnDamageRoll } from "./dice/rolls.mjs";
import { WWNCombat } from "./combat/combat.js";
import { registerRandomHpHook } from "./combat/random-hp.mjs";
import WWNCombatTracker from "./combat/combat-tracker.js";
import { WWNCombatant } from "./combat/combatant.js";
import { ChatListener } from "./chat/chat-listener.mjs";
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { checkMigration, migrateWorld } from "./migration/migrate.mjs";
import { refreshPowers } from "./helpers/power-refresh.mjs";
import { syncPowerTransferEffects } from "./helpers/power-effects.mjs";
import { syncActorFocusEffects, syncFocusTransferEffects } from "./helpers/focus-effects.mjs";
import {
  syncFocusBonusSkills,
  revokeFocusBonusSkills,
  syncActorFocusBonusSkills,
} from "./helpers/focus-bonus-skills.mjs";
import {
  syncPowerBonusSkills,
  revokePowerBonusSkills,
  syncActorPowerBonusSkills,
} from "./helpers/power-bonus-skills.mjs";
import { promptFocusSkillBonus } from "./helpers/focus-skill-dice.mjs";
import {
  promptSparkSkillPool,
  notifyPsychicFocusGrant,
  syncWildPsychicEffort,
} from "./helpers/focus-extra-prompts.mjs";
import { grantClassEdgeCompanions } from "./helpers/class-edge-grants.mjs";
import { syncClassEdgeAttributeGrant } from "./helpers/class-edge-attribute-grants.mjs";
import { isPc } from "./helpers/actor-types.mjs";
import { registerHelpers } from "./helpers.js";
import * as chat from "./chat.js";
import * as treasure from "./treasure.js";
import * as macros from "./macros.js";
import * as party from "./party.js";

import { WwnItemSheet } from "./sheets/item/item-sheet.mjs";
import { WwnPcSheet } from "./sheets/actor/pc-sheet.mjs";
import { WwnNpcSheet } from "./sheets/actor/npc-sheet.mjs";
import { WwnFactionSheet } from "./sheets/actor/faction-sheet.mjs";
import { WwnStarshipSheet } from "./sheets/actor/starship-sheet.mjs";
import { WwnPowerArmorSheet } from "./sheets/actor/power-armor-sheet.mjs";
import { applyUiTheme, sheetThemeChoices, themeChatMessage } from "./config/themes.mjs";

const { DocumentSheetConfig } = foundry.applications.apps;

Hooks.once("init", async function () {
  console.log("WWN | Initializing Worlds Without Number");

  CONFIG.WWN = WWN_CORE;

  game.wwn = {
    WwnActor,
    WwnItem,
    WwnDice,
    migrateWorld,
    refreshPowers,
    endScene,
    endDay,
    rollItemMacro: macros.rollItemMacro,
  };

  registerHelpers();
  registerSettings();

  CONFIG.Actor.documentClass = WwnActor;
  CONFIG.Item.documentClass = WwnItem;
  CONFIG.ActiveEffect.documentClass = WwnActiveEffect;
  CONFIG.TableResult.documentClass = WwnTableResult;
  CONFIG.Combat.documentClass = WWNCombat;
  CONFIG.Combatant.documentClass = WWNCombatant;
  CONFIG.ui.combat = WWNCombatTracker;

  Object.assign(CONFIG.Actor.dataModels, {
    // Canonical types (labels: PC / NPC / Faction).
    character: models.WwnPc,
    monster: models.WwnNpc,
    faction: models.WwnFaction,
    starship: models.WwnStarship,
    powerArmor: models.WwnPowerArmor,
    // Reverse aliases — load half-migrated worlds that already remapped to pc/npc.
    pc: models.WwnPc,
    npc: models.WwnNpc,
  });
  CONFIG.Actor.typeLabels = {
    character: "TYPES.Actor.character",
    monster: "TYPES.Actor.monster",
    faction: "TYPES.Actor.faction",
    starship: "TYPES.Actor.starship",
    powerArmor: "TYPES.Actor.powerArmor",
    pc: "TYPES.Actor.pc",
    npc: "TYPES.Actor.npc",
  };
  Object.assign(CONFIG.Item.dataModels, {
    item: models.WwnGear,
    weapon: models.WwnWeapon,
    armor: models.WwnArmor,
    skill: models.WwnSkill,
    power: models.WwnPower,
    classEdge: models.WwnClassEdge,
    focus: models.WwnFocus,
    currency: models.WwnCurrency,
    asset: models.WwnAsset,
    shipFitting: models.WwnShipFitting,
    shipWeapon: models.WwnShipWeapon,
    shipDefense: models.WwnShipDefense,
    armorFitting: models.WwnArmorFitting,
    // Legacy item types — load aliases during migration.
    art: models.WwnPower,
    spell: models.WwnPower,
    ability: models.WwnPower,
  });
  Object.assign(CONFIG.Item.typeLabels, {
    shipFitting: "TYPES.Item.shipFitting",
    shipWeapon: "TYPES.Item.shipWeapon",
    shipDefense: "TYPES.Item.shipDefense",
    armorFitting: "TYPES.Item.armorFitting",
  });

  CONFIG.Dice.rolls.unshift(WwnDamageRoll, WwnSkillRoll, WwnAttackRoll, WwnRoll);

  CONFIG.Combat.initiative = {
    formula: WWNCombat.FORMULA,
    decimals: 2,
  };

  const themes = sheetThemeChoices();

  DocumentSheetConfig.registerSheet(Actor, "wwn", WwnPcSheet, {
    types: ["character", "pc"],
    makeDefault: true,
    label: "WWN.SheetClassCharacter",
    themes,
  });
  DocumentSheetConfig.registerSheet(Actor, "wwn", WwnNpcSheet, {
    types: ["monster", "npc"],
    makeDefault: true,
    label: "WWN.SheetClassMonster",
    themes,
  });
  DocumentSheetConfig.registerSheet(Actor, "wwn", WwnFactionSheet, {
    types: ["faction"],
    makeDefault: true,
    label: "WWN.SheetClassFaction",
    themes,
  });
  DocumentSheetConfig.registerSheet(Actor, "wwn", WwnStarshipSheet, {
    types: ["starship"],
    makeDefault: true,
    label: "WWN.SheetClassStarship",
    themes,
  });
  DocumentSheetConfig.registerSheet(Actor, "wwn", WwnPowerArmorSheet, {
    types: ["powerArmor"],
    makeDefault: true,
    label: "WWN.SheetClassPowerArmor",
    themes,
  });
  DocumentSheetConfig.registerSheet(Item, "wwn", WwnItemSheet, {
    makeDefault: true,
    label: "WWN.SheetClassItem",
    themes,
  });
  DocumentSheetConfig.registerSheet(ActiveEffect, "wwn", WwnActiveEffectConfig, {
    makeDefault: true,
    label: "WWN.SheetLabels.Effect",
  });

  ChatListener.activate();
  registerRandomHpHook();

  Hooks.on("createItem", async (item, options, userId) => {
    if (item.parent?.documentName !== "Actor") return;
    // During migration, nested writes from these hooks (effect/skill updates,
    // companion creates) can deadlock the parent clear/recreate update.
    // Focus/power transfer sync is deferred via finalizeActorMigrationHooks.
    if (game.wwn?.migrating || options?.wwnMigrating) return;
    if (item.type === "power") {
      syncPowerTransferEffects(item);
      if (isPc(item.parent) && userId === game.user.id) {
        await syncPowerBonusSkills(item, item.parent, { prompt: true });
      }
    }
    if (item.type === "classEdge" && userId === game.user.id && !options?.wwnGranting) {
      await grantClassEdgeCompanions(item.parent, item, options);
      if (isPc(item.parent)) {
        await syncPowerBonusSkills(item, item.parent, { prompt: true });
        await syncClassEdgeAttributeGrant(item, item.parent, { prompt: true });
      }
    }
    if (item.type === "focus") {
      await syncFocusTransferEffects(item);
      if (isPc(item.parent) && userId === game.user.id) {
        await syncFocusBonusSkills(item, item.parent, { prompt: true });
        if ((Number(item.system.bonusDice) || 0) > 0 && !item.system.skillBonus?.trim()) {
          await promptFocusSkillBonus(item, item.parent);
        }
        await promptSparkSkillPool(item, item.parent);
        notifyPsychicFocusGrant(item);
        await syncWildPsychicEffort(item);
      }
    }
  });
  Hooks.on("updateItem", async (item, changes, _options, userId) => {
    if (item.parent?.documentName !== "Actor") return;
    if (game.wwn?.migrating || _options?.wwnMigrating) return;
    if (item.type === "power") {
      syncPowerTransferEffects(item);
      const flat = foundry.utils.flattenObject(changes);
      if (isPc(item.parent) && ["system.bonusSkillsChosen", "system.bonusSkills", "system.bonusSkillsPick", "system.bonusSkillsMode"].some((k) => k in flat)) {
        await syncPowerBonusSkills(item, item.parent, { prompt: false });
      }
    }
    if (item.type === "classEdge") {
      const flat = foundry.utils.flattenObject(changes);
      if (
        isPc(item.parent)
        && userId === game.user.id
        && ["system.bonusSkillsChosen", "system.bonusSkills", "system.bonusSkillsPick", "system.bonusSkillsMode"].some((k) => k in flat)
      ) {
        await syncPowerBonusSkills(item, item.parent, { prompt: false });
      }
      if (
        isPc(item.parent)
        && userId === game.user.id
        && ["system.attributeGrant.chosen", "system.attributeGrant.mode"].some((k) => k in flat)
      ) {
        await syncClassEdgeAttributeGrant(item, item.parent, { prompt: false });
      }
    }
    if (item.type === "focus") {
      await syncFocusTransferEffects(item);
      const flat = foundry.utils.flattenObject(changes);
      if (isPc(item.parent) && ["system.ownedLevel", "system.bonusSkillsChosen"].some((k) => k in flat)) {
        await syncFocusBonusSkills(item, item.parent, { prompt: false });
        await syncWildPsychicEffort(item);
      }
      if (
        isPc(item.parent)
        && userId === game.user.id
        && ["system.bonusDice", "system.skillBonus"].some((k) => k in flat)
        && (Number(item.system.bonusDice) || 0) > 0
        && !item.system.skillBonus?.trim()
      ) {
        await promptFocusSkillBonus(item, item.parent);
      }
    }
  });
  Hooks.on("deleteItem", async (item, _options, userId) => {
    if (item.parent?.documentName !== "Actor") return;
    if (game.wwn?.migrating || _options?.wwnMigrating) return;
    if (item.type === "focus" && isPc(item.parent) && userId === game.user.id) {
      await revokeFocusBonusSkills(item, item.parent);
    }
    if (item.type === "power" && isPc(item.parent) && userId === game.user.id) {
      await revokePowerBonusSkills(item, item.parent);
    }
    if (item.type === "classEdge" && isPc(item.parent) && userId === game.user.id) {
      await revokePowerBonusSkills(item, item.parent);
    }
  });
  Hooks.on("createActiveEffect", (effect) => {
    if (game.wwn?.migrating) return;
    const item = effect.parent;
    if (item?.type === "focus" && item.parent?.documentName === "Actor") syncFocusTransferEffects(item);
  });
  Hooks.on("updateActiveEffect", (effect) => {
    if (game.wwn?.migrating) return;
    const item = effect.parent;
    if (item?.type === "focus" && item.parent?.documentName === "Actor") syncFocusTransferEffects(item);
  });

  await preloadHandlebarsTemplates();
});

Handlebars.registerHelper("toLowerCase", (str) => String(str).toLowerCase());
Handlebars.registerHelper("join", (arr, sep) => {
  if (!Array.isArray(arr)) return "";
  return arr.join(typeof sep === "string" ? sep : ", ");
});
Handlebars.registerHelper("wwnSigned", (value) => {
  const n = Number(value) || 0;
  return n >= 0 ? `+${n}` : `${n}`;
});

Hooks.once("setup", function () {
  const toLocalize = [
    "saves",
    "abilityAbbreviations",
    "armor",
    "weightless",
    "colors",
    "tags",
    "skills",
    "encumbLocation",
    "assetTypes",
    "assetMagic",
  ];
  for (const o of toLocalize) {
    if (!CONFIG.WWN[o]) continue;
    CONFIG.WWN[o] = Object.entries(CONFIG.WWN[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }
  // Keep scores in sync after localization (same keys as ability abbreviations).
  if (CONFIG.WWN.abilityAbbreviations) {
    CONFIG.WWN.scores = { ...CONFIG.WWN.abilityAbbreviations };
  }
});

Hooks.once("ready", async function () {
  applyUiTheme(game.settings.get("wwn", "uiTheme"));

  const { refreshSkillSetCache } = await import("./helpers/skill-set.mjs");
  await refreshSkillSetCache({ notify: false });

  Hooks.on("hotbarDrop", (bar, data, slot) => {
    macros.createWwnMacro(data, slot);
    return false;
  });

  await checkMigration();

  const { onActorZeroHpAutoStabilize } = await import("./helpers/auto-stabilize.mjs");
  Hooks.on("wwn.actorZeroHp", (actor, ctx) => {
    void onActorZeroHpAutoStabilize(actor, ctx);
  });

  for (const actor of game.actors) {
    await syncActorFocusEffects(actor);
    if (isPc(actor)) {
      await syncActorFocusBonusSkills(actor);
      await syncActorPowerBonusSkills(actor);
    }
  }

  game.socket.on("system.wwn", async ({ action, data }) => {
    if (!game.user.isGM) return;
    if (action === "updateGroupInitiative") {
      const { combatantGroupUpdates, combatantUpdates } = data;
      await game.combat.updateEmbeddedDocuments("CombatantGroup", combatantGroupUpdates);
      await game.combat.updateEmbeddedDocuments("Combatant", combatantUpdates);
    }
  });
});

Hooks.on("renderActorDirectory", (app, html) => party.addControl(app, html));
Hooks.on("renderSettings", async (app, html) => {
  const systemInfo = html.querySelector(".info .system");
  if (!systemInfo) return;
  const srdLink = document.createElement("a");
  srdLink.href = "https://www.drivethrurpg.com/en/product/473939/worlds-without-number-system-reference-document";
  srdLink.target = "_blank";
  srdLink.rel = "nofollow noopener";
  srdLink.textContent = "SRD";
  systemInfo.querySelector(".label")?.append(" ", srdLink);
  const rendered = await foundry.applications.handlebars.renderTemplate("systems/wwn/templates/chat/license.html");
  html.querySelector(".info")?.insertAdjacentHTML("afterend", rendered);
});

Hooks.on("renderChatLog", (_app, html) => WwnItem.chatListeners?.(html));
Hooks.on("renderChatMessageHTML", (_message, html) => {
  themeChatMessage(_message, html);
  WwnItem.chatListeners?.(html);
});
Hooks.on("getChatMessageContextOptions", chat.addChatMessageContextOptions);
Hooks.on("getHeaderControlsRollTableSheet", treasure.addTreasureToggleControl);
Hooks.on("renderRollTableSheet", treasure.augmentTable);
Hooks.on("updateActor", party.update);

Hooks.on("renderCombatTracker", (app, html) =>
  app.renderGroups?.(html instanceof HTMLElement ? html : html[0])
);
Hooks.on("createCombatant", (combatant) => {
  if (game.settings.get(game.system.id, "initiative") !== "group") return;
  combatant.assignGroup?.();
});
Hooks.on("updateCombatant", (combatant, updates) => {
  if (!foundry.utils.hasProperty(updates, "initiative")) return;
  if (game.settings.get(game.system.id, "initiative") !== "group") return;
  combatant.updateGroup?.();
});
Hooks.on("updateCombatantGroup", async (_c, updates) => {
  if (!foundry.utils.hasProperty(updates, "initiative")) return;
  if (ui.combat) await ui.combat.render(true);
});

async function endScene() {
  for (const actor of game.actors) await refreshPowers(actor, "scene");
}

async function endDay() {
  for (const actor of game.actors) await refreshPowers(actor, "day");
}
