/**
 * Pure helpers for side-collapse turn advancement in group initiative.
 * Operates on plain turn descriptors so it can be unit-tested without Foundry.
 */

/**
 * @typedef {object} SideCollapseTurn
 * @property {string} id
 * @property {string|null} groupId
 * @property {boolean} [isDefeated]
 */

/**
 * Build ordered unique group ids from the combat turn order.
 * @param {SideCollapseTurn[]} turns
 * @returns {string[]}
 */
export function orderedGroupIdsFromTurns(turns) {
  const ids = [];
  const seen = new Set();
  for (const turn of turns) {
    const groupId = turn.groupId;
    if (!groupId || seen.has(groupId)) continue;
    seen.add(groupId);
    ids.push(groupId);
  }
  return ids;
}

/**
 * Index of the first turn belonging to `groupId`, optionally skipping defeated.
 * @param {SideCollapseTurn[]} turns
 * @param {string} groupId
 * @param {boolean} [skipDefeated=false]
 * @returns {number} turn index, or -1 if none
 */
export function firstTurnIndexForGroup(turns, groupId, skipDefeated = false) {
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.groupId !== groupId) continue;
    if (skipDefeated && t.isDefeated) continue;
    return i;
  }
  return -1;
}

/**
 * Whether every member of the group in `turns` is defeated (or group empty).
 * @param {SideCollapseTurn[]} turns
 * @param {string} groupId
 * @returns {boolean}
 */
export function isGroupFullyDefeated(turns, groupId) {
  const members = turns.filter(t => t.groupId === groupId);
  if (members.length === 0) return true;
  return members.every(t => t.isDefeated);
}

/**
 * Find the next (or previous) group turn index from the current turn.
 * @param {object} options
 * @param {SideCollapseTurn[]} options.turns
 * @param {number|null} options.currentTurnIndex
 * @param {1|-1} options.direction
 * @param {boolean} [options.skipDefeated=false]
 * @returns {{ kind: "turn", turnIndex: number } | { kind: "round" } | { kind: "none" }}
 */
export function findAdjacentGroupTurn({
  turns,
  currentTurnIndex,
  direction,
  skipDefeated = false
}) {
  if (!turns.length) return { kind: "none" };

  const current =
    currentTurnIndex != null && currentTurnIndex >= 0
      ? turns[currentTurnIndex]
      : null;
  const currentGroupId = current?.groupId ?? null;
  const groupIds = orderedGroupIdsFromTurns(turns);
  if (groupIds.length === 0) return { kind: "none" };

  let groupIndex = currentGroupId
    ? groupIds.indexOf(currentGroupId)
    : direction > 0
      ? -1
      : 0;

  if (groupIndex === -1 && direction < 0) {
    return { kind: "round" };
  }

  const step = direction > 0 ? 1 : -1;
  for (let i = groupIndex + step; i >= 0 && i < groupIds.length; i += step) {
    const groupId = groupIds[i];
    if (skipDefeated && isGroupFullyDefeated(turns, groupId)) continue;
    const turnIndex = firstTurnIndexForGroup(turns, groupId, skipDefeated);
    if (turnIndex === -1) continue;
    return { kind: "turn", turnIndex };
  }

  return { kind: "round" };
}
