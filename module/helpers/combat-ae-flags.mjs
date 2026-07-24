/**
 * Pure helpers for ephemeral combat / starship Active Effect flags.
 */

/** Boolean combat AE override paths (ephemeral prepareBaseData fields). */
export const BOOLEAN_COMBAT_AE_KEYS = new Set([
  "system.combat.immuneToSurprise",
  "system.combat.treatAllMeleeAsAcTen",
  "system.combat.immuneToShock",
  "system.combat.autoStabilize",
  "system.combat.meleeCountsAsTl4",
  "system.combat.immuneToPrimitiveWeapons",
  "system.combat.endOfTurnAdjacentShock",
  "system.combat.missAfterFirstMeleeHit",
  "system.starship.spikeDrillDoublePilot",
]);

/**
 * Coerce AE override values for boolean fields.
 * Foundry unguided cast uses `!!raw`, which makes `"false"` truthy — fix that.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function coerceAeBoolean(raw) {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null) return false;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "") return false;
    if (s === "true" || s === "1") return true;
  }
  return !!raw;
}

/**
 * Truthy check for already-applied combat flags (booleans or legacy strings).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTruthyAeFlag(value) {
  return coerceAeBoolean(value);
}

/** @param {Actor|object|null|undefined} actor */
export function isImmuneToSurprise(actor) {
  return isTruthyAeFlag(actor?.system?.combat?.immuneToSurprise);
}

/** @param {Actor|object|null|undefined} actor */
export function hasAutoStabilize(actor) {
  return isTruthyAeFlag(actor?.system?.combat?.autoStabilize);
}

/**
 * Cancelable hook + flag check for surprise / Execution Attack flows.
 * Returns true when the actor cannot be surprised.
 * @param {Actor} actor
 * @param {object} [ctx]
 * @returns {boolean}
 */
export function checkSurpriseImmunity(actor, ctx = {}) {
  if (!actor) return false;
  const payload = { immune: isImmuneToSurprise(actor), ...ctx };
  if (typeof Hooks !== "undefined") {
    Hooks.call("wwn.checkSurpriseImmunity", actor, payload);
  }
  return !!payload.immune;
}

/**
 * Detect Heavy (or similar) damage sources for Die Hard carve-outs.
 * @param {string} [source]
 * @returns {boolean}
 */
export function isHeavyDamageSource(source = "") {
  return /heavy/i.test(String(source));
}
