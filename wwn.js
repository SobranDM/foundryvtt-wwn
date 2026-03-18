// Import Modules
import { WwnItemSheetV2 } from "./module/item/item-sheet-v2.js";
import {
  WwnActorSheetCharacterV2,
  WwnActorSheetMonsterV2,
  WwnActorSheetFactionV2,
  WwnActorSheetShipV2,
  WwnActorSheetVehicleV2,
} from "./module/applications/sheets.js";
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

  // Sheet registration uses Foundry's collection classes and core sheet (same as draw-steel)
  const { Actors, Items } = foundry.documents.collections;
  const { ItemSheet } = foundry.applications.sheets;

  // Register sheet application classes (draw-steel style: do not unregister core ActorSheet; register per-type with makeDefault)
  Actors.registerSheet("wwn", WwnActorSheetCharacterV2, {
    types: ["character"],
    makeDefault: true,
    label: "WWN.SheetClassCharacter"
  });
  Actors.registerSheet("wwn", WwnActorSheetMonsterV2, {
    types: ["monster"],
    makeDefault: true,
    label: "WWN.SheetClassMonster"
  });
  Actors.registerSheet("wwn", WwnActorSheetFactionV2, {
    types: ["faction"],
    makeDefault: true,
    label: "WWN.SheetClassFaction"
  });
  Actors.registerSheet("wwn", WwnActorSheetShipV2, {
    types: ["ship"],
    makeDefault: true,
    label: "WWN.SheetClassShip"
  });
  Actors.registerSheet("wwn", WwnActorSheetVehicleV2, {
    types: ["vehicle"],
    makeDefault: true,
    label: "WWN.SheetClassVehicle"
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("wwn", WwnItemSheetV2, {
    makeDefault: true,
    label: "WWN.SheetClassItem"
  });

  // Register TypeDataModels for all actor and item types (v13 modern data model)
  if (typeof globalThis.foundry?.abstract?.TypeDataModel !== "undefined") {
    try {
      if (!CONFIG.Actor.dataModels) CONFIG.Actor.dataModels = {};
      const actorModels = [
        ["character", "./module/data/actor/character.mjs", "WwnCharacterDataModel"],
        ["monster", "./module/data/actor/monster.mjs", "WwnMonsterDataModel"],
        ["faction", "./module/data/actor/faction.mjs", "WwnFactionDataModel"],
        ["ship", "./module/data/actor/ship.mjs", "WwnShipDataModel"],
        ["vehicle", "./module/data/actor/vehicle.mjs", "WwnVehicleDataModel"],
      ];
      for (const [type, path, name] of actorModels) {
        const mod = await import(path);
        if (mod[name]) CONFIG.Actor.dataModels[type] = mod[name];
      }
      if (!CONFIG.Item.dataModels) CONFIG.Item.dataModels = {};
      const itemModels = [
        ["item", "./module/data/item/item.mjs", "WwnItemDataModel"],
        ["weapon", "./module/data/item/weapon.mjs", "WwnWeaponDataModel"],
        ["armor", "./module/data/item/armor.mjs", "WwnArmorDataModel"],
        ["spell", "./module/data/item/spell.mjs", "WwnSpellDataModel"],
        ["art", "./module/data/item/art.mjs", "WwnArtDataModel"],
        ["focus", "./module/data/item/focus.mjs", "WwnFocusDataModel"],
        ["skill", "./module/data/item/skill.mjs", "WwnSkillDataModel"],
        ["ability", "./module/data/item/ability.mjs", "WwnAbilityDataModel"],
        ["asset", "./module/data/item/asset.mjs", "WwnAssetDataModel"],
        ["crewmember", "./module/data/item/crewmember.mjs", "WwnCrewmemberDataModel"],
        ["fitting", "./module/data/item/fitting.mjs", "WwnFittingDataModel"],
        ["shipweapon", "./module/data/item/shipweapon.mjs", "WwnShipweaponDataModel"],
        ["cargo", "./module/data/item/cargo.mjs", "WwnCargoDataModel"],
      ];
      for (const [type, path, name] of itemModels) {
        const mod = await import(path);
        if (mod[name]) CONFIG.Item.dataModels[type] = mod[name];
      }
    } catch (_) {
      // Skip if modules not available (e.g. Node test env)
    }
  }

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
    const el = html instanceof jQuery ? html[0] : html;
    const gamesystem = el?.querySelector?.("#game-details");
    if (!gamesystem) return;
    const h4s = gamesystem.querySelectorAll("h4");
    const wwn = h4s.length ? h4s[h4s.length - 1] : null;
    if (wwn) wwn.insertAdjacentHTML("beforeend", " <sub><a href=\"https://oldschoolessentials.necroticgnome.com/srd/index.php\">SRD</a></sub>");
    const template = "systems/wwn/templates/chat/license.hbs";
    const rendered = await renderTemplate(template);
    const systemEl = gamesystem.querySelector(".system");
    if (systemEl && rendered) systemEl.insertAdjacentHTML("beforeend", rendered);
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
