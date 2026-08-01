/**
 * Validate player→GM group-initiative socket payloads.
 * Pure helpers so Node tests can cover the rules without Foundry runtime.
 *
 * Protocol: clients request a GM-side re-roll for a combatant’s group
 * (`combatId` + `combatantId`). Clients never supply initiative totals.
 */

/**
 * Keep only `_id` + finite `initiative` on each update row.
 * @param {unknown} updates
 * @returns {Array<{_id: string, initiative: number}>}
 */
export function sanitizeInitiativeUpdates(updates) {
  if (!Array.isArray(updates)) return [];
  const out = [];
  for (const row of updates) {
    if (!row || typeof row !== "object") continue;
    const id = row._id;
    const initiative = Number(row.initiative);
    if (typeof id !== "string" || !id) continue;
    if (!Number.isFinite(initiative)) continue;
    out.push({ _id: id, initiative });
  }
  return out;
}

/**
 * @param {object} params
 * @param {string|null|undefined} params.combatId
 * @param {string|null|undefined} params.activeCombatId
 * @param {unknown} params.combatantGroupUpdates
 * @param {unknown} params.combatantUpdates
 * @param {Set<string>|Iterable<string>} params.groupIds
 * @param {Set<string>|Iterable<string>} params.combatantIds
 * @param {((combatantId: string) => boolean)|null} [params.canUpdateCombatant]
 * @returns {{ ok: true, combatantGroupUpdates: object[], combatantUpdates: object[] } | { ok: false, reason: string }}
 * @deprecated Prefer validateGroupInitiativeRollRequest — clients must not supply totals.
 */
export function validateGroupInitiativePayload({
  combatId,
  activeCombatId,
  combatantGroupUpdates,
  combatantUpdates,
  groupIds,
  combatantIds,
  canUpdateCombatant = null,
}) {
  if (!activeCombatId || combatId !== activeCombatId) {
    return { ok: false, reason: "combatId" };
  }

  const groups = sanitizeInitiativeUpdates(combatantGroupUpdates);
  const combatants = sanitizeInitiativeUpdates(combatantUpdates);
  if (!groups.length && !combatants.length) {
    return { ok: false, reason: "empty" };
  }

  const groupIdSet = groupIds instanceof Set ? groupIds : new Set(groupIds);
  const combatantIdSet = combatantIds instanceof Set ? combatantIds : new Set(combatantIds);

  for (const row of groups) {
    if (!groupIdSet.has(row._id)) return { ok: false, reason: "unknownGroup" };
  }
  for (const row of combatants) {
    if (!combatantIdSet.has(row._id)) return { ok: false, reason: "unknownCombatant" };
    if (canUpdateCombatant && !canUpdateCombatant(row._id)) {
      return { ok: false, reason: "permission" };
    }
  }

  return { ok: true, combatantGroupUpdates: groups, combatantUpdates: combatants };
}

/**
 * Validate a roll-request socket payload (GM re-rolls initiative).
 *
 * @param {object} params
 * @param {string|null|undefined} params.combatId
 * @param {string|null|undefined} params.activeCombatId
 * @param {string|null|undefined} params.combatantId
 * @param {Set<string>|Iterable<string>} params.combatantIds
 * @param {((combatantId: string) => boolean)|null} [params.canUpdateCombatant]
 * @param {((combatantId: string) => string[]|Iterable<string>|null)|null} [params.getGroupMemberIds]
 *   Returns combatant ids in the same initiative group (and older sibling, if any).
 * @returns {{ ok: true, combatantId: string } | { ok: false, reason: string }}
 */
export function validateGroupInitiativeRollRequest({
  combatId,
  activeCombatId,
  combatantId,
  combatantIds,
  canUpdateCombatant = null,
  getGroupMemberIds = null,
}) {
  if (!activeCombatId || combatId !== activeCombatId) {
    return { ok: false, reason: "combatId" };
  }
  if (typeof combatantId !== "string" || !combatantId) {
    return { ok: false, reason: "combatantId" };
  }

  const combatantIdSet = combatantIds instanceof Set ? combatantIds : new Set(combatantIds);
  if (!combatantIdSet.has(combatantId)) {
    return { ok: false, reason: "unknownCombatant" };
  }

  const memberIds = getGroupMemberIds
    ? [...(getGroupMemberIds(combatantId) ?? [])]
    : [combatantId];
  if (!memberIds.length) {
    return { ok: false, reason: "emptyGroup" };
  }

  if (canUpdateCombatant) {
    for (const id of memberIds) {
      if (!canUpdateCombatant(id)) {
        return { ok: false, reason: "permission" };
      }
    }
  }

  return { ok: true, combatantId };
}
