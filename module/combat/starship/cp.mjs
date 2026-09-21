/**
 * Command Point helpers for starship combat turns.
 */

import { normalizeStarshipCombatState } from "./state.mjs";

/**
 * CP at the start of a ship's turn before PC actions generate more.
 * NPC mode: npcCp + captain bonuses − penalties.
 * PC mode: 0 − penalties (solo fighter +4 applied when they take their first dept action).
 *
 * @param {object} opts
 * @param {boolean} opts.pcCrew
 * @param {number} opts.npcCp
 * @param {number} [opts.captainCommandBonus]
 * @param {number} [opts.cpPenaltyNextTurn]
 * @param {number} [opts.haywireStacks] each continuing Haywire is −2 (already in penalty or counted here)
 * @returns {number}
 */
export function startingCommandPoints({
  pcCrew,
  npcCp = 4,
  captainCommandBonus = 0,
  cpPenaltyNextTurn = 0,
  haywireStacks = 0,
} = {}) {
  const penalty = (Number(cpPenaltyNextTurn) || 0) + (Number(haywireStacks) || 0) * 2;
  if (pcCrew) return 0 - penalty;
  return (Number(npcCp) || 0) + (Number(captainCommandBonus) || 0) - penalty;
}

/**
 * Apply Captain Support discount (−2, min 0) if pending.
 * @param {number} baseCost
 * @param {boolean} supportPending
 */
export function applySupportDiscount(baseCost, supportPending) {
  const cost = Math.max(0, Number(baseCost) || 0);
  if (!supportPending) return cost;
  return Math.max(0, cost - 2);
}

/**
 * Solo fighter: one department action + 4 CP from the other four departments.
 * Call when PC crew ship with only one headed department acting this turn pattern,
 * or when a single PC is running the ship — plan: +4 when first department action taken
 * and no other departments have acted yet, if ship is fighter-class with ≤1 distinct crew.
 *
 * Simpler rule used here: after first department action on a PC-mode ship where
 * `grantSoloFighterBonus` is true, add +4 CP once.
 *
 * @param {object} state
 * @param {boolean} grantSoloFighterBonus
 * @returns {object} next state
 */
export function maybeGrantSoloFighterCp(state, grantSoloFighterBonus) {
  const s = normalizeStarshipCombatState(state);
  if (!grantSoloFighterBonus) return s;
  if ((s.flags.departmentsActed?.length ?? 0) !== 1) return s;
  if (s.flags.soloFighterGranted) return s;
  return {
    ...s,
    cp: s.cp + 4,
    flags: { ...s.flags, soloFighterGranted: true },
  };
}

/**
 * "Only one exclusive general action (Do Your Duty / Above and Beyond / Deal
 * With a Crisis) per turn" -- and nothing more. Extracted as a pure
 * predicate so this specific rule can be unit-tested without needing to
 * drive a full department action (most of which pop a real roll/target
 * dialog) through a live Foundry runtime.
 *
 * Code-review fix: this used to also reject `def.department !== "general"`,
 * which meant taking any exclusive general action silently blocked every
 * other department (Bridge/Gunnery/Engineering/Comms/most-Captain) for the
 * rest of the ship's turn, not just other exclusive/general actions.
 *
 * Code-review fix: there used to be a second `if` here checking the exact
 * same two booleans with the operands swapped (`state... && def.exclusive`
 * vs `def.exclusive && state...`), returning a distinct "ExclusiveBlocks"
 * reason that could therefore never actually be reached -- the first branch
 * always matched first. There is only one condition this guard needs to
 * express ("already took the turn's one exclusive general action, and this
 * is another exclusive action"), so the dead branch and its now-unreachable
 * WWN.Starship.ExclusiveBlocks string were removed rather than invented a
 * second real distinction that was never specified anywhere.
 * @param {{flags: {tookExclusiveGeneralAction?: boolean}}} state
 * @param {{exclusive?: boolean}} def
 * @returns {{ ok: boolean, reasonKey?: string }}
 */
export function checkExclusiveActionGuard(state, def) {
  if (def.exclusive && state.flags.tookExclusiveGeneralAction) {
    return { ok: false, reasonKey: "WWN.Starship.ExclusiveAlready" };
  }
  return { ok: true };
}

/**
 * Spend CP if affordable.
 * @param {object} state
 * @param {number} cost
 * @returns {{ ok: boolean, state: object, reason?: string }}
 */
export function spendCp(state, cost) {
  const s = normalizeStarshipCombatState(state);
  const c = Math.max(0, Number(cost) || 0);
  if (s.cp < c) return { ok: false, state: s, reason: "insufficientCp" };
  return { ok: true, state: { ...s, cp: s.cp - c } };
}

/**
 * Gain CP (Do Your Duty, Above and Beyond, Into the Fire, etc.).
 * @param {object} state
 * @param {number} amount
 */
export function gainCp(state, amount) {
  const s = normalizeStarshipCombatState(state);
  return { ...s, cp: s.cp + (Number(amount) || 0) };
}

/**
 * End of turn: discard unused CP; clear once-per-round flags and round buffs.
 * @param {object} state
 * @param {{ roundNumber?: number }} [opts]
 */
export function endTurnState(state, { roundNumber } = {}) {
  const s = normalizeStarshipCombatState(state);
  const crises = s.crises.map((c) => {
    if (c.type !== "acute") return c;
    // Acute crises must be resolved by end of next round after creation.
    if (c.deadlineRound != null && roundNumber != null && roundNumber >= c.deadlineRound) {
      return { ...c, expired: true };
    }
    return c;
  });

  return {
    ...s,
    cp: 0,
    buffs: {
      ...s.buffs,
      evasiveAcBonus: 0,
      sensorGhostAcBonus: 0,
      foxerAcBonus: 0,
      boostSpeed: 0,
      defeatEcm: {},
    },
    flags: {
      ...s.flags,
      usedEvasiveThisRound: false,
      usedSensorGhostThisRound: false,
      usedCaptainSupportThisRound: false,
      usedKeepItTogetherThisRound: false,
      usedIntoTheFireThisRound: false,
      usedHitCrisisThisRound: false,
      tookExclusiveGeneralAction: false,
      supportDiscountPending: false,
      departmentsActed: [],
      soloFighterGranted: false,
      attackedByLastRound: [...s.flags.attackedByThisRound],
      attackedByThisRound: [],
    },
    crises,
    cpPenaltyNextTurn: 0,
  };
}

/**
 * Start of turn: set CP from starting pool; carry haywire as penalty stacks via crises.
 * @param {object} state
 * @param {Parameters<typeof startingCommandPoints>[0]} startOpts
 */
export function startTurnState(state, startOpts) {
  const s = normalizeStarshipCombatState(state);
  const haywireStacks = s.crises.filter((c) => c.id === "haywire" && !c.resolved).length;
  const cp = startingCommandPoints({
    ...startOpts,
    cpPenaltyNextTurn: s.cpPenaltyNextTurn,
    haywireStacks,
  });
  return {
    ...s,
    cp,
    flags: {
      ...s.flags,
      departmentsActed: [],
      tookExclusiveGeneralAction: false,
      supportDiscountPending: false,
      soloFighterGranted: false,
      usedEvasiveThisRound: false,
      usedSensorGhostThisRound: false,
      usedCaptainSupportThisRound: false,
      usedKeepItTogetherThisRound: false,
      usedIntoTheFireThisRound: false,
      usedHitCrisisThisRound: false,
    },
    buffs: {
      ...s.buffs,
      evasiveAcBonus: 0,
      sensorGhostAcBonus: 0,
      foxerAcBonus: 0,
      boostSpeed: 0,
      defeatEcm: {},
    },
  };
}
