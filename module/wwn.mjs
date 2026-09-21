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
import { canAddActorTypeToCombat } from "./combat/encounter-kind.mjs";
import { validateGroupInitiativeRollRequest } from "./combat/group-initiative-socket.mjs";
import { ChatListener } from "./chat/chat-listener.mjs";
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { checkMigration, migrateWorld } from "./migration/migrate.mjs";
import { refreshPowers } from "./helpers/power-refresh.mjs";
import { syncPowerTransferEffects } from "./helpers/power-effects.mjs";
import { syncActorFocusEffects, syncFocusTransferEffects } from "./helpers/focus-effects.mjs";
import { refreshActorDerivedData } from "./helpers/actor-refresh.mjs";
import { buildCarrierClearUpdate } from "./helpers/party-treasury.mjs";
import { syncFocusBonusSkills, syncActorFocusBonusSkills } from "./helpers/focus-bonus-skills.mjs";
import { syncPowerBonusSkills, syncActorPowerBonusSkills } from "./helpers/power-bonus-skills.mjs";
import { clearGrantedSkillsForDeletedTarget } from "./helpers/bonus-skills-shared.mjs";
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

import { WwnItemSheet } from "./sheets/item/item-sheet.mjs";
import { WwnPcSheet } from "./sheets/actor/pc-sheet.mjs";
import { WwnNpcSheet } from "./sheets/actor/npc-sheet.mjs";
import { WwnFactionSheet } from "./sheets/actor/faction-sheet.mjs";
import { WwnStarshipSheet } from "./sheets/actor/starship-sheet.mjs";
import { WwnPowerArmorSheet } from "./sheets/actor/power-armor-sheet.mjs";
import { WwnProjectSheet } from "./sheets/actor/project-sheet.mjs";
import { WwnPartySheet } from "./sheets/actor/party-sheet.mjs";
import { applyUiTheme, sheetThemeChoices, themeChatMessage } from "./config/themes.mjs";
import { checkGodboundAutoLapse, AUTO_LAPSE_UPDATE_FLAG } from "./helpers/project-lapse.mjs";
import { safeFromUuidSync } from "./helpers/safe-resolve.mjs";

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
    project: models.WwnProject,
    party: models.WwnParty,
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
    project: "TYPES.Actor.project",
    party: "TYPES.Actor.party",
    pc: "TYPES.Actor.pc",
    npc: "TYPES.Actor.npc",
  };
  Object.assign(CONFIG.Item.dataModels, {
    item: models.WwnGear,
    ammo: models.WwnAmmo,
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
    contribution: models.WwnContribution,
    // Legacy item types — load aliases during migration.
    art: models.WwnPower,
    spell: models.WwnPower,
    ability: models.WwnPower,
  });
  Object.assign(CONFIG.Item.typeLabels, {
    ammo: "TYPES.Item.ammo",
    shipFitting: "TYPES.Item.shipFitting",
    shipWeapon: "TYPES.Item.shipWeapon",
    shipDefense: "TYPES.Item.shipDefense",
    armorFitting: "TYPES.Item.armorFitting",
    contribution: "TYPES.Item.contribution",
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
  DocumentSheetConfig.registerSheet(Actor, "wwn", WwnProjectSheet, {
    types: ["project"],
    makeDefault: true,
    label: "WWN.SheetClassProject",
    themes,
  });
  DocumentSheetConfig.registerSheet(Actor, "wwn", WwnPartySheet, {
    types: ["party"],
    makeDefault: true,
    label: "WWN.SheetClassParty",
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
    if (item.parent.type === "party") refreshPartyRosterMembers(item.parent);
    if (item.effects.size) refreshActorDerivedData(item.parent);
  });
  Hooks.on("updateItem", async (item, changes, _options, userId) => {
    if (item.parent?.documentName !== "Actor") return;
    if (game.wwn?.migrating || _options?.wwnMigrating) return;
    if (item.parent.type === "party") refreshPartyRosterMembers(item.parent);
    if (item.type === "power") {
      syncPowerTransferEffects(item);
      const flat = foundry.utils.flattenObject(changes);
      // wwnBonusSkillSync: syncPowerBonusSkills's own bonusSkillsChosen write
      // (after a prompt resolves) fires this same hook — skip re-entering it
      // for that write, or the grant loop it's already mid-way through would
      // race a second copy of itself. See the note on that write's call site.
      if (
        isPc(item.parent)
        && userId === game.user.id
        && !_options?.wwnBonusSkillSync
        && ["system.bonusSkillsChosen", "system.bonusSkills", "system.bonusSkillsPick", "system.bonusSkillsMode"].some((k) => k in flat)
      ) {
        // allowRedirectPrompt: don't re-ask the top-level choice, but a
        // newly-blocked grant (e.g. a level-gated bonus just unlocked) still
        // deserves a chance to redirect -- nothing else ever re-syncs this
        // item/skill pair with a prompt allowed otherwise.
        await syncPowerBonusSkills(item, item.parent, { prompt: false, allowRedirectPrompt: true });
      }
    }
    if (item.type === "classEdge") {
      const flat = foundry.utils.flattenObject(changes);
      if (
        isPc(item.parent)
        && userId === game.user.id
        && !_options?.wwnBonusSkillSync
        && ["system.bonusSkillsChosen", "system.bonusSkills", "system.bonusSkillsPick", "system.bonusSkillsMode"].some((k) => k in flat)
      ) {
        await syncPowerBonusSkills(item, item.parent, { prompt: false, allowRedirectPrompt: true });
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
      if (
        isPc(item.parent)
        && userId === game.user.id
        && ["system.ownedLevel", "system.bonusSkillsChosen"].some((k) => k in flat)
      ) {
        // wwnBonusSkillSync: see the note above the power branch — same
        // re-entrancy risk from syncFocusBonusSkills's own bonusSkillsChosen
        // write.
        if (!_options?.wwnBonusSkillSync) {
          await syncFocusBonusSkills(item, item.parent, { prompt: false, allowRedirectPrompt: true });
        }
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
    if (item.type === "contribution" && userId === game.user.id) {
      await checkGodboundAutoLapse(item.parent);
    }
    if (item.effects.size) refreshActorDerivedData(item.parent);
  });
  Hooks.on("deleteItem", async (item, _options, userId) => {
    if (item.parent?.documentName !== "Actor") return;
    if (game.wwn?.migrating || _options?.wwnMigrating) return;
    // Deleting a focus/power/classEdge does not claw back the skill points
    // or ranks it granted — that bonus is treated as a permanent, sunk
    // grant. Reversing it would require per-source delta bookkeeping on the
    // skill, which is exactly the shared-slot design that caused foci
    // targeting the same skill to perpetually re-grant on every login.
    if (item.type === "contribution" && userId === game.user.id) {
      await checkGodboundAutoLapse(item.parent, { excludeItemId: item.id });
    }
    if (item.type === "skill" && isPc(item.parent) && userId === game.user.id) {
      // Unlike a deleted focus/power/classEdge (whose sunk grant stays on the
      // skill it already reached), a deleted SKILL takes its granted bonus
      // with it -- clear any granting item's stale "already granted" record
      // that pointed here so a later sync can retry instead of the bonus
      // being lost for good (see clearGrantedSkillsForDeletedTarget).
      await clearGrantedSkillsForDeletedTarget(item.parent, item.id);
      await syncActorFocusBonusSkills(item.parent);
      await syncActorPowerBonusSkills(item.parent);
    }
    if (item.parent.type === "party") {
      refreshPartyRosterMembers(item.parent);
      // Drop the now-meaningless assignment entry rather than leaving a
      // stale item-id key in the map forever. Gated like every other write
      // in this hook so only the acting client performs it, not every
      // connected client watching the same delete.
      if (userId === game.user.id && item.parent.system.carrierAssignments?.[item.id] !== undefined) {
        await item.parent.update({ [`system.carrierAssignments.-=${item.id}`]: null });
      }
    }
    if (item.effects.size) refreshActorDerivedData(item.parent);
  });
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (actor.type !== "party") return;
    if (foundry.utils.hasProperty(changes, "system.members")) {
      // Stash the pre-update roster: by the time the post-update "updateActor"
      // hook fires, actor._source already reflects the NEW value, so reading
      // it there for a before/after diff would silently no-op (before ===
      // after) and a removed member would never get refreshed.
      options.wwnPriorPartyMembers = [...(actor.system.members ?? [])];
    }
  });
  Hooks.on("updateActor", (actor, changes, options) => {
    if (game.wwn?.migrating || options?.wwnMigrating) return;
    if (actor.type === "party") {
      const flat = foundry.utils.flattenObject(changes);
      const membersChanged = "system.members" in flat;
      const assignmentsChanged = Object.keys(flat).some((k) => k.startsWith("system.carrierAssignments"));
      if (membersChanged || assignmentsChanged) {
        // A carrier reassignment only ever touches current roster members
        // (the dropdown only offers those), so refreshing the current
        // roster covers it. A membership change additionally needs the
        // pre-update roster too, to catch a member who just dropped off it.
        const uuids = new Set(actor.system.members ?? []);
        if (membersChanged) {
          for (const uuid of options.wwnPriorPartyMembers ?? []) uuids.add(uuid);
        }
        for (const uuid of uuids) refreshActorDerivedData(safeFromUuidSync(uuid));
      }
      return;
    }
    // Any open WwnPartySheet whose roster includes this actor (e.g. its HP
    // just changed) needs its own re-render -- Foundry's own auto-render
    // only covers `actor`'s own sheet, not a different party's roster view.
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof WwnPartySheet && app.actor.system.members?.includes(actor.uuid)) {
        app.render(false);
      }
    }
  });
  Hooks.on("deleteActor", async (actor, _options, userId) => {
    if (game.wwn?.migrating) return;
    if (actor.type === "party") {
      for (const uuid of actor.system.members ?? []) {
        refreshActorDerivedData(safeFromUuidSync(uuid));
      }
      return;
    }
    // A deleted PC/NPC might still be listed as a party member or as the
    // carrier of party-pool items -- clean up those dangling references
    // rather than leaving carrierAssignments pointed at a UUID that can
    // never resolve again. Only the acting client performs the write, like
    // every other write-triggering hook in this file.
    if (userId !== game.user.id) return;
    for (const party of game.actors.filter((a) => a.type === "party")) {
      const wasMember = party.system.members?.includes(actor.uuid);
      const update = buildCarrierClearUpdate(party.system.carrierAssignments, actor.uuid);
      if (wasMember) update["system.members"] = party.system.members.filter((u) => u !== actor.uuid);
      if (Object.keys(update).length) await party.update(update);
    }
  });
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (actor.type !== "project") return;
    if (game.wwn?.migrating || options?.wwnMigrating) return;
    // Skip the write checkGodboundAutoLapse itself just made — its own
    // `Actor#update` fires this same hook, and without this guard the
    // recheck would call back into checkGodboundAutoLapse indefinitely
    // instead of the one bounded extra pass its status check alone allows.
    if (options?.[AUTO_LAPSE_UPDATE_FLAG]) return;
    if (userId !== game.user.id) return;
    // Direct edits to the project itself (GM raises resource.max once the
    // true cost is known, or flips status straight to inProgress on an
    // already-underfunded project) can drop it below cost the same way a
    // contribution edit can — the updateItem/deleteItem hooks above only see
    // contribution-side changes, so this covers the actor-side ones.
    const flat = foundry.utils.flattenObject(changes);
    const relevant = ["system.resource.max", "system.status", "system.gameLine"].some((k) => k in flat);
    if (!relevant) return;
    await checkGodboundAutoLapse(actor);
  });
  // NOTE: these three only cover *item-owned transfer* effects (`effect.parent`
  // is an Item embedded in an Actor, `effect.transfer` true). Non-transfer
  // effects a power applies directly to an actor (scene/day self-cast, or a
  // chat-card "apply to targets" button — see `applyPowerEffectsToActor` /
  // `expireScopedPowerEffects` in power-effects.mjs) have `effect.parent` be
  // the Actor itself and `transfer: false`, so they never satisfy either
  // condition here; those call sites refresh derived data themselves instead.
  // This fan-out (7 call sites total across create/update/delete-Item and
  // create/update/delete-ActiveEffect) could in principle be consolidated
  // onto WwnActor's own `_onCreateDescendantDocuments` / (a new)
  // `_onUpdateDescendantDocuments` / `_onDeleteDescendantDocuments`
  // overrides (it already has the first and third, for unrelated NPC
  // favorites bookkeeping) — left as a follow-up, since doing it well means
  // carefully re-threading the focus/classEdge/contribution/bonus-skills
  // logic below too, not just the effects-refresh piece.
  Hooks.on("createActiveEffect", (effect) => {
    if (game.wwn?.migrating) return;
    const item = effect.parent;
    if (item?.type === "focus" && item.parent?.documentName === "Actor") syncFocusTransferEffects(item);
    if (effect.transfer && item?.parent?.documentName === "Actor") refreshActorDerivedData(item.parent);
  });
  Hooks.on("updateActiveEffect", (effect) => {
    if (game.wwn?.migrating) return;
    const item = effect.parent;
    if (item?.type === "focus" && item.parent?.documentName === "Actor") syncFocusTransferEffects(item);
    if (effect.transfer && item?.parent?.documentName === "Actor") refreshActorDerivedData(item.parent);
  });
  Hooks.on("deleteActiveEffect", (effect) => {
    if (game.wwn?.migrating) return;
    const item = effect.parent;
    if (effect.transfer && item?.parent?.documentName === "Actor") refreshActorDerivedData(item.parent);
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
    "weightlessOptions",
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
  // Alias after localize so both names share the schema-correct choices.
  if (CONFIG.WWN.weightlessOptions) {
    CONFIG.WWN.weightless = CONFIG.WWN.weightlessOptions;
  }
});

// Dev-only Quench integration tests (wwn-system-tests/ at the repo root).
// Registering this listener costs nothing when Quench isn't active — the
// event simply never fires, and the dynamic import below is only attempted
// once it does. wwn-system-tests/ is deliberately excluded from the release
// zip (.github/workflows/release.yml's zip step is a path whitelist that
// never names it), so a normal end-user install never has these files on
// disk; the try/catch keeps that expected 404 from surfacing as an error in
// the rare case Quench is active in someone else's non-dev world.
Hooks.once("quenchReady", async (quench) => {
  try {
    const { registerAllBatches } = await import("../wwn-system-tests/module/wwn-tests.mjs");
    registerAllBatches(quench);
  } catch (err) {
    console.warn("WWN | Quench dev-test batches unavailable (expected on a normal release install):", err);
  }
});

Hooks.once("ready", async function () {
  applyUiTheme(game.settings.get("wwn", "uiTheme"));

  const { refreshSkillSetCache } = await import("./helpers/skill-set.mjs");
  await refreshSkillSetCache({ notify: false });

  Hooks.on("hotbarDrop", (bar, data, slot) => {
    return macros.createWwnMacro(data, slot);
  });

  await checkMigration();

  const { onActorZeroHpAutoStabilize } = await import("./helpers/auto-stabilize.mjs");
  Hooks.on("wwn.actorZeroHp", (actor, ctx) => {
    void onActorZeroHpAutoStabilize(actor, ctx);
  });

  // Focus/power/classEdge bonus-skill grants are applied once, at
  // item-create or relevant-update time (see the createItem/updateItem
  // hooks below) — never re-synced here. A login-time resync used to walk
  // every actor and re-apply any grant whose "already granted" flag
  // mismatched; when two items on the same actor grant a bonus to the same
  // skill, each one's grant overwrites the other's flag, so the mismatch
  // never resolves and every login re-applied both grants again, forever.
  // syncActorFocusEffects below is gated the same way, for the same reason:
  // it persists effect.update() writes a player's client has no permission
  // to make for actors they don't own. Owners (not just the GM) may still
  // run it for their own actors — effect.update() only writes when the
  // computed disabled state actually differs, so this can't double-apply.
  for (const actor of game.actors) {
    if (game.user.isGM || actor.isOwner) {
      await syncActorFocusEffects(actor);
    }
    // A freshly-loaded actor's transfer-effect-derived fields (e.g.
    // innateAc.min-based AC) can be stale relative to prepareDerivedData()
    // until something explicitly re-derives them — see actor-refresh.mjs.
    refreshActorDerivedData(actor);
  }

  game.socket.on("system.wwn", async (payload, userId) => {
    if (!game.user.isGM) return;
    const { action, data } = payload ?? {};
    if (action !== "updateGroupInitiative") return;

    const combat = game.combat;
    if (!combat) return;

    const sender = game.users.get(userId);
    const ownsCombatant = (combatant) => {
      if (!sender || !combatant) return false;
      if (sender.isGM) return true;
      return !!combatant.actor?.testUserPermission?.(sender, "OWNER");
    };

    const validated = validateGroupInitiativeRollRequest({
      combatId: data?.combatId,
      activeCombatId: combat.id,
      combatantId: data?.combatantId,
      combatantIds: combat.combatants.map((c) => c.id),
      canUpdateCombatant: (id) => ownsCombatant(combat.combatants.get(id)),
      getGroupMemberIds: (id) => {
        const combatant = combat.combatants.get(id);
        const group = combatant?.group;
        if (!group) return [];
        const older = [...combat.groups].find((g) => g.name === `${group.name}*`);
        const members = [...(group.members ?? [])];
        if (older?.members?.size) members.push(...older.members);
        return members.map((c) => c.id);
      },
    });
    if (!validated.ok) {
      console.warn("WWN | Rejected group initiative socket payload:", validated.reason);
      return;
    }

    const combatant = combat.combatants.get(validated.combatantId);
    const group = combatant?.group;
    if (!group) {
      console.warn("WWN | Rejected group initiative socket payload: no group");
      return;
    }
    const olderSiblingGroup = [...combat.groups].find((g) => g.name === `${group.name}*`);
    const rollData = await combat._getGroupInitiativeData(group, olderSiblingGroup);
    if (!rollData) return;

    if (rollData.combatantGroupUpdates.length) {
      await combat.updateEmbeddedDocuments("CombatantGroup", rollData.combatantGroupUpdates);
    }
    if (rollData.combatantUpdates.length) {
      await combat.updateEmbeddedDocuments("Combatant", rollData.combatantUpdates);
    }
    if (rollData.chatMessage) {
      await foundry.documents.ChatMessage.implementation.create(rollData.chatMessage);
    }
  });
});

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

Hooks.on("renderChatMessageHTML", (_message, html) => {
  themeChatMessage(_message, html);
});
Hooks.on("getChatMessageContextOptions", chat.addChatMessageContextOptions);
Hooks.on("getHeaderControlsRollTableSheet", treasure.addTreasureToggleControl);
Hooks.on("renderRollTableSheet", treasure.augmentTable);

Hooks.on("renderCombatTracker", (app, html) => {
  app.renderGroups?.(html instanceof HTMLElement ? html : html[0]);
  app.renderStarshipHud?.(html instanceof HTMLElement ? html : html[0]);
});
Hooks.on("preCreateCombatant", (combatant, data) => {
  const parentCombat = combatant.parent
    ?? game.combats.get(data.combatId)
    ?? game.combats.get(combatant._source?.combat);
  if (!parentCombat) return true;

  let actorType = combatant.actor?.type ?? null;
  if (!actorType && data.actorId) actorType = game.actors.get(data.actorId)?.type ?? null;
  if (!actorType && data.tokenId) {
    const scene = game.scenes.get(data.sceneId) ?? canvas?.scene;
    const token = scene?.tokens?.get(data.tokenId);
    actorType = token?.actor?.type
      ?? (token?.actorId ? game.actors.get(token.actorId)?.type : null);
  }
  if (!actorType) return true;

  const check = canAddActorTypeToCombat(parentCombat, actorType);
  if (check.ok) return true;

  const reasonKey = {
    starshipIntoNonStarship: "WWN.Starship.Segregation.starshipIntoNonStarship",
    factionIntoNonFaction: "WWN.Starship.Segregation.factionIntoNonFaction",
    personalIntoSpecial: "WWN.Starship.Segregation.personalIntoSpecial",
    unknown: "WWN.Starship.Segregation.unknown",
  }[check.reason] ?? "WWN.Starship.Segregation.blocked";
  ui.notifications.warn(game.i18n.localize(reasonKey));
  return false;
});
Hooks.on("createCombatant", (combatant) => {
  if (game.settings.get(game.system.id, "initiative") !== "group") return;
  if (combatant.combat?.isStarshipEncounter) return;
  combatant.assignGroup?.();
});
Hooks.on("updateCombatant", (combatant, updates) => {
  if (!foundry.utils.hasProperty(updates, "initiative")) return;
  if (game.settings.get(game.system.id, "initiative") !== "group") return;
  if (combatant.combat?.isStarshipEncounter) return;
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

/**
 * Refresh every current member of a Party actor's roster. Used on any
 * create/update/delete of one of its embedded items (gear, currency) rather
 * than tracking the specific old/new carrier UUID through the change diff --
 * rosters are small, and this trivially covers a reassignment's effect on
 * both the previous and new carrier without extra bookkeeping.
 * @param {Actor} partyActor
 */
function refreshPartyRosterMembers(partyActor) {
  for (const uuid of partyActor.system.members ?? []) {
    refreshActorDerivedData(safeFromUuidSync(uuid));
  }
}
