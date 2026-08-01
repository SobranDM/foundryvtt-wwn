/**
 * Per-attack target AC: omit armor/shield pieces ignored by firearm / high TL / AP.
 */
import { isNpc } from "./actor-types.mjs";
import {
  effectiveWeaponTl,
  IGNORABLE_ARMOR_TL,
} from "./weapon-tl.mjs";
import { npcHasEquippedArmor } from "../derivations/ac.mjs";

/**
 * @param {Item|object} piece armor item
 * @param {{ firearm: boolean, effectiveTl: number, hasAp: boolean }} ctx
 * @returns {{ ignore: boolean, reason: "ap"|"firearm"|"highTl"|null }}
 */
export function shouldIgnoreArmorPiece(piece, { firearm, effectiveTl, hasAp }) {
  if (piece?.system?.magical) return { ignore: false, reason: null };
  const tl = Number(piece?.system?.tl);
  const pieceTl = Number.isFinite(tl) ? tl : 0;
  if (hasAp) return { ignore: true, reason: "ap" };
  if ((firearm || effectiveTl >= 4) && pieceTl <= IGNORABLE_ARMOR_TL) {
    return { ignore: true, reason: firearm ? "firearm" : "highTl" };
  }
  return { ignore: false, reason: null };
}

/**
 * @param {Actor|object} actor
 * @returns {object[]}
 */
function equippedArmor(actor) {
  const items = actor?.items;
  if (!items) return [];
  const list = typeof items.filter === "function" ? items.filter((i) => i.type === "armor" && i.system?.equipped)
    : Array.from(items).filter((i) => i.type === "armor" && i.system?.equipped);
  return list;
}

/**
 * Recompute ascending AC for one attack, omitting ignored gear pieces. Always keeps Dex.
 *
 * @param {Actor|object} attacker
 * @param {Actor|object} target
 * @param {Item|object} weapon
 * @param {"melee"|"ranged"} attackKind
 * @param {{ separateRanged?: boolean }} [options]
 * @returns {{
 *   ac: number|null,
 *   acKind: "melee"|"ranged",
 *   ignored: Array<{ id: string, name: string, reason: string, isShield: boolean }>,
 *   effectiveTl: number,
 * }}
 */
export function resolveTargetAcForAttack(attacker, target, weapon, attackKind, options = {}) {
  const separateRanged = options.separateRanged
    ?? (typeof game !== "undefined" && game.settings?.get?.("wwn", "separateRangedAC"));
  const useSeparate = !!separateRanged;
  const acKind = attackKind === "ranged" && useSeparate ? "ranged" : "melee";
  const effectiveTl = effectiveWeaponTl(attacker, weapon, attackKind);
  const firearm = !!weapon?.system?.firearm;
  const tags = weapon?.system?.tags ?? [];
  const hasAp = Array.isArray(tags) && tags.includes("AP");

  const ignored = [];
  const armors = equippedArmor(target);
  const omitIds = new Set();
  for (const piece of armors) {
    const { ignore, reason } = shouldIgnoreArmorPiece(piece, { firearm, effectiveTl, hasAp });
    if (!ignore) continue;
    omitIds.add(piece.id ?? piece._id ?? piece.name);
    ignored.push({
      id: piece.id ?? piece._id ?? "",
      name: piece.name ?? "Armor",
      reason,
      isShield: piece.system?.type === "shield",
    });
  }

  // NPC manual AC with no equipped armor: nothing to strip.
  if (isNpc(target) && !npcHasEquippedArmor(target)) {
    const tc = target.system?.combat?.ac;
    const meleeAc = tc?.melee?.value;
    const rangedAc = tc?.ranged?.value;
    const ac = acKind === "ranged"
      ? (Number.isFinite(rangedAc) ? rangedAc : meleeAc)
      : (Number.isFinite(meleeAc) ? meleeAc : rangedAc);
    return {
      ac: Number.isFinite(ac) ? ac : null,
      acKind,
      ignored,
      effectiveTl,
    };
  }

  // Power armor: suit AC lives on system.ac / derived.ac (no combat.ac).
  if (target?.type === "powerArmor") {
    const ac = Number(target.system?.derived?.ac ?? target.system?.ac);
    return {
      ac: Number.isFinite(ac) ? ac : null,
      acKind,
      ignored: [],
      effectiveTl,
    };
  }

  const system = target.system;
  // Factions and other non-combat actors have no combat.ac schema.
  if (!system?.combat?.ac) {
    return {
      ac: null,
      acKind,
      ignored: [],
      effectiveTl,
    };
  }

  const acState = system.combat.ac;
  const dexMod = system.abilities?.dex?.mod ?? 0;
  let baseMelee = acState.base ?? 10;
  let baseRanged = acState.base ?? 10;
  let shieldBonus = 0;
  let shieldBase = 0;

  for (const a of armors) {
    const id = a.id ?? a._id ?? a.name;
    if (omitIds.has(id)) continue;

    const acBase = a.system.acValue ?? a.system.ac ?? 0;
    const acRangedBase = a.system.acRangedValue ?? a.system.acRanged ?? acBase;
    const modBonus = a.system.modValue ?? a.system.mod ?? 0;
    const isShield = a.system.type === "shield";
    if (isShield) {
      shieldBonus = 1 + modBonus;
      shieldBase = acBase + modBonus;
      continue;
    }
    baseMelee = Math.max(baseMelee, acBase + modBonus);
    const hasExplicitRanged = a.system.acRanged != null || a.system.acRangedValue != null;
    const rangedBase = useSeparate && hasExplicitRanged ? acRangedBase : acBase;
    baseRanged = Math.max(baseRanged, rangedBase + modBonus);
  }

  const assemble = (base, modePath) => {
    const withArmor = base + dexMod + (acState.mod ?? 0) + (modePath?.mod ?? 0);
    if (shieldBonus > 0) {
      const shieldOnly = shieldBase + dexMod + (acState.mod ?? 0) + (modePath?.mod ?? 0);
      return Math.max(shieldOnly, withArmor + shieldBonus);
    }
    return withArmor;
  };

  let meleeValue = assemble(baseMelee, acState.melee);
  let rangedValue = useSeparate ? assemble(baseRanged, acState.ranged) : meleeValue;

  // Innate AC floor when no *remaining* body armor after ignores.
  const hasBody = armors.some(
    (a) => a.system?.type !== "shield" && !omitIds.has(a.id ?? a._id ?? a.name)
  );
  if (!hasBody) {
    const innateMin = system.combat?.innateAc?.min ?? 0;
    if (innateMin > 0) {
      const innateAssemble = (modePath) => {
        const withInnate = innateMin + dexMod + (acState.mod ?? 0) + (modePath?.mod ?? 0);
        if (shieldBonus > 0) {
          const shieldOnly = shieldBase + dexMod + (acState.mod ?? 0) + (modePath?.mod ?? 0);
          return Math.max(shieldOnly, withInnate + shieldBonus);
        }
        return withInnate;
      };
      meleeValue = Math.max(meleeValue, innateAssemble(acState.melee));
      if (useSeparate) rangedValue = Math.max(rangedValue, innateAssemble(acState.ranged));
    }
  }

  if (!useSeparate) rangedValue = meleeValue;

  const ac = acKind === "ranged" ? rangedValue : meleeValue;
  return {
    ac: Number.isFinite(ac) ? ac : null,
    acKind,
    ignored,
    effectiveTl,
  };
}
