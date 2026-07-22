import { COMMITMENT_LENGTHS, COMMITMENT_KEYS } from "../config/power-subtypes.mjs";

/**
 * Localized label for one pool commitment tier.
 * @param {{ cost: number, length: string, note?: string }} option
 */
export function formatCommitmentOption(option) {
  const lengthLabel = game.i18n.localize(COMMITMENT_LENGTHS[option.length] ?? option.length);
  let text = game.i18n.format("WWN.Power.CommitmentOption", {
    cost: option.cost,
    length: lengthLabel,
  });
  if (option.note?.trim()) text += ` (${option.note.trim()})`;
  return text;
}

/**
 * @param {{ cost: number, length: string, note?: string }[]} options
 * @returns {string}
 */
export function formatCommitmentSummary(options) {
  const paid = options?.filter((o) => o.cost > 0) ?? [];
  if (!paid.length) return "";
  return paid.map((o) => formatCommitmentOption(o)).join(", ");
}

/**
 * Powers tab: length labels only (e.g. "Scene, Day"), without cost.
 * @param {{ cost: number, length: string, note?: string }[]} options
 */
export function formatCommitmentChoicesTab(options) {
  const paid = options?.filter((o) => o.cost > 0) ?? [];
  if (!paid.length) return "";
  return paid
    .map((o) => game.i18n.localize(COMMITMENT_LENGTHS[o.length] ?? o.length))
    .join(", ");
}

/**
 * Tooltip for tab commitment choices (includes option notes).
 * @param {{ cost: number, length: string, note?: string }[]} options
 */
export function formatCommitmentChoicesTabTitle(options) {
  const paid = options?.filter((o) => o.cost > 0) ?? [];
  if (!paid.length) return "";
  return paid
    .map((o) => {
      let label = game.i18n.localize(COMMITMENT_LENGTHS[o.length] ?? o.length);
      if (o.note?.trim()) label += ` (${o.note.trim()})`;
      return label;
    })
    .join(", ");
}

/**
 * Powers tab: committed amounts per length (e.g. "2 for the Scene, 1 for the Day").
 * @param {object} poolCommitted
 */
export function formatPoolCommittedTab(poolCommitted) {
  if (!poolCommitted) return "";
  const parts = [];
  for (const length of ["none", "active", "scene", "day"]) {
    const amount = poolCommitted[length] ?? 0;
    if (amount > 0) {
      const lengthLabel = game.i18n.localize(COMMITMENT_LENGTHS[length] ?? length);
      parts.push(game.i18n.format("WWN.Power.CommitmentOption", { cost: amount, length: lengthLabel }));
    }
  }
  return parts.join(", ");
}

const TAB_POOL_COMMITTED_ORDER = ["scene", "day", "active", "none"];

/** @param {object} poolCommitted */
function poolCommittedTabEntries(poolCommitted) {
  if (!poolCommitted) return [];
  return TAB_POOL_COMMITTED_ORDER
    .map((length) => ({ length, amount: poolCommitted[length] ?? 0 }))
    .filter((e) => e.amount > 0);
}

/** Powers tab compact committed display (e.g. "5 / 3"). @param {object} poolCommitted */
export function formatPoolCommittedTabCompact(poolCommitted) {
  const entries = poolCommittedTabEntries(poolCommitted);
  if (!entries.length) return "";
  return entries.map((e) => e.amount).join(" / ");
}

/** Powers tab committed tooltip with one line per length. @param {object} poolCommitted */
export function formatPoolCommittedTabTooltip(poolCommitted) {
  const entries = poolCommittedTabEntries(poolCommitted);
  if (!entries.length) return "";
  return entries
    .map((e) => {
      const lengthLabel = game.i18n.localize(COMMITMENT_LENGTHS[e.length] ?? e.length);
      return game.i18n.format("WWN.Power.CommittedForLength", { cost: e.amount, length: lengthLabel });
    })
    .join("\n");
}

/** @param {object} poolCommitted */
export function poolCommittedTotal(poolCommitted) {
  if (!poolCommitted) return 0;
  return COMMITMENT_KEYS.reduce((sum, k) => sum + (poolCommitted[k] ?? 0), 0);
}

/** @param {string} scope @param {string} length @param {boolean} isActive */
export function shouldReclaimCommitment(scope, length, isActive) {
  if (length === "none") return false;
  if (scope === "day") return length !== "none";
  if (length === "scene") return true;
  if (length === "active") return !isActive;
  return false;
}
