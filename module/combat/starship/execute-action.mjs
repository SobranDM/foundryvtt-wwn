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
import {
  extractChatRollTotal,
  stationCheckSucceeded,
  opposedCheckSucceeded,
  pickFlakShot,
  cloudDefenderIds,
  STARSHIP_ACTION_DC,
} from "./roll-resolve.mjs";
import { rollStationCheck, rollShipWeapon } from "../../helpers/starship-rolls.mjs";
import { WwnDice } from "../../dice/dice.mjs";
import { findStationSkillItem, DEFAULT_STATION_SKILL } from "../../helpers/starship-crew.mjs";
import { createNoticeMessage } from "../../chat/chat-card.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../../applications/wwn-dialog.mjs";

/**
 * Roll a station check and return its primary total, or null if cancelled / failed to roll.
 * @param {Actor} starship
 * @param {string} stationKey
 * @returns {Promise<number|null>}
 */
async function stationRollTotal(starship, stationKey) {
  const msg = await rollStationCheck(starship, stationKey, { skipDialog: false });
  if (!msg) return null;
  return extractChatRollTotal(msg);
}

/**
 * Fixed-DC station check. Returns null if roll cancelled, else success boolean.
 * @param {Actor} starship
 * @param {string} stationKey
 * @param {number} dc
 * @returns {Promise<boolean|null>}
 */
async function stationVsDc(starship, stationKey, dc) {
  const total = await stationRollTotal(starship, stationKey);
  if (total == null) return null;
  return stationCheckSucceeded(total, dc);
}

/**
 * Opposed station checks (optional flat bonuses, e.g. Speed).
 * @returns {Promise<boolean|null>} null if either roll cancelled
 */
async function opposedStations(attacker, atkStation, defenderActor, defStation, {
  atkBonus = 0,
  defBonus = 0,
} = {}) {
  const atk = await stationRollTotal(attacker, atkStation);
  if (atk == null) return null;
  if (!defenderActor) return stationCheckSucceeded(atk + atkBonus, 8);
  const def = await stationRollTotal(defenderActor, defStation);
  if (def == null) return null;
  return opposedCheckSucceeded(atk + atkBonus, def + defBonus);
}

function notifyCheckFailed(starship) {
  ui.notifications?.info?.(game.i18n.localize("WWN.Starship.CheckFailed"));
}

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

  if (!game.user.isGM && !starship.isOwner && !options.gmOverride) {
    return ui.notifications.warn(game.i18n.localize("WWN.Starship.NotOwner"));
  }

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
      return aboveAndBeyond(combatant, starship, options.stationKey ?? "bridge", commitAction);

    case "dealWithCrisis":
      return dealWithCrisis(combatant, starship, options.instanceId, commitAction);

    case "evasiveManeuvers":
      return evasiveManeuvers(combatant, starship, commitAction);

    case "sensorGhost":
      return sensorGhost(combatant, starship, commitAction);

    case "boostEngines":
      return boostEngines(combatant, starship, commitAction);

    case "damageControl":
      return damageControl(combatant, starship, commitAction);

    case "emergencyRepairs":
      return emergencyRepairs(starship, options, commitAction);

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

async function aboveAndBeyond(combatant, starship, stationKey, commitAction) {
  const ok = await stationVsDc(starship, stationKey, STARSHIP_ACTION_DC.aboveAndBeyond);
  if (ok == null) return;
  if (!(await commitAction())) return;
  const skill = await skillLevelForStation(starship, stationKey);
  if (ok) {
    await updateStarshipCombatState(combatant, (s) => gainCp(s, skill + 1));
  } else {
    await updateStarshipCombatState(combatant, (s) => gainCp(s, -1));
    notifyCheckFailed(starship);
  }
}

async function dealWithCrisis(combatant, starship, instanceId, commitAction) {
  const state = getStarshipCombatState(combatant);
  let crisis = state.crises.find((c) => c.instanceId === instanceId && !c.resolved);
  if (!crisis) {
    crisis = state.crises.find((c) => !c.resolved);
    if (!crisis) return ui.notifications.warn(game.i18n.localize("WWN.Starship.NoCrisis"));
  }
  const dc = Number(crisis.dc) || STARSHIP_ACTION_DC.dealWithCrisis;
  const ok = await stationVsDc(starship, "engineering", dc);
  if (ok == null) return; // cancelled — do not spend CP
  if (!(await commitAction())) return;
  if (ok) await resolveCrisisInstance(combatant, crisis.instanceId);
  else notifyCheckFailed(starship);
}

async function evasiveManeuvers(combatant, starship, commitAction) {
  const skill = await skillLevelForStation(starship, "bridge");
  const ok = await stationVsDc(starship, "bridge", STARSHIP_ACTION_DC.evasiveManeuvers);
  if (ok == null) return;
  if (!(await commitAction())) return;
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
    notifyCheckFailed(starship);
  }
}

async function sensorGhost(combatant, starship, commitAction) {
  const skill = await skillLevelForStation(starship, "comms");
  const ok = await stationVsDc(starship, "comms", STARSHIP_ACTION_DC.sensorGhost);
  if (ok == null) return;
  if (!(await commitAction())) return;
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
    notifyCheckFailed(starship);
  }
}

async function boostEngines(combatant, starship, commitAction) {
  const ok = await stationVsDc(starship, "engineering", STARSHIP_ACTION_DC.boostEngines);
  if (ok == null) return;
  if (!(await commitAction())) return;
  if (ok) {
    await updateStarshipCombatState(combatant, (s) => ({
      ...s,
      buffs: { ...s.buffs, boostSpeed: 2 },
    }));
  } else {
    notifyCheckFailed(starship);
  }
}

async function damageControl(combatant, starship, commitAction) {
  const state = getStarshipCombatState(combatant);
  const dc = damageControlDifficulty(state.flags.damageControlAttempts);
  const ok = await stationVsDc(starship, "engineering", dc);
  if (ok == null) return;
  if (!(await commitAction())) return;
  await updateStarshipCombatState(combatant, (s) => ({
    ...s,
    flags: { ...s.flags, damageControlAttempts: (s.flags.damageControlAttempts || 0) + 1 },
  }));
  if (!ok) {
    notifyCheckFailed(starship);
    return;
  }
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

async function emergencyRepairs(starship, options, commitAction) {
  const ok = await stationVsDc(starship, "engineering", STARSHIP_ACTION_DC.emergencyRepairs);
  if (ok == null) return;
  if (!(await commitAction())) return;
  if (!ok) {
    notifyCheckFailed(starship);
    return;
  }
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
  const ok = await opposedStations(starship, "comms", target.actor, "comms");
  if (ok == null) return;
  if (!(await commitAction())) return;
  if (!ok) {
    notifyCheckFailed(starship);
    return;
  }
  const prog = await skillLevelForStation(starship, "comms");
  await updateStarshipCombatState(target, (s) => ({
    ...s,
    cpPenaltyNextTurn: (s.cpPenaltyNextTurn || 0) + prog,
  }));
}

async function defeatEcm(combat, combatant, starship, targetId, commitAction) {
  const target = pickTargetCombatant(combat, combatant, targetId);
  if (!target) return;
  const ok = await opposedStations(starship, "comms", target.actor, "comms");
  if (ok == null) return;
  if (!(await commitAction())) return;
  if (!ok) {
    notifyCheckFailed(starship);
    return;
  }
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

  const foes = combat.combatants.filter((c) => c.id !== combatant.id && !c.isDefeated);
  const primary = foes[0];
  const atkSpeed = Number(starship.system.speed) || 0;
  const defSpeed = Number(primary?.actor?.system?.speed) || 0;
  const ok = await opposedStations(
    starship,
    "bridge",
    primary?.actor ?? null,
    "bridge",
    { atkBonus: atkSpeed, defBonus: defSpeed },
  );
  if (ok == null) return;
  if (!(await commitAction())) return;
  if (!ok) {
    notifyCheckFailed(starship);
    return;
  }

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
  const atkSpeed = Number(starship.system.speed) || 0;
  const defSpeed = Number(target.actor?.system?.speed) || 0;
  const ok = await opposedStations(
    starship,
    "bridge",
    target.actor,
    "bridge",
    { atkBonus: atkSpeed, defBonus: defSpeed },
  );
  if (ok == null) return;
  if (!(await commitAction())) return;
  if (!ok) {
    notifyCheckFailed(starship);
    return;
  }
  const result = applyPursueSuccess(getStarshipCombatState(target), combatant.id);
  if (result.changed) await setStarshipCombatState(target, result.state);
  await createNoticeMessage({
    title: starship.name,
    actor: starship,
    body: game.i18n.localize("WWN.Starship.PursueApplied"),
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

  // Cloud weapons: auto vs fighters that attacked *this* ship last round
  const cloudIds = cloudDefenderIds(
    getStarshipCombatState(combatant).flags.attackedByLastRound ?? [],
    [...combat.combatants],
  );

  // Commit CP only once the first shot actually resolves (cancelable dialogs first).
  let committed = !commitAction;
  const ensureCommit = async () => {
    if (committed) return true;
    if (!(await commitAction())) return false;
    committed = true;
    return true;
  };

  for (const weapon of weapons) {
    const q = (await import("./qualities.mjs")).parseWeaponQualities(weapon.system?.qualities);
    let defenders = [target];
    if (q.cloud) {
      defenders = cloudIds.map((id) => combat.combatants.get(id)).filter(Boolean);
      if (!defenders.length) continue;
    }

    for (const defender of defenders) {
      let rolled = await rollShipWeapon(starship, weapon, {
        skipDialog: true,
        createMessage: false,
        targetActor: defender.actor,
      });
      let attackTotal = rolled?.attackTotal ?? null;
      let damageTotal = rolled?.damageTotal ?? null;
      let attackRoll = rolled?.attackRoll ?? null;
      let damageRoll = rolled?.damageRoll ?? null;
      if (attackTotal == null || damageTotal == null) {
        const result = await showWwnDialog({
          modifier: "ship-hit",
          title: weapon.name,
          template: "systems/wwn/templates/dialog/ship-attack-totals.hbs",
          context: { attack: 10, damage: 5 },
          buttons: [confirmButton(), cancelButton()],
        }).catch(() => null);
        if (!result || result === "cancel") continue;
        attackTotal = Number(result.attack) || 0;
        damageTotal = Number(result.damage) || 0;
        attackRoll = null;
        damageRoll = null;
      }

      if (!(await ensureCommit())) return;

      let atk = attackTotal;
      let dmg = damageTotal;
      if (q.flak && defender.actor?.system?.hullClass === "fighter") {
        const rolled2 = await rollShipWeapon(starship, weapon, {
          skipDialog: true,
          createMessage: false,
          targetActor: defender.actor,
        });
        const picked = pickFlakShot(
          { attack: atk, damage: dmg },
          {
            attack: rolled2?.attackTotal ?? atk,
            damage: rolled2?.damageTotal ?? dmg,
          },
        );
        atk = picked.attack;
        dmg = picked.damage;
        if (rolled2 && picked.attack === rolled2.attackTotal) {
          attackRoll = rolled2.attackRoll;
          damageRoll = rolled2.damageRoll;
        }
      }

      await resolveShipWeaponHit({
        combat,
        attacker: combatant,
        defender,
        weapon,
        attackTotal: atk,
        damageTotal: dmg,
        attackRoll,
        damageRoll,
        targetSystems: targetSystems && !all,
        title: rolled?.title,
        attackBreakdown: rolled?.attackBreakdown,
        damageBreakdown: rolled?.damageBreakdown,
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
