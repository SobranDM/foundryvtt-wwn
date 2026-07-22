import { isPc, isNpc } from "../helpers/actor-types.mjs";
/**
 * Initiative derivation. Individual and group (side) dice/mod are separate AE
 * targets applied in the initial phase; this derivation folds DEX into each
 * mode's flat value and mirrors individual fields for legacy roll data keys.
 */

/**
 * @param {Actor} actor
 */
export function deriveInitiative(actor) {
  const init = actor.system.combat.initiative;
  const dex = isPc(actor) ? actor.system.abilities?.dex?.mod ?? 0 : 0;
  const npcInit = isNpc(actor) ? actor.system.combat.initMod ?? 0 : 0;

  init.individual.value = (init.individual.mod ?? 0) + dex + npcInit;
  init.group.value = (init.group.mod ?? 0) + dex + npcInit;

  init.value = init.individual.value;
  init.roll = init.individual.roll;
  init.mod = init.individual.mod;
}

/**
 * Highest group.mod among combatants on a side (Alert +1 bonuses do not stack).
 * @param {Combatant[]} members
 * @returns {number}
 */
export function getSideGroupInitiativeMod(members) {
  let sideMod = 0;
  for (const member of members) {
    const mod = member.actor?.system.combat?.initiative?.group?.mod ?? 0;
    if (mod > sideMod) sideMod = mod;
  }
  return sideMod;
}
