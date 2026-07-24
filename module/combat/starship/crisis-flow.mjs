/**
 * Crisis accept / resolve flows for starship combat.
 */
import {
  crisisFromRoll,
  createCrisisInstance,
} from "./crises.mjs";
import {
  getStarshipCombatState,
  updateStarshipCombatState,
  shipIsPcCrew,
} from "./combatant-state.mjs";
import { gainCp } from "./cp.mjs";
import { disableShipSystem, degradeDrive, randomDisableTarget } from "./systems.mjs";
import { createNoticeMessage } from "../../chat/chat-card.mjs";
import { armorWithCrises } from "./crises.mjs";

/**
 * Accept a hit Crisis: negate hit, roll d10, apply crisis instance.
 * @param {Combatant} combatant
 * @param {number} roundNumber
 * @param {{ source?: string, countAgainstRoundLimit?: boolean }} [opts]
 */
export async function acceptHitCrisis(combatant, roundNumber, {
  source = "hit",
  countAgainstRoundLimit = true,
} = {}) {
  const actor = combatant.actor;
  if (!actor) return null;

  const state = getStarshipCombatState(combatant);
  if (!shipIsPcCrew(actor) && state.flags.usedNpcCrisisThisFight) {
    ui.notifications.warn(game.i18n.localize("WWN.Starship.NpcCrisisLimit"));
    return null;
  }

  const roll = await new Roll("1d10").evaluate();
  const def = crisisFromRoll(roll.total);
  let systemId = null;

  if (def.id === "systemDamage") {
    const item = randomDisableTarget(actor);
    if (item) {
      await disableShipSystem(item);
      systemId = item.id;
    } else {
      await degradeDrive(actor);
    }
  }

  if (def.id === "armorLoss") {
    // Mechanical effect applied via armorWithCrises when resolving damage
  }

  const instance = createCrisisInstance(def, { roundNumber, source, systemId });

  await updateStarshipCombatState(combatant, (s) => ({
    ...s,
    crises: [...s.crises, instance],
    flags: {
      ...s.flags,
      usedHitCrisisThisRound: countAgainstRoundLimit ? true : s.flags.usedHitCrisisThisRound,
      usedNpcCrisisThisFight: !shipIsPcCrew(actor) ? true : s.flags.usedNpcCrisisThisFight,
    },
  }));

  await createNoticeMessage({
    title: game.i18n.format("WWN.Starship.CrisisRolled", {
      ship: actor.name,
      roll: roll.total,
    }),
    actor,
    body: game.i18n.localize(def.labelKey),
  });

  return instance;
}

/**
 * Keep It Together — Captain instant: negate a hit by taking a Crisis (does not count vs 1/round hit limit).
 * @param {Combatant} combatant
 * @param {number} roundNumber
 */
export async function keepItTogetherCrisis(combatant, roundNumber) {
  return acceptHitCrisis(combatant, roundNumber, {
    source: "keepItTogether",
    countAgainstRoundLimit: false,
  });
}

/**
 * Into the Fire — accept Crew Lost crisis, gain Lead+1 CP.
 * @param {Combatant} combatant
 * @param {number} roundNumber
 * @param {number} leadSkill
 */
export async function intoTheFire(combatant, roundNumber, leadSkill = 0) {
  const def = crisisFromRoll(3); // Crew Lost
  const instance = createCrisisInstance(def, {
    roundNumber,
    source: "intoTheFire",
  });
  const cpGain = Math.max(0, Number(leadSkill) || 0) + 1;

  await updateStarshipCombatState(combatant, (s) => {
    const withCrisis = {
      ...s,
      crises: [...s.crises, instance],
      flags: { ...s.flags, usedIntoTheFireThisRound: true },
    };
    return gainCp(withCrisis, cpGain);
  });

  await createNoticeMessage({
    title: combatant.actor?.name,
    actor: combatant.actor,
    body: game.i18n.format("WWN.Starship.IntoTheFireResult", { cp: cpGain }),
  });

  return instance;
}

/**
 * Mark a crisis resolved after Deal With a Crisis succeeds.
 * @param {Combatant} combatant
 * @param {string} instanceId
 */
export async function resolveCrisisInstance(combatant, instanceId) {
  await updateStarshipCombatState(combatant, (s) => ({
    ...s,
    crises: s.crises.map((c) =>
      c.instanceId === instanceId ? { ...c, resolved: true } : c,
    ),
  }));
}

export { armorWithCrises };
