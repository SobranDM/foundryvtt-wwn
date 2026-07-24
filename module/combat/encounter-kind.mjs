/**
 * Pure helpers for combat encounter kind and type segregation.
 * A combat is classified only from combatants already in THAT combat.
 */

/** @typedef {"empty"|"starship"|"faction"|"personal"} EncounterKind */

/**
 * Normalize an actor type string for encounter classification.
 * @param {string|null|undefined} type
 * @returns {"starship"|"faction"|"personal"|null}
 */
export function classifyActorType(type) {
  if (!type) return null;
  if (type === "starship") return "starship";
  if (type === "faction") return "faction";
  // character, pc, monster, npc, powerArmor, and any other personal combatants
  return "personal";
}

/**
 * @param {Iterable<{ actor?: { type?: string }|null, actorId?: string }|null|undefined>|null|undefined} combatants
 * @returns {EncounterKind}
 */
export function encounterKindFromCombatants(combatants) {
  let kind = /** @type {EncounterKind} */ ("empty");
  for (const c of combatants ?? []) {
    const type = c?.actor?.type ?? null;
    const classed = classifyActorType(type);
    if (!classed) continue;
    if (kind === "empty") {
      kind = classed;
      continue;
    }
    if (kind !== classed) {
      // Mixed combat should not occur if segregation works; treat as personal fallback.
      return "personal";
    }
  }
  return kind;
}

/**
 * @param {EncounterKind} kind
 * @param {string} actorType
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canAddActorTypeToKind(kind, actorType) {
  const adding = classifyActorType(actorType);
  if (!adding) return { ok: false, reason: "unknown" };

  if (kind === "empty") return { ok: true };

  if (adding === "starship") {
    if (kind !== "starship") return { ok: false, reason: "starshipIntoNonStarship" };
    return { ok: true };
  }

  if (adding === "faction") {
    if (kind !== "faction") return { ok: false, reason: "factionIntoNonFaction" };
    return { ok: true };
  }

  // personal (PC, monster, powerArmor, …)
  if (kind === "starship" || kind === "faction") {
    return { ok: false, reason: "personalIntoSpecial" };
  }
  return { ok: true };
}

/**
 * @param {{ combatants?: Iterable<object> }|null|undefined} combat
 * @param {string} actorType
 * @returns {{ ok: boolean, reason?: string, kind: EncounterKind }}
 */
export function canAddActorTypeToCombat(combat, actorType) {
  const kind = encounterKindFromCombatants(combat?.combatants);
  const result = canAddActorTypeToKind(kind, actorType);
  return { ...result, kind };
}
