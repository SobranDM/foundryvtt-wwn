/**
 * Pure math for the Project actor's optional "suggested cost" calculator and
 * its contribution/funding derivations. No Foundry imports — safe for
 * `node --test`.
 *
 * IMPORTANT: this module never validates feasibility (mage skill, Godbound
 * Words, etc.) — it only computes a suggested total cost/time from the
 * scale/area (WWN) or scope/magnitude/opposition (Godbound) inputs the GM
 * supplies. That is a deliberate scope boundary; do not add gating here.
 */

/** WWN Building Magical Workings area multipliers (rulebook pp.90-92). */
export const WWN_AREA_MULTIPLIERS = {
  room: 1,
  building: 4,
  village: 16,
  city: 64,
  region: 256,
};

/** Baseline construction time for any Working, before the per-5-points add-on. */
export const WWN_BASE_MONTH_WEEKS = 4;

/** Godbound scope base costs (rulebook pp.126-130), offered as calculator presets. */
export const GODBOUND_SCOPE_BASE = {
  village: 1,
  city: 2,
  region: 4,
  nation: 8,
  realm: 16,
};

/**
 * Parse a comma-separated list of per-effect point values (multi-effect
 * Workings) into an array of positive numbers. Blank/invalid entries are
 * dropped rather than throwing, since this feeds a live sheet input.
 * @param {string} csv
 * @returns {number[]}
 */
export function parseEffectPoints(csv) {
  return String(csv ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Combine multiple simultaneous Working effects per RAW: highest single
 * element's cost + half of the rest (rounded up). A single value degrades
 * to itself (rest sum is 0).
 * @param {number[]} effectPoints
 * @returns {number}
 */
export function combineWwnDifficulty(effectPoints) {
  if (!effectPoints?.length) return 0;
  const sorted = [...effectPoints].sort((a, b) => b - a);
  const [highest, ...rest] = sorted;
  const restSum = rest.reduce((sum, n) => sum + n, 0);
  return highest + Math.ceil(restSum / 2);
}

/**
 * Suggested WWN Working cost/time.
 * @param {{ effectPoints: string|number[], areaKey: string, doubleSilver: boolean }} input
 * @returns {{ difficulty: number, cost: number, weeks: number }}
 */
export function computeWwnCost({ effectPoints, areaKey, doubleSilver }) {
  const points = Array.isArray(effectPoints) ? effectPoints : parseEffectPoints(effectPoints);
  const baseDifficulty = combineWwnDifficulty(points);
  const areaMultiplier = WWN_AREA_MULTIPLIERS[areaKey] ?? 1;
  const difficulty = baseDifficulty * areaMultiplier;
  const cost = 1000 * difficulty;
  let weeks = WWN_BASE_MONTH_WEEKS + Math.ceil(difficulty / 5);
  if (doubleSilver) weeks = Math.ceil(weeks / 2);
  return { difficulty, cost, weeks };
}

/**
 * Suggested Godbound Fact-change cost.
 * `(scope base + ward rating + resistance rating) x magnitude multiplier`.
 * @param {{ scopeBase: number, wardRating: number, resistanceRating: number, magnitudeMult: number }} input
 * @returns {{ cost: number }}
 */
export function computeGodboundCost({ scopeBase, wardRating, resistanceRating, magnitudeMult }) {
  const base = (Number(scopeBase) || 0) + (Number(wardRating) || 0) + (Number(resistanceRating) || 0);
  const mult = Number(magnitudeMult) || 1;
  return { cost: base * mult };
}

/**
 * Sum contribution items' committed values.
 * @param {Array<{ influenceCommitted?: number, dominionSpent?: number, resourceContributed?: number }>} contributions
 */
export function sumContributions(contributions) {
  let influence = 0;
  let dominion = 0;
  let resource = 0;
  for (const c of contributions ?? []) {
    influence += Number(c?.influenceCommitted) || 0;
    dominion += Number(c?.dominionSpent) || 0;
    resource += Number(c?.resourceContributed) || 0;
  }
  return { influence, dominion, resource, total: influence + dominion };
}

/**
 * The funding total relevant to a given game line: Godbound counts committed
 * Influence + permanently spent Dominion; WWN counts contributed silver
 * (optional/unused for most WWN tables, since RAW treats Working cost as a
 * single collective party expense).
 * @param {"wwn"|"godbound"} gameLine
 * @param {{ influence: number, dominion: number, resource: number, total: number }} sums
 */
export function fundedTotalFor(gameLine, sums) {
  return gameLine === "godbound" ? sums.total : sums.resource;
}

/** Clamp a funded/max ratio to [0, 1]; 0 when max is not positive. */
export function fundedFraction(total, max) {
  if (!(max > 0)) return 0;
  return Math.min(1, Math.max(0, total / max));
}

/**
 * Should a Godbound project auto-lapse right now? Pure arithmetic — not a
 * feasibility check. Only ever suggests moving forward into "lapsed"; never
 * suggests reverting out of it (a GM does that by hand).
 * @param {{ gameLine: string, status: string, fundedTotal: number, resourceMax: number }} input
 */
export function shouldAutoLapse({ gameLine, status, fundedTotal, resourceMax }) {
  if (gameLine !== "godbound") return false;
  if (status !== "inProgress" && status !== "maintained") return false;
  if (!(resourceMax > 0)) return false;
  return fundedTotal < resourceMax;
}
