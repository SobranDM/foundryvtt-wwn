// Import Modules
import { WwnItemSheet } from "./module/item/item-sheet.js";
import { WwnActorSheetCharacter } from "./module/actor/character-sheet.js";
import { WwnActorSheetMonster } from "./module/actor/monster-sheet.js";
import { WwnActorSheetFaction } from "./module/actor/faction-sheet.js";
import preloadHandlebarsTemplates from "./module/preloadTemplates.js";
import { WwnActor } from "./module/actor/entity.js";
import { WwnItem } from "./module/item/entity.js";
import { WWN } from "./module/config.js";
import { registerSettings } from "./module/settings.js";
import { registerHelpers } from "./module/helpers.js";
import * as chat from "./module/chat.js";
import * as treasure from "./module/treasure.js";
import * as macros from "./module/macros.js";
import * as party from "./module/party.js";
import * as migrations from "./module/migration.js";
// Combat
import { WWNCombat } from "./module/combat/combat.js";
import WWNCombatTracker from "./module/combat/combat-tracker.js";
import { WWNCombatant } from "./module/combat/combatant.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "@initiativeRoll + @init",
    decimals: 2,
  };

  CONFIG.WWN = WWN;

  game.wwn = {
    rollItemMacro: macros.rollItemMacro,
  };

  // Custom Handlebars helpers
  registerHelpers();

  // Register custom system settings
  registerSettings();

  CONFIG.Combat.documentClass = WWNCombat;
  CONFIG.Combatant.documentClass = WWNCombatant;
  CONFIG.Combat.initiative = {
    decimals: 2,
    formula: WWNCombat.FORMULA,
  };

  CONFIG.ui.combat = WWNCombatTracker;

  CONFIG.Actor.documentClass = WwnActor;
  CONFIG.Item.documentClass = WwnItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("wwn", WwnActorSheetCharacter, {
    types: ["character"],
    makeDefault: true,
    label: "WWN.SheetClassCharacter"
  });
  Actors.registerSheet("wwn", WwnActorSheetMonster, {
    types: ["monster"],
    makeDefault: true,
    label: "WWN.SheetClassMonster"
  });
  Actors.registerSheet("wwn", WwnActorSheetFaction, {
    types: ["faction"],
    makeDefault: true,
    label: "WWN.SheetClassFaction"
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("wwn", WwnItemSheet, {
    makeDefault: true,
    label: "WWN.SheetClassItem"
  });

  await preloadHandlebarsTemplates();
});

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = ["saves", "scores", "armor", "weightless", "colors", "tags", "skills", "encumbLocation", "assetTypes", "assetMagic"];
  for (let o of toLocalize) {
    CONFIG.WWN[o] = Object.entries(CONFIG.WWN[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }
});

Hooks.once("ready", async () => {
  Hooks.on("hotbarDrop", (bar, data, slot) =>
    macros.createWwnMacro(data, slot)
  );

  // Check migration
  if (!game.user.isGM) return;
  const currentVersion = game.settings.get("wwn", "systemMigrationVersion");
  const NEEDS_MIGRATION_VERSION = "1.1.2";
  const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
  if (!currentVersion && totalDocuments === 0) return game.settings.set("wwn", "systemMigrationVersion", game.system.version);
  const needsMigration = foundry.utils.isNewerVersion(NEEDS_MIGRATION_VERSION, currentVersion);

  if (needsMigration) {
    migrations.migrateWorld();
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

// License and KOFI infos
Hooks.on("renderActorDirectory", async (app, html, data) => {
  party.addControl(app, html);
});

Hooks.on("renderSidebarTab", async (object, html) => {
  if (object instanceof Settings) {
    let gamesystem = html.find("#game-details");
    // SRD Link
    let wwn = gamesystem.find('h4').last();
    wwn.append(` <sub><a href="https://oldschoolessentials.necroticgnome.com/srd/index.php">SRD<a></sub>`);

    // License text
    const template = "systems/wwn/templates/chat/license.html";
    const rendered = await renderTemplate(template);
    gamesystem.find(".system").append(rendered);
  }
});

Hooks.on("preCreateToken", WWNCombat.preCreateToken);
Hooks.on("renderChatLog", (app, html, data) => WwnItem.chatListeners(html));
Hooks.on("renderChatMessageHTML", (app, html, data) => WwnItem.chatListeners(html));
Hooks.on("getChatMessageContextOptions", chat.addChatMessageContextOptions);
Hooks.on("renderRollTableConfig", treasure.augmentTable);
Hooks.on("updateActor", party.update);

/**
 * @param {WWNCombatTracker} app - The combat tracker application
 * @param {HTMLElement} html - The HTML element of the combat tracker
 */
Hooks.on("renderCombatTracker", (app, html) =>
  app.renderGroups(html instanceof HTMLElement ? html : html[0])
);
/** @param {WWNCombatant} combatant */
Hooks.on("createCombatant", (combatant) => {
  if (game.settings.get(game.system.id, "initiative") !== "group") return;
  combatant.assignGroup();
});
/** 
 * @param {WWNCombatant} combatant
 * @param {?Object[]} updates 
 * */
Hooks.on("updateCombatant", (combatant, updates) => {
  if (!foundry.utils.hasProperty(updates, "initiative")) return;
  if (game.settings.get(game.system.id, "initiative") !== "group") return;
  combatant.updateGroup();
});
/** 
 * @param {WWNCombatant} combatant
 * @param {?Object[]} updates 
 * */
Hooks.on("updateCombatantGroup", async (combatant, updates) => {
  if (!foundry.utils.hasProperty(updates, "initiative")) return;
  if (ui.combat) await ui.combat.render(true);
});
