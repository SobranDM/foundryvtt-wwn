/**
 * Weapon tech level vs advanced armor / Ironhide immunity.
 */
import { isTruthyAeFlag } from "./combat-ae-flags.mjs";

/** Ironhide / basic+advanced plating: block TL ≤ this value (and unarmed). */
export const PRIMITIVE_IMMUNE_TL = 3;

/**
 * Whether the weapon skill/name counts as Punch / unarmed.
 * @param {Item|object} weapon
 * @returns {boolean}
 */
export function isUnarmedWeapon(weapon) {
  const skill = weapon?.system?.linkedSkill;
  const skillSlug = skill?.system?.slug || String(skill?.name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (skillSlug === "punch") return true;
  return /unarmed|fist|punch/i.test(weapon?.name ?? "");
}

/**
 * Effective weapon TL after Armsman-style melee TL4 bump.
 * @param {Actor|object} attacker
 * @param {Item|object} weapon
 * @param {"melee"|"ranged"} attackKind
 * @returns {number}
 */
export function effectiveWeaponTl(attacker, weapon, attackKind) {
  let tl = Number(weapon?.system?.tl);
  if (!Number.isFinite(tl)) tl = 0;
  const bump = isTruthyAeFlag(attacker?.system?.combat?.meleeCountsAsTl4);
  if (bump && attackKind === "melee" && !isUnarmedWeapon(weapon)) {
    tl = Math.max(tl, 4);
  }
  return tl;
}

/**
 * Highest TL the target is immune to (null = no TL immunity).
 * @param {Actor|object} target
 * @returns {number|null}
 */
export function targetImmuneWeaponTl(target) {
  if (!target) return null;
  if (isTruthyAeFlag(target.system?.combat?.immuneToPrimitiveWeapons)) {
    return PRIMITIVE_IMMUNE_TL;
  }
  const derived = target.system?.derived?.immuneWeaponTl;
  if (derived != null && Number.isFinite(Number(derived))) return Number(derived);
  return null;
}

/**
 * Whether the target's armor / Ironhide blocks this weapon.
 * @param {Actor|object} target
 * @param {number} effectiveTl
 * @param {{ isUnarmed?: boolean }} [options]
 * @returns {boolean}
 */
export function targetBlocksWeapon(target, effectiveTl, { isUnarmed = false } = {}) {
  const immuneTl = targetImmuneWeaponTl(target);
  if (immuneTl == null) return false;
  if (isUnarmed) return true;
  return effectiveTl <= immuneTl;
}

/**
 * Full gate used by attack / shock resolution.
 * @param {Actor|object} attacker
 * @param {Actor|object} target
 * @param {Item|object} weapon
 * @param {"melee"|"ranged"} attackKind
 * @returns {{ blocked: boolean, effectiveTl: number, immuneTl: number|null }}
 */
export function resolveWeaponTlGate(attacker, target, weapon, attackKind) {
  const effectiveTl = effectiveWeaponTl(attacker, weapon, attackKind);
  const immuneTl = targetImmuneWeaponTl(target);
  const blocked = targetBlocksWeapon(target, effectiveTl, { isUnarmed: isUnarmedWeapon(weapon) });
  return { blocked, effectiveTl, immuneTl };
}

/**
 * Trauma die formula with optional attacker dieMod (Killing Blow).
 * @param {string} weaponDie
 * @param {number|string} dieMod
 * @returns {string}
 */
export function traumaDieFormula(weaponDie, dieMod) {
  const die = weaponDie || "1d6";
  const mod = Number(dieMod) || 0;
  return mod ? `${die}+${mod}` : die;
}
