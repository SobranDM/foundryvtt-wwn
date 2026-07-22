/**
 * Guess which classEdge names should be pre-checked from a free-text Class field.
 */

/** Canonical classEdge names available in system packs. */
export const CLASS_EDGE_CATALOG = [
  "Full Warrior",
  "Partial Warrior",
  "Full Expert",
  "Partial Expert",
  "Full High Mage",
  "Partial High Mage",
  "Full Elementalist",
  "Partial Elementalist",
  "Full Necromancer",
  "Partial Necromancer",
  "Full Invoker",
  "Partial Invoker",
  "Accursed",
  "Bard",
  "Beastmaster",
  "Blood Priest",
  "Duelist",
  "Healer",
  "Mageslayer",
  "Skinshifter",
  "Thought Noble",
  "Vowed",
  "Wise",
];

const PARTIAL_ONLY = new Set([
  "Accursed",
  "Bard",
  "Beastmaster",
  "Blood Priest",
  "Duelist",
  "Healer",
  "Mageslayer",
  "Skinshifter",
  "Thought Noble",
  "Vowed",
  "Wise",
]);

const TRADITIONS = ["High Mage", "Elementalist", "Necromancer", "Invoker"];
const BASE = ["Warrior", "Expert"];

/** Labels matched as whole words (longest first so "Full Warrior" beats "Warrior"). */
const WORD_LABELS = [
  ...CLASS_EDGE_CATALOG,
  ...TRADITIONS,
  ...BASE,
  "Mage",
].sort((a, b) => b.length - a.length);

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORD_LABEL_RE = new RegExp(`\\b(?:${WORD_LABELS.map(escapeRegExp).join("|")})\\b`, "gi");

/**
 * Expand space-juxtaposed class names ("Warrior Vowed") into separate tokens.
 * @param {string} text
 * @returns {string[]} empty when fewer than two labels matched
 */
function expandJuxtaposedClassNames(text) {
  const matches = String(text ?? "").match(WORD_LABEL_RE);
  if (!matches || matches.length < 2) return [];
  return matches.map((m) => {
    const hit = WORD_LABELS.find((l) => l.toLowerCase() === m.toLowerCase());
    return hit ?? m;
  });
}

/**
 * @param {string} classField
 * @returns {string[]} tokens
 */
export function tokenizeClassField(classField) {
  const parts = String(classField ?? "")
    .split(/[/&,+]|(?:\s+and\s+)/i)
    .map((t) => t.trim())
    .filter(Boolean);

  const tokens = [];
  for (const part of parts) {
    const expanded = expandJuxtaposedClassNames(part);
    if (expanded.length >= 2) tokens.push(...expanded);
    else tokens.push(part);
  }
  return tokens;
}

/**
 * @param {string} token
 * @returns {{ forceFull?: boolean, forcePartial?: boolean, core: string }}
 */
function parseToken(token) {
  let t = token.trim();
  let forceFull = false;
  let forcePartial = false;
  if (/^full\s+/i.test(t)) {
    forceFull = true;
    t = t.replace(/^full\s+/i, "");
  } else if (/^partial\s+/i.test(t)) {
    forcePartial = true;
    t = t.replace(/^partial\s+/i, "");
  }
  // Adventurer is not a classEdge
  if (/^adventurer$/i.test(t)) return { core: "" };
  return { forceFull, forcePartial, core: t };
}

/**
 * Match a core label to catalog name(s).
 * @param {string} core
 * @param {{ forceFull?: boolean, forcePartial?: boolean }} flags
 * @param {boolean} multiToken  Adventurer-style multi pick → prefer Partials
 * @returns {string[]}
 */
function resolveCore(core, flags, multiToken) {
  if (!core) return [];
  const lower = core.toLowerCase();

  // Exact catalog hit (e.g. token already "Partial Warrior")
  for (const name of CLASS_EDGE_CATALOG) {
    if (name.toLowerCase() === lower) return [name];
  }

  for (const name of PARTIAL_ONLY) {
    if (name.toLowerCase() === lower) return [name];
  }

  // Mage alone → High Mage tradition
  let label = core;
  if (/^mage$/i.test(core)) label = "High Mage";

  for (const base of [...BASE, ...TRADITIONS]) {
    if (base.toLowerCase() !== label.toLowerCase()) continue;
    if (flags.forceFull) return [`Full ${base}`];
    if (flags.forcePartial || multiToken) return [`Partial ${base}`];
    // Single token with no Full/Partial cue → Full
    return [`Full ${base}`];
  }

  // Fuzzy contains
  for (const name of CLASS_EDGE_CATALOG) {
    if (name.toLowerCase().includes(lower) && lower.length > 3) return [name];
  }
  return [];
}

/**
 * @param {string} classField
 * @returns {string[]} classEdge names to pre-check
 */
export function precheckClassEdgesFromClassField(classField) {
  const tokens = tokenizeClassField(classField);
  if (!tokens.length) return [];
  const multi = tokens.length >= 2;
  const selected = new Set();
  for (const token of tokens) {
    const parsed = parseToken(token);
    for (const name of resolveCore(parsed.core, parsed, multi)) {
      selected.add(name);
    }
  }
  return [...selected];
}
