/**
 * Parse free-text ship weapon qualities (e.g. "AP 20, Ammo 4, Flak").
 */

/**
 * @param {string|null|undefined} qualities
 * @returns {{
 *   ap: number,
 *   ammo: number|null,
 *   flak: boolean,
 *   clumsy: boolean,
 *   cloud: boolean,
 * }}
 */
export function parseWeaponQualities(qualities) {
  const text = String(qualities ?? "");
  const lower = text.toLowerCase();

  let ap = 0;
  const apMatch = text.match(/\bAP\s*(\d+)\b/i);
  if (apMatch) ap = Number(apMatch[1]) || 0;

  let ammo = null;
  const ammoMatch = text.match(/\bAmmo\s*(\d+)\b/i);
  if (ammoMatch) ammo = Number(ammoMatch[1]);

  return {
    ap,
    ammo,
    flak: /\bflak\b/i.test(lower),
    clumsy: /\bclumsy\b/i.test(lower),
    cloud: /\bcloud\b/i.test(lower),
  };
}

/**
 * Attack modifiers from weapon qualities vs target hull class.
 * @param {ReturnType<typeof parseWeaponQualities>} q
 * @param {string} targetHullClass
 * @returns {number}
 */
export function qualityAttackModifier(q, targetHullClass) {
  let mod = 0;
  if (q.clumsy && targetHullClass === "fighter") mod -= 4;
  return mod;
}
