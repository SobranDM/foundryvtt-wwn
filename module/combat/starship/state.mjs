/**
 * Pure defaults and merge helpers for combatant `flags.wwn.starshipCombat`.
 */

/** @returns {object} */
export function defaultStarshipCombatState() {
  return {
    cp: 0,
    cpPenaltyNextTurn: 0,
    /** @type {Record<string, number>} opposingCombatantId → Escape points they have vs this ship */
    escape: {},
    /** @type {object[]} */
    crises: [],
    buffs: {
      evasiveAcBonus: 0,
      sensorGhostAcBonus: 0,
      foxerAcBonus: 0,
      boostSpeed: 0,
      /** @type {Record<string, number>} targetCombatantId → hit bonus */
      defeatEcm: {},
    },
    flags: {
      usedEvasiveThisRound: false,
      usedSensorGhostThisRound: false,
      usedCaptainSupportThisRound: false,
      usedKeepItTogetherThisRound: false,
      usedIntoTheFireThisRound: false,
      usedHitCrisisThisRound: false,
      usedBurstEcmThisFight: false,
      usedNpcCrisisThisFight: false,
      tookExclusiveGeneralAction: false,
      supportDiscountPending: false,
      departmentsActed: /** @type {string[]} */ ([]),
      lastDoYourDutyAct: "",
      damageControlAttempts: 0,
      /** @type {string[]} combatant ids that attacked this ship last round */
      attackedByLastRound: [],
      /** @type {string[]} combatant ids that attacked this ship this round */
      attackedByThisRound: [],
      mortallyDamaged: false,
      escapedFromAll: false,
    },
  };
}

/**
 * @param {object|null|undefined} raw
 * @returns {object}
 */
export function normalizeStarshipCombatState(raw) {
  const base = defaultStarshipCombatState();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    escape: { ...base.escape, ...(raw.escape ?? {}) },
    crises: Array.isArray(raw.crises) ? raw.crises.map((c) => ({ ...c })) : [],
    buffs: {
      ...base.buffs,
      ...(raw.buffs ?? {}),
      defeatEcm: { ...base.buffs.defeatEcm, ...(raw.buffs?.defeatEcm ?? {}) },
    },
    flags: {
      ...base.flags,
      ...(raw.flags ?? {}),
      departmentsActed: [...(raw.flags?.departmentsActed ?? [])],
      attackedByLastRound: [...(raw.flags?.attackedByLastRound ?? [])],
      attackedByThisRound: [...(raw.flags?.attackedByThisRound ?? [])],
    },
  };
}

/**
 * Whether the ship uses PC crew CP rules (any station has a linked actor uuid).
 * @param {{ stations?: Record<string, { actor?: string|null }> }|null|undefined} system
 * @returns {boolean}
 */
export function isPcCrewMode(system) {
  const stations = system?.stations ?? {};
  return Object.values(stations).some((s) => !!s?.actor);
}

/**
 * Effective AC including temporary combat buffs and optional Point Defense.
 * @param {number} baseAc
 * @param {object} state
 * @param {{ pointDefense?: boolean }} [opts]
 */
export function effectiveStarshipAc(baseAc, state, { pointDefense = false } = {}) {
  const s = normalizeStarshipCombatState(state);
  let ac = Number(baseAc) || 0;
  ac += Number(s.buffs.evasiveAcBonus) || 0;
  ac += Number(s.buffs.sensorGhostAcBonus) || 0;
  ac += Number(s.buffs.foxerAcBonus) || 0;
  if (pointDefense) ac += 2;
  return ac;
}

/**
 * Effective Speed including Boost Engines buff.
 * @param {number|null|undefined} baseSpeed
 * @param {object} state
 */
export function effectiveStarshipSpeed(baseSpeed, state) {
  if (baseSpeed == null) return null;
  const s = normalizeStarshipCombatState(state);
  return Number(baseSpeed) + (Number(s.buffs.boostSpeed) || 0);
}
