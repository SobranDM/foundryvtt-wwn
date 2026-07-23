/**
 * Pilot resolution helpers for modular power armor.
 * Pure helpers; UUID resolution is injected.
 */

/**
 * @param {string|null|undefined} pilotUuid
 * @param {string[]} trainedPilots
 * @returns {boolean}
 */
export function isPilotTrained(pilotUuid, trainedPilots = []) {
  if (!pilotUuid) return false;
  return (trainedPilots ?? []).includes(pilotUuid);
}

/**
 * @param {{ actor?: string|null }} pilot
 * @param {(uuid: string) => object|null|undefined} resolveActor
 * @returns {{ mode: "actor"|"unassigned", actor?: object, uuid?: string, broken?: boolean }}
 */
export function resolvePilot(pilot, resolveActor) {
  const uuid = pilot?.actor ?? null;
  if (!uuid) return { mode: "unassigned" };
  const actor = resolveActor?.(uuid) ?? null;
  if (!actor) return { mode: "unassigned", uuid, broken: true };
  return { mode: "actor", actor, uuid };
}

/**
 * @param {object} system
 * @returns {object}
 */
function cloneSystem(system) {
  return JSON.parse(JSON.stringify(system));
}

/**
 * Build a shallow merged view for rolls: pilot system fields + suit overlays.
 * Does not mutate pilot or suit.
 *
 * @param {object|null} pilotActor
 * @param {object} suitDerived  from derivePowerArmorEffects
 * @param {object} [suitSystem] suit.system
 */
export function buildMergedRollData(pilotActor, suitDerived, suitSystem = {}) {
  const pilotSystem = pilotActor?.system ? cloneSystem(pilotActor.system) : {};

  if (suitDerived.effectiveStrength != null && pilotSystem.abilities?.str) {
    pilotSystem.abilities.str.value = suitDerived.effectiveStrength;
    if (suitDerived.effectiveStrengthMod != null) {
      pilotSystem.abilities.str.mod = suitDerived.effectiveStrengthMod;
    }
  }

  return {
    ...pilotSystem,
    suit: {
      ac: suitDerived.ac,
      soak: suitSystem.soak ?? { value: suitDerived.soakMax, max: suitDerived.soakMax },
      powered: suitDerived.powered,
      inert: suitDerived.inert,
      frameType: suitSystem.frameType ?? "",
    },
    ac: suitDerived.ac,
  };
}

/**
 * Whether a check type should use untrained disadvantage.
 * @param {"attack"|"save"|"skill"|"other"} kind
 */
export function usesTrainingDisadvantage(kind) {
  return kind === "attack" || kind === "save" || kind === "skill";
}
