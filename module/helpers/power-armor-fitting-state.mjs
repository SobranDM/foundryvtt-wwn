/**
 * Pure helpers for power-armor system.fittingState.
 * No Foundry imports.
 */

/**
 * @typedef {object} FittingStateEntry
 * @property {number} [usesScene]
 * @property {number} [usesMaint]
 * @property {number} [cooldownRounds]
 * @property {number|null} [lastUsedRound]
 * @property {number|null} [activeUntil]
 * @property {boolean} [active]
 * @property {string} [targetUuid]
 * @property {string} [linkedMountItemId]
 * @property {boolean} [emptySuit]
 * @property {boolean} [incapUntilMaint]
 * @property {boolean} [deadUntilMaint]
 * @property {number} [doses]
 * @property {string[]} [allowedPilots]
 * @property {Record<string, unknown>} [flags]
 */

/**
 * @param {object} suitSystem
 * @param {string} key effectId or effectId:itemId
 * @returns {FittingStateEntry}
 */
export function getFittingState(suitSystem, key) {
  const state = suitSystem?.fittingState ?? {};
  const entry = state[key];
  return entry && typeof entry === "object" ? { ...entry } : {};
}

/**
 * @param {object} suitSystem
 * @param {string} key
 * @param {Partial<FittingStateEntry>} patch
 * @returns {Record<string, FittingStateEntry>}
 */
export function patchFittingState(suitSystem, key, patch) {
  const prev = suitSystem?.fittingState && typeof suitSystem.fittingState === "object"
    ? { ...suitSystem.fittingState }
    : {};
  const cur = getFittingState(suitSystem, key);
  prev[key] = { ...cur, ...patch };
  return prev;
}

/**
 * Clear scene-scoped counters and scene-active modes.
 * Preserves maintenance locks, doses remaining that are maint-scoped, whitelist, etc.
 * @param {Record<string, FittingStateEntry>} state
 * @returns {Record<string, FittingStateEntry>}
 */
export function resetSceneFittingState(state = {}) {
  const next = {};
  for (const [key, entry] of Object.entries(state ?? {})) {
    if (!entry || typeof entry !== "object") continue;
    const {
      usesScene: _u,
      cooldownRounds: _c,
      lastUsedRound: _l,
      activeUntil: _a,
      active: _act,
      targetUuid: _t,
      ...rest
    } = entry;
    next[key] = { ...rest, usesScene: 0, cooldownRounds: 0, lastUsedRound: null, activeUntil: null, active: false };
  }
  return next;
}

/**
 * Clear maintenance-scoped locks and usesMaint; keep scene state.
 * @param {Record<string, FittingStateEntry>} state
 * @returns {Record<string, FittingStateEntry>}
 */
export function resetMaintFittingState(state = {}) {
  const next = {};
  for (const [key, entry] of Object.entries(state ?? {})) {
    if (!entry || typeof entry !== "object") continue;
    const {
      usesMaint: _m,
      deadUntilMaint: _d,
      incapUntilMaint: _i,
      ...rest
    } = entry;
    next[key] = {
      ...rest,
      usesMaint: 0,
      deadUntilMaint: false,
      incapUntilMaint: false,
    };
  }
  return next;
}

/**
 * @param {FittingStateEntry} stateEntry
 * @param {{ scene?: boolean, maint?: boolean, round?: boolean, combatRound?: number|null, maxScene?: number, maxMaint?: number }} opts
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canSpend(stateEntry = {}, opts = {}) {
  const {
    scene = false,
    maint = false,
    round = false,
    combatRound = null,
    maxScene = 1,
    maxMaint = 1,
  } = opts;

  if (stateEntry.deadUntilMaint || stateEntry.incapUntilMaint) {
    return { ok: false, reason: "lockedUntilMaint" };
  }
  if (scene && (stateEntry.usesScene ?? 0) >= maxScene) {
    return { ok: false, reason: "sceneExhausted" };
  }
  if (maint && (stateEntry.usesMaint ?? 0) >= maxMaint) {
    return { ok: false, reason: "maintExhausted" };
  }
  if (round && combatRound != null && stateEntry.lastUsedRound === combatRound) {
    return { ok: false, reason: "sameRound" };
  }
  if (round && combatRound != null && stateEntry.lastUsedRound != null
    && combatRound === stateEntry.lastUsedRound + 1
    && stateEntry.flags?.blockConsecutive) {
    return { ok: false, reason: "consecutiveRound" };
  }
  if ((stateEntry.cooldownRounds ?? 0) > 0) {
    return { ok: false, reason: "cooldown" };
  }
  return { ok: true };
}

/**
 * @param {FittingStateEntry} stateEntry
 * @param {{ scene?: boolean, maint?: boolean, combatRound?: number|null, cooldownRounds?: number, active?: boolean, activeUntil?: number|null, flags?: object }} spend
 * @returns {FittingStateEntry}
 */
export function spendUse(stateEntry = {}, spend = {}) {
  const next = { ...stateEntry, flags: { ...(stateEntry.flags ?? {}), ...(spend.flags ?? {}) } };
  if (spend.scene) next.usesScene = (next.usesScene ?? 0) + 1;
  if (spend.maint) next.usesMaint = (next.usesMaint ?? 0) + 1;
  if (spend.combatRound != null) next.lastUsedRound = spend.combatRound;
  if (spend.cooldownRounds != null) next.cooldownRounds = spend.cooldownRounds;
  if (spend.active !== undefined) next.active = spend.active;
  if (spend.activeUntil !== undefined) next.activeUntil = spend.activeUntil;
  return next;
}

/**
 * State key for a fitting item.
 * @param {{ id?: string, _id?: string, system?: { effectId?: string } }} item
 * @returns {string}
 */
export function fittingStateKey(item) {
  const effectId = item?.system?.effectId ?? "";
  const id = item?.id ?? item?._id;
  if (item?.system?.stackable && id) return `${effectId}:${id}`;
  return effectId;
}

/** Black Ofuda empty VI suit combat profile (AWN pack text). */
export const EMPTY_SUIT_STATS = Object.freeze({
  ab: 6,
  hp: 15,
  soak: 15,
  move: 10,
  save: 14,
});

/**
 * Whether Black Ofuda empty-suit mode is on, with book combat stats.
 * @param {object} suitSystem
 * @returns {{ active: boolean, ab: number, hp: number, soak: number, move: number, save: number }}
 */
export function resolveEmptySuitMode(suitSystem) {
  const entry = getFittingState(suitSystem, "blackOfuda");
  return {
    active: !!entry.emptySuit,
    ...EMPTY_SUIT_STATS,
  };
}

/**
 * Overlay empty-suit combat numbers onto derived suit data.
 * @param {object} derived
 * @param {{ active: boolean, ab: number, hp: number, soak: number, move: number, save: number }} emptyMode
 * @returns {object}
 */
export function applyEmptySuitDerived(derived = {}, emptyMode) {
  const next = { ...derived, emptySuit: emptyMode };
  if (!emptyMode?.active) return next;
  return {
    ...next,
    soakMax: emptyMode.soak,
    attackBonus: emptyMode.ab,
    move: emptyMode.move,
    saveTarget: emptyMode.save,
  };
}
