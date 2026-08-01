/**
 * Starship combat turn lifecycle (start/end turn, combat start).
 */
import { captainFocusBonusesForShip } from "../../helpers/starship-focus-bonuses.mjs";
import {
  ensureStarshipCombatState,
  getStarshipCombatState,
  setStarshipCombatState,
  clearStarshipCombatState,
  shipIsPcCrew,
} from "./combatant-state.mjs";
import { startTurnState, endTurnState } from "./cp.mjs";
import { hullBreachDisasterDice } from "./crises.mjs";
import { createNoticeMessage } from "../../chat/chat-card.mjs";

/**
 * Initialize combatant flags for all ships when combat starts.
 * @param {Combat} combat
 */
export async function onStarshipCombatStart(combat) {
  for (const c of combat.combatants) {
    if (c.actor?.type !== "starship") continue;
    await ensureStarshipCombatState(c);
  }
}

/**
 * @param {Combatant} combatant
 */
export async function onStarshipTurnStart(combatant) {
  const actor = combatant?.actor;
  if (actor?.type !== "starship") return;

  await ensureStarshipCombatState(combatant);
  const pcCrew = shipIsPcCrew(actor);
  let captainBonus = 0;
  if (!pcCrew) {
    const bonuses = await captainFocusBonusesForShip(actor);
    captainBonus = bonuses.commandPointsBonus || 0;
  }

  const next = startTurnState(getStarshipCombatState(combatant), {
    pcCrew,
    npcCp: Number(actor.system.npcCp) || 4,
    captainCommandBonus: captainBonus,
  });
  await setStarshipCombatState(combatant, next);
}

/**
 * Apply acute crisis disasters that expired at end of turn, then clear round state.
 * @param {Combatant} combatant
 * @param {number} roundNumber
 */
export async function onStarshipTurnEnd(combatant, roundNumber) {
  const actor = combatant?.actor;
  if (actor?.type !== "starship") return;

  let state = getStarshipCombatState(combatant);
  const expired = state.crises.filter((c) => c.type === "acute" && !c.resolved && !c.disasterApplied
    && c.deadlineRound != null && roundNumber >= c.deadlineRound);

  for (const crisis of expired) {
    state = await applyAcuteDisaster(combatant, state, crisis);
  }

  state = endTurnState(state, { roundNumber });
  // Mark expired acute as disasterApplied / resolved after disaster
  state = {
    ...state,
    crises: state.crises.map((c) => {
      if (c.type === "acute" && !c.resolved && c.deadlineRound != null && roundNumber >= c.deadlineRound) {
        return { ...c, expired: true, disasterApplied: true, resolved: true };
      }
      return c;
    }),
  };
  await setStarshipCombatState(combatant, state);
}

/**
 * @param {Combatant} combatant
 * @param {object} state
 * @param {object} crisis
 */
async function applyAcuteDisaster(combatant, state, crisis) {
  const actor = combatant.actor;
  if (!actor) return state;

  if (crisis.id === "hullBreach") {
    const dice = hullBreachDisasterDice(actor.system.hullClass);
    const roll = await new Roll(dice).evaluate();
    const { applyStarshipHullDamage } = await import("./hull-damage.mjs");
    await applyStarshipHullDamage(actor, roll.total);
    await createNoticeMessage({
      title: actor.name,
      actor,
      body: game.i18n.format("WWN.Starship.Crisis.hullBreachDisaster", {
        damage: roll.total,
      }),
    });
  } else if (crisis.id === "cargoLoss") {
    await createNoticeMessage({
      title: actor.name,
      actor,
      body: game.i18n.localize("WWN.Starship.Crisis.cargoLossDisaster"),
    });
  } else if (crisis.id === "crewLost") {
    const max = Number(actor.system.crew?.max) || 0;
    const lost = Math.max(1, Math.floor(max * 0.1));
    const current = Math.max(0, (Number(actor.system.crew?.current) || 0) - lost);
    await actor.update({ "system.crew.current": current });
    await createNoticeMessage({
      title: actor.name,
      actor,
      body: game.i18n.format("WWN.Starship.Crisis.crewLostDisaster", { lost }),
    });
  } else if (crisis.id === "fuelBleed") {
    await createNoticeMessage({
      title: actor.name,
      actor,
      body: game.i18n.localize("WWN.Starship.Crisis.fuelBleedDisaster"),
    });
  } else if (crisis.id === "vipImperiled") {
    await createNoticeMessage({
      title: actor.name,
      actor,
      body: game.i18n.localize("WWN.Starship.Crisis.vipImperiledDisaster"),
    });
  }

  return state;
}

/**
 * Clear ephemeral combatant flags while the Combat still exists.
 * Do not call this from Combat `_onDelete`: embedded combatants cannot be
 * updated after Foundry removes the parent Combat from the collection.
 * @param {Combat} combat
 */
export async function onStarshipCombatEnd(combat) {
  for (const c of combat.combatants) {
    if (c.actor?.type !== "starship") continue;
    await clearStarshipCombatState(c);
  }
}
