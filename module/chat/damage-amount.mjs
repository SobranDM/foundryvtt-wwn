/**
 * Resolve a damage amount from a chat message for context-menu apply.
 * Prefers flags.wwn.applyRows (when trusted / roll-backed), then damage-kind
 * rolls, then rolls[1] on attack cards.
 *
 * @param {object} message  ChatMessage-like object with rolls / getFlag
 * @returns {number|null}
 */
export function getChatDamageAmount(message) {
  if (!message) return null;

  const rows = getApplyRows(message);
  if (Array.isArray(rows) && rows.length) {
    const preferred = rows.find((r) => r.id === "trauma")
      ?? rows.find((r) => r.id === "damage")
      ?? rows.find((r) => r.id === "miss-damage")
      ?? rows.find((r) => r.id === "shock")
      ?? rows[0];
    const resolved = resolveApplyRowAmount(message, preferred, { useAlt: false });
    if (resolved != null) return resolved;
  }

  return getDamageRollTotal(message);
}

/**
 * @param {object} message
 * @returns {object[]}
 */
export function getApplyRows(message) {
  if (!message) return [];
  const rows = typeof message.getFlag === "function"
    ? message.getFlag("wwn", "applyRows")
    : message.flags?.wwn?.applyRows;
  return Array.isArray(rows) ? rows : [];
}

/**
 * Damage-kind roll total, or attack-card rolls[1], or single non-attack roll.
 * @param {object} message
 * @returns {number|null}
 */
export function getDamageRollTotal(message) {
  const rolls = message?.rolls ?? [];
  const damageRoll = rolls.find((r) => r?.options?.kind === "damage" || r?.kind === "damage");
  if (damageRoll != null && Number.isFinite(Number(damageRoll.total))) {
    return Number(damageRoll.total);
  }

  // Attack cards: [attack, damage, …]
  if (rolls.length > 1 && Number.isFinite(Number(rolls[1].total))) {
    return Number(rolls[1].total);
  }

  // Pure damage / formula cards with a single roll
  if (rolls.length === 1) {
    const kind = rolls[0]?.options?.kind ?? rolls[0]?.kind;
    if (kind === "attack") return null;
    if (Number.isFinite(Number(rolls[0].total))) return Number(rolls[0].total);
  }

  return null;
}

/**
 * Totals of all evaluated rolls on the message.
 * @param {object} message
 * @returns {number[]}
 */
export function getMessageRollTotals(message) {
  return (message?.rolls ?? [])
    .map((r) => Number(r?.total))
    .filter((n) => Number.isFinite(n));
}

/**
 * Whether the message author is a trusted source for non-roll-backed apply amounts
 * (GM, or owner of the speaker actor).
 * @param {object} message
 * @returns {boolean}
 */
export function isTrustedApplySource(message) {
  if (!message) return false;
  const author = message.author
    ?? (typeof game !== "undefined" ? game.users?.get(message.user) : null);
  if (!author) return false;
  if (author.isGM) return true;
  const speaker = message.speaker;
  if (!speaker) return false;
  const actor = typeof ChatMessage !== "undefined" && ChatMessage.getSpeakerActor
    ? ChatMessage.getSpeakerActor(speaker)
    : null;
  return !!actor?.testUserPermission?.(author, "OWNER");
}

/**
 * Resolve an apply-row amount, preferring roll totals for damage and rejecting
 * inflated / untrusted flag values for non-roll-backed rows.
 *
 * @param {object} message
 * @param {object} row
 * @param {{ useAlt?: boolean }} [options]
 * @returns {number|null}
 */
export function resolveApplyRowAmount(message, row, { useAlt = false } = {}) {
  if (!row) return null;
  const flagged = Number(useAlt ? row.altValue : row.value);
  if (!Number.isFinite(flagged)) return null;

  const rollTotal = getDamageRollTotal(message);
  const rollTotals = getMessageRollTotals(message);

  // Primary damage: rolls are authoritative unless shock-floor raised the apply value.
  if (row.id === "damage" && !useAlt) {
    const trusted = isTrustedApplySource(message)
      || (typeof game !== "undefined" && !!game.user?.isGM);
    if (row.shockFloored) {
      if (trusted) return flagged;
      // Untrusted floored flags: fall back to the damage roll when present.
      return rollTotal;
    }
    if (rollTotal != null) return rollTotal;
    if (trusted) return flagged;
    return null;
  }

  // Straight (alt) damage and other rows must match a roll total or a trusted author.
  if (useAlt && rollTotal != null && flagged === rollTotal) return flagged;
  if (rollTotals.includes(flagged)) return flagged;
  if (isTrustedApplySource(message) || (typeof game !== "undefined" && game.user?.isGM)) {
    return flagged;
  }
  return null;
}
