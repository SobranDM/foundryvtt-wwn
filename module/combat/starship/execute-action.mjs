/**
 * Central starship combat action executor (sheet-driven).
 */
import { getStarshipAction } from "./actions.mjs";
import {
  getStarshipCombatState,
  setStarshipCombatState,
  updateStarshipCombatState,
  shipIsPcCrew,
} from "./combatant-state.mjs";
import {
  applySupportDiscount,
  spendCp,
  gainCp,
  maybeGrantSoloFighterCp,
} from "./cp.mjs";
import {
  applyEscapeCombatSuccess,
  applyPursueSuccess,
  hasEscapedAll,
} from "./escape.mjs";
import {
  bridgeActionsBlocked,
  weaponsLockedOut,
} from "./crises.mjs";
import { damageControlDifficulty, damageControlHp } from "./armor.mjs";
import {
  enginesDestroyed,
  repairDisabledShipSystem,
  repairDriveStep,
} from "./systems.mjs";
import { intoTheFire, resolveCrisisInstance, keepItTogetherCrisis } from "./crisis-flow.mjs";
import { resolveShipWeaponHit, combatantForStarship } from "./attack.mjs";
import { rollStationCheck, rollShipWeapon } from "../../helpers/starship-rolls.mjs";
import { WwnDice } from "../../dice/dice.mjs";
import { findStationSkillItem, DEFAULT_STATION_SKILL } from "../../helpers/starship-crew.mjs";
import { createNoticeMessage } from "../../chat/chat-card.mjs";
import { showWwnDialog, confirmButton, cancelButton, confirmWwnDialog } from "../../applications/wwn-dialog.mjs";

/**
 * Active starship combat containing this ship, if any.
 * @param {Actor} starship
 * @returns {Combat|null}
 */
export function findStarshipCombatForActor(starship) {
  for (const combat of game.combats ?? []) {
    if (!combat) continue;
    const c = combat.combatants.find((x) => x.actor?.id === starship.id);
    if (c && combat.encounterKind === "starship") return combat;
  }
  return null;
}

/**
 * @param {Actor} starship
 * @param {string} actionId
 * @param {object} [options]
 */
export async function executeStarshipAction(starship, actionId, options = {}) {
  const def = getStarshipAction(actionId);
  if (!def) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.UnknownAction"));
  }

  const combat = findStarshipCombatForActor(starship);
  if (!combat) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.NotInStarshipCombat"));
  }

  const combatant = combatantForStarship(combat, starship);
  if (!combatant) return;

  const isTurn = combat.combatant?.id === combatant.id;
  if (!isTurn && !game.user.isGM && !options.gmOverride) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.NotYourTurn"));
  }

  let state = getStarshipCombatState(combatant);

  if (def.exclusive && state.flags.tookExclusiveGeneralAction) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.ExclusiveAlready"));
  }
  if (state.flags.tookExclusiveGeneralAction && def.department !== "general") {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.ExclusiveBlocks"));
  }

  if (def.department === "bridge" && bridgeActionsBlocked(state.crises, enginesDestroyed(starship))) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.BridgeBlocked"));
  }

  if (starship.getFlag("wwn", "mortallyDamaged")) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.MortallyDamagedNoActions"));
  }

  // Once-per-round guards
  if (def.id === "evasiveManeuvers" && state.flags.usedEvasiveThisRound) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.OncePerRound"));
  }
  if (def.id === "sensorGhost" && state.flags.usedSensorGhostThisRound) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.OncePerRound"));
  }
  if (def.id === "supportDepartment" && state.flags.usedCaptainSupportThisRound) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.OncePerRound"));
  }
  if (def.id === "intoTheFire" && state.flags.usedIntoTheFireThisRound) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.OncePerRound"));
  }
  if (def.id === "keepItTogether" && state.flags.usedKeepItTogetherThisRound) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.OncePerRound"));
  }

  // NPC ships typically skip Captain actions
  if (!shipIsPcCrew(starship) && def.department === "captain" && def.id !== "keepItTogether") {
    // Allow Keep It Together / Into the Fire only for PC; block Support for NPC
    if (def.id === "supportDepartment" || def.id === "intoTheFire") {
      return ui.notifications.warn(game.i18n.localize("WWN.Starship.NpcNoCaptainActions"));
    }
  }

  // Target Systems catalogs as +1 CP on top of Fire One Weapon (2).
  let cost = applySupportDiscount(def.cpCost, state.flags.supportDiscountPending);
  if (def.id === "targetSystems") cost += 2;

  // Affordability only — CP / exclusive / department flags commit after preflight succeeds.
  if (cost > 0 && !spendCp(state, cost).ok) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.InsufficientCp"));
  }

  const commitAction = async () => {
    if (commitAction.done) return true;
    let next = getStarshipCombatState(combatant);
    if (cost > 0) {
      const spent = spendCp(next, cost);
      if (!spent.ok) {
        ui.notifications.warn(game.i18n.localize("WWN.Starship.InsufficientCp"));
        return false;
      }
      next = spent.state;
      if (next.flags.supportDiscountPending && def.cpCost > 0) {
        next = { ...next, flags: { ...next.flags, supportDiscountPending: false } };
      }
    }
    if (["bridge", "gunnery", "engineering", "comms", "captain"].includes(def.department)) {
      const depts = [...new Set([...(next.flags.departmentsActed ?? []), def.department])];
      next = { ...next, flags: { ...next.flags, departmentsActed: depts } };
      const linkedCount = Object.values(starship.system.stations ?? {}).filter((s) => s?.actor).length;
      const solo = shipIsPcCrew(starship) && linkedCount <= 1 && starship.system.hullClass === "fighter";
      next = maybeGrantSoloFighterCp(next, solo);
    }
    if (def.exclusive) {
      next = { ...next, flags: { ...next.flags, tookExclusiveGeneralAction: true } };
    }
    await setStarshipCombatState(combatant, next);
    commitAction.done = true;
    return true;
  };
  commitAction.done = false;

  // Dispatch — handlers call commitAction after target/weapon preflight, before rolls/dialogs.
  switch (def.id) {
    case "supportDepartment":
      if (!(await commitAction())) return;
      await updateStarshipCombatState(combatant, (s) => ({
        ...s,
        flags: { ...s.flags, usedCaptainSupportThisRound: true, supportDiscountPending: true },
      }));
      return createNoticeMessage({
        title: starship.name,
        actor: starship,
        body: game.i18n.localize("WWN.Starship.Action.supportDepartmentDone"),
      });

    case "keepItTogether":
      if (!(await commitAction())) return;
      await updateStarshipCombatState(combatant, (s) => ({
        ...s,
        flags: { ...s.flags, usedKeepItTogetherThisRound: true },
      }));
      return keepItTogetherCrisis(combatant, combat.round ?? 1);

    case "intoTheFire": {
      if (!(await commitAction())) return;
      const lead = await skillLevelForStation(starship, "captain");
      return intoTheFire(combatant, combat.round ?? 1, lead);
    }

    case "doYourDuty":
      return doYourDuty(combatant, starship, options.actName, commitAction);

    case "aboveAndBeyond":
      if (!(await commitAction())) return;
      return aboveAndBeyond(combatant, starship, options.stationKey ?? "bridge");

    case "dealWithCrisis":
      return dealWithCrisis(combatant, options.instanceId, commitAction);

    case "evasiveManeuvers":
      if (!(await commitAction())) return;
      return evasiveManeuvers(combatant, starship);

    case "sensorGhost":
      if (!(await commitAction())) return;
      return sensorGhost(combatant, starship);

    case "boostEngines":
      if (!(await commitAction())) return;
      return boostEngines(combatant, starship);

    case "damageControl":
      if (!(await commitAction())) return;
      return damageControl(combatant, starship);

    case "emergencyRepairs":
      if (!(await commitAction())) return;
      return emergencyRepairs(starship, options);

    case "crashSystems":
      return crashSystems(combat, combatant, starship, options.targetCombatantId, commitAction);

    case "defeatEcm":
      return defeatEcm(combat, combatant, starship, options.targetCombatantId, commitAction);

    case "escapeCombat":
      return escapeCombat(combat, combatant, starship, commitAction);

    case "pursueTarget":
      return pursueTarget(combat, combatant, starship, options.targetCombatantId, commitAction);

    case "fireOneWeapon":
      return fireWeapons(combat, combatant, starship, {
        all: false,
        targetSystems: !!options.targetSystems,
        weaponId: options.weaponId,
        targetCombatantId: options.targetCombatantId,
        disableItemId: options.disableItemId,
        disableDrive: !!options.disableDrive,
        commitAction,
      });

    case "fireAllGuns":
      return fireWeapons(combat, combatant, starship, {
        all: true,
        targetCombatantId: options.targetCombatantId,
        commitAction,
      });

    case "targetSystems":
      return fireWeapons(combat, combatant, starship, {
        all: false,
        targetSystems: true,
        weaponId: options.weaponId,
        targetCombatantId: options.targetCombatantId,
        disableItemId: options.disableItemId,
        disableDrive: !!options.disableDrive,
        commitAction,
      });

    default:
      return ui.notifications.warn(game.i18n.localize("WWN.Starship.UnknownAction"));
  }
}

async function skillLevelForStation(starship, stationKey) {
  const uuid = starship.system.stations?.[stationKey]?.actor;
  if (!uuid) return 0;
  const actor = await fromUuid(uuid);
  if (!actor) return 0;
  const skillName = DEFAULT_STATION_SKILL[stationKey];
  const skill = findStationSkillItem(actor.items, skillName);
  if (skill) return WwnDice.effectiveSkillLevel(actor, skill);
  return Number(actor.system?.skill) || 0;
}

async function doYourDuty(combatant, starship, actName, commitAction) {
  const state = getStarshipCombatState(combatant);
  const act = (actName || "").trim() || game.i18n.localize("WWN.Starship.Action.doYourDutyDefault");
  if (act === state.flags.lastDoYourDutyAct) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.DoYourDutyRepeat"));
  }
  if (!(await commitAction())) return;
  await updateStarshipCombatState(combatant, (s) => ({
    ...gainCp(s, 1),
    flags: { ...s.flags, lastDoYourDutyAct: act },
  }));
  return createNoticeMessage({
    title: starship.name,
    actor: starship,
    body: game.i18n.format("WWN.Starship.DoYourDutyDone", { act, cp: 1 }),
  });
}

async function aboveAndBeyond(combatant, starship, stationKey) {
  await rollStationCheck(starship, stationKey, { skipDialog: false });
  // Simplified: prompt success
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.localize("WWN.Starship.AboveAndBeyondSuccess")}</p>`,
  });
  const skill = await skillLevelForStation(starship, stationKey);
  if (ok) {
    await updateStarshipCombatState(combatant, (s) => gainCp(s, skill + 1));
  } else {
    await updateStarshipCombatState(combatant, (s) => gainCp(s, -1));
  }
}

async function dealWithCrisis(combatant, instanceId, commitAction) {
  const state = getStarshipCombatState(combatant);
  const crisis = state.crises.find((c) => c.instanceId === instanceId && !c.resolved);
  if (!crisis) {
    // Pick first unresolved
    const first = state.crises.find((c) => !c.resolved);
    if (!first) return ui.notifications.warn(game.i18n.localize("WWN.Starship.NoCrisis"));
    instanceId = first.instanceId;
  }
  if (!(await commitAction())) return;
  const ok = await confirmWwnDialog({
    title: combatant.name,
    content: `<p>${game.i18n.localize("WWN.Starship.DealWithCrisisSuccess")}</p>`,
  });
  if (ok) await resolveCrisisInstance(combatant, instanceId);
}

async function evasiveManeuvers(combatant, starship) {
  await rollStationCheck(starship, "bridge");
  const skill = await skillLevelForStation(starship, "bridge");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.format("WWN.Starship.EvasiveSuccessPrompt", { dc: 9 })}</p>`,
  });
  if (ok) {
    await updateStarshipCombatState(combatant, (s) => ({
      ...s,
      buffs: { ...s.buffs, evasiveAcBonus: skill },
      flags: { ...s.flags, usedEvasiveThisRound: true },
    }));
  } else {
    await updateStarshipCombatState(combatant, (s) => ({
      ...s,
      flags: { ...s.flags, usedEvasiveThisRound: true },
    }));
  }
}

async function sensorGhost(combatant, starship) {
  await rollStationCheck(starship, "comms");
  const skill = await skillLevelForStation(starship, "comms");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.format("WWN.Starship.SensorGhostSuccessPrompt", { dc: 9 })}</p>`,
  });
  if (ok) {
    await updateStarshipCombatState(combatant, (s) => ({
      ...s,
      buffs: { ...s.buffs, sensorGhostAcBonus: skill },
      flags: { ...s.flags, usedSensorGhostThisRound: true },
    }));
  } else {
    await updateStarshipCombatState(combatant, (s) => ({
      ...s,
      flags: { ...s.flags, usedSensorGhostThisRound: true },
    }));
  }
}

async function boostEngines(combatant, starship) {
  await rollStationCheck(starship, "engineering");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.format("WWN.Starship.BoostEnginesSuccessPrompt", { dc: 8 })}</p>`,
  });
  if (ok) {
    await updateStarshipCombatState(combatant, (s) => ({
      ...s,
      buffs: { ...s.buffs, boostSpeed: 2 },
    }));
  }
}

async function damageControl(combatant, starship) {
  const state = getStarshipCombatState(combatant);
  const dc = damageControlDifficulty(state.flags.damageControlAttempts);
  await rollStationCheck(starship, "engineering");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.format("WWN.Starship.DamageControlSuccessPrompt", { dc })}</p>`,
  });
  await updateStarshipCombatState(combatant, (s) => ({
    ...s,
    flags: { ...s.flags, damageControlAttempts: (s.flags.damageControlAttempts || 0) + 1 },
  }));
  if (!ok) return;
  const fix = await skillLevelForStation(starship, "engineering");
  const heal = damageControlHp(fix, starship.system.hullClass);
  const hp = Number(starship.system.hp?.value) || 0;
  const max = Number(starship.system.hp?.max) || 0;
  await starship.update({ "system.hp.value": Math.min(max, hp + heal) });
  await createNoticeMessage({
    title: starship.name,
    actor: starship,
    body: game.i18n.format("WWN.Starship.DamageControlHealed", { heal }),
  });
}

async function emergencyRepairs(starship, options) {
  await rollStationCheck(starship, "engineering");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.format("WWN.Starship.EmergencyRepairsSuccessPrompt", { dc: 8 })}</p>`,
  });
  if (!ok) return;
  if (options.repairDrive) {
    await repairDriveStep(starship);
    return;
  }
  const item = options.itemId ? starship.items.get(options.itemId) : null;
  if (item) await repairDisabledShipSystem(item);
}

async function crashSystems(combat, combatant, starship, targetId, commitAction) {
  const target = pickTargetCombatant(combat, combatant, targetId);
  if (!target) return;
  if (!(await commitAction())) return;
  await rollStationCheck(starship, "comms");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.localize("WWN.Starship.CrashSystemsSuccessPrompt")}</p>`,
  });
  if (!ok) return;
  const prog = await skillLevelForStation(starship, "comms");
  await updateStarshipCombatState(target, (s) => ({
    ...s,
    cpPenaltyNextTurn: (s.cpPenaltyNextTurn || 0) + prog,
  }));
}

async function defeatEcm(combat, combatant, starship, targetId, commitAction) {
  const target = pickTargetCombatant(combat, combatant, targetId);
  if (!target) return;
  if (!(await commitAction())) return;
  await rollStationCheck(starship, "comms");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.localize("WWN.Starship.DefeatEcmSuccessPrompt")}</p>`,
  });
  if (!ok) return;
  const prog = await skillLevelForStation(starship, "comms");
  await updateStarshipCombatState(combatant, (s) => ({
    ...s,
    buffs: {
      ...s.buffs,
      defeatEcm: { ...s.buffs.defeatEcm, [target.id]: prog * 2 },
    },
  }));
}

async function escapeCombat(combat, combatant, starship, commitAction) {
  if (starship.system.speed == null) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.StationNoManeuver"));
  }
  if (!(await commitAction())) return;
  await rollStationCheck(starship, "bridge");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.localize("WWN.Starship.EscapeSuccessPrompt")}</p>`,
  });
  if (!ok) return;

  const foes = combat.combatants.filter((c) => c.id !== combatant.id && !c.isDefeated);
  const foeIds = foes.map((c) => c.id);
  const { state, newlyEscapedFrom } = applyEscapeCombatSuccess(
    getStarshipCombatState(combatant),
    foeIds,
  );
  let next = state;
  if (hasEscapedAll(next, foeIds)) {
    next = { ...next, flags: { ...next.flags, escapedFromAll: true } };
    await combatant.update({ defeated: true });
    await createNoticeMessage({
      title: starship.name,
      actor: starship,
      body: game.i18n.localize("WWN.Starship.EscapedCombat"),
    });
  } else if (newlyEscapedFrom.length) {
    await createNoticeMessage({
      title: starship.name,
      actor: starship,
      body: game.i18n.format("WWN.Starship.EscapedFromSome", {
        count: newlyEscapedFrom.length,
      }),
    });
  }
  await setStarshipCombatState(combatant, next);
}

async function pursueTarget(combat, combatant, starship, targetId, commitAction) {
  const target = pickTargetCombatant(combat, combatant, targetId);
  if (!target) return;
  if (!(await commitAction())) return;
  await rollStationCheck(starship, "bridge");
  const ok = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.localize("WWN.Starship.PursueSuccessPrompt")}</p>`,
  });
  if (!ok) return;
  // Escape lives on the fleeing ship, keyed by pursuer combatant id.
  const result = applyPursueSuccess(getStarshipCombatState(target), combatant.id);
  if (result.changed) await setStarshipCombatState(target, result.state);
  await createNoticeMessage({
    title: starship.name,
    actor: starship,
    body: game.i18n.localize("WWN.Starship.PursueSuccessPrompt"),
  });
}

function pickTargetCombatant(combat, self, targetId) {
  if (targetId) {
    const t = combat.combatants.get(targetId);
    if (t) return t;
  }
  const foes = combat.combatants.filter((c) => c.id !== self.id && !c.isDefeated);
  if (foes.length === 1) return foes[0];
  ui.notifications.warn(game.i18n.localize("WWN.Starship.SelectTarget"));
  return null;
}

async function fireWeapons(combat, combatant, starship, {
  all,
  targetSystems = false,
  weaponId,
  targetCombatantId,
  disableItemId,
  disableDrive = false,
  commitAction,
}) {
  if (weaponsLockedOut(getStarshipCombatState(combatant).crises)) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.WeaponsLockedOut"));
  }

  const target = pickTargetCombatant(combat, combatant, targetCombatantId);
  if (!target) return;

  let weapons = starship.items.filter(
    (i) => i.type === "shipWeapon" && !i.system?.disabled && !i.system?.destroyed,
  );
  if (!all) {
    const w = weaponId ? starship.items.get(weaponId) : weapons[0];
    if (!w) return ui.notifications.warn(game.i18n.localize("WWN.Starship.NoWeapon"));
    weapons = [w];
  }

  if (commitAction && !(await commitAction())) return;

  // Cloud weapons: auto vs fighters that attacked last round
  const cloudTargets = getStarshipCombatState(combatant).flags.attackedByLastRound ?? [];

  for (const weapon of weapons) {
    const q = (await import("./qualities.mjs")).parseWeaponQualities(weapon.system?.qualities);
    let defenders = [target];
    if (q.cloud) {
      defenders = combat.combatants.filter(
        (c) => cloudTargets.includes(c.id) && c.actor?.system?.hullClass === "fighter",
      );
      if (!defenders.length) continue;
    }

    for (const defender of defenders) {
      const msg = await rollShipWeapon(starship, weapon, { skipDialog: true });
      // Extract totals from the last rolls if available — fallback dialog
      const attackTotal = msg?.rolls?.[0]?.total;
      const damageTotal = msg?.rolls?.[1]?.total;
      if (attackTotal == null || damageTotal == null) {
        // Manual entry fallback
        const result = await showWwnDialog({
          modifier: "ship-hit",
          title: weapon.name,
          template: "systems/wwn/templates/dialog/ship-attack-totals.hbs",
          context: { attack: 10, damage: 5 },
          buttons: [confirmButton(), cancelButton()],
        }).catch(() => null);
        if (!result || result === "cancel") continue;
        await resolveShipWeaponHit({
          combat,
          attacker: combatant,
          defender,
          weapon,
          attackTotal: Number(result.attack) || 0,
          damageTotal: Number(result.damage) || 0,
          targetSystems: targetSystems && !all,
          disableItem: disableItemId ? defender.actor?.items?.get(disableItemId) : null,
          disableDrive,
        });
        continue;
      }

      // Flak: roll twice conceptually — re-roll if flak and keep better
      let atk = attackTotal;
      let dmg = damageTotal;
      if (q.flak && defender.actor?.system?.hullClass === "fighter") {
        const msg2 = await rollShipWeapon(starship, weapon, { skipDialog: true });
        const a2 = msg2?.rolls?.[0]?.total ?? atk;
        const d2 = msg2?.rolls?.[1]?.total ?? dmg;
        if (a2 > atk) {
          atk = a2;
          dmg = d2;
        }
      }

      await resolveShipWeaponHit({
        combat,
        attacker: combatant,
        defender,
        weapon,
        attackTotal: atk,
        damageTotal: dmg,
        targetSystems: targetSystems && !all,
        disableItem: disableItemId ? defender.actor?.items?.get(disableItemId) : null,
        disableDrive,
      });
    }
  }
}

/**
 * Auto Do Your Duty for headed departments that have not acted (PC mode end helper).
 * Callable from sheet.
 * @param {Actor} starship
 */
export async function autoDoYourDutyUnused(starship) {
  const combat = findStarshipCombatForActor(starship);
  if (!combat) return;
  const combatant = combatantForStarship(combat, starship);
  if (!combatant || !shipIsPcCrew(starship)) return;

  const state = getStarshipCombatState(combatant);
  const acted = new Set(state.flags.departmentsActed ?? []);
  const stations = starship.system.stations ?? {};
  let gained = 0;
  for (const key of ["bridge", "gunnery", "engineering", "comms", "captain"]) {
    if (!stations[key]?.actor) continue;
    if (acted.has(key)) continue;
    gained += 1;
  }
  if (gained > 0) {
    await updateStarshipCombatState(combatant, (s) => gainCp(s, gained));
    await createNoticeMessage({
      title: starship.name,
      actor: starship,
      body: game.i18n.format("WWN.Starship.AutoDoYourDuty", { cp: gained }),
    });
  }
}
