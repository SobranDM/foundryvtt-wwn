/**
 * Pure Soak → remainder split for modular power armor damage.
 */

/**
 * @param {number} amount Positive damage after multiplier
 * @param {number} soakValue Current suit Soak pool
 * @returns {{ soakRemaining: number, soakTaken: number, overflow: number }}
 */
export function splitSoakDamage(amount, soakValue) {
  const dmg = Math.max(0, Math.floor(amount ?? 0));
  const soak = Math.max(0, Math.floor(soakValue ?? 0));
  const soakTaken = Math.min(soak, dmg);
  return {
    soakTaken,
    soakRemaining: soak - soakTaken,
    overflow: dmg - soakTaken,
  };
}
