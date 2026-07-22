/** Canonical PC / NPC actor types, plus reverse aliases (`pc` / `npc`). */

export const PC_TYPES = Object.freeze(["character", "pc"]);
export const NPC_TYPES = Object.freeze(["monster", "npc"]);

/** Types shown in Actor.createDialog (aliases hidden). */
export const CREATABLE_ACTOR_TYPES = Object.freeze(["character", "monster", "faction"]);

/**
 * @param {string|{type?: string}|null|undefined} actorOrType
 * @returns {boolean}
 */
export function isPc(actorOrType) {
  const type = typeof actorOrType === "string" ? actorOrType : actorOrType?.type;
  return PC_TYPES.includes(type);
}

/**
 * @param {string|{type?: string}|null|undefined} actorOrType
 * @returns {boolean}
 */
export function isNpc(actorOrType) {
  const type = typeof actorOrType === "string" ? actorOrType : actorOrType?.type;
  return NPC_TYPES.includes(type);
}
