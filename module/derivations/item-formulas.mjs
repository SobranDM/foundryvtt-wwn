/**
 * Merge item-local AE formula mod buckets into base damage/shock strings.
 *
 * WWN convention:
 * - add + numeric mod: append " + N" (e.g. 1d6 + 1 → 1d6 + 1)
 * - add + formula/dice mod: append " + {mod}"
 * - upgrade: take lexicographically higher primary die (1d8 beats 1d6)
 */

const DIE_PATTERN = /(\d*)d(\d+)/i;

/** Extract the die size from the first die term, or 0 if none. */
function primaryDieSize(formula) {
  const match = String(formula ?? "").match(DIE_PATTERN);
  return match ? Number(match[2]) : 0;
}

/** Replace the primary die in a formula with a larger die (upgrade), preserving count. */
function upgradePrimaryDie(base, mod) {
  const baseMatch = String(base ?? "").match(DIE_PATTERN);
  const modMatch = String(mod ?? "").match(DIE_PATTERN);
  if (!baseMatch || !modMatch) return mod || base || "";
  const baseSize = Number(baseMatch[2]);
  const modSize = Number(modMatch[2]);
  if (modSize <= baseSize) return base || "";
  const count = baseMatch[1] || "1";
  const upgraded = `${count}d${modSize}`;
  return String(base).replace(DIE_PATTERN, upgraded);
}

/**
 * @param {string} base   Persisted formula string
 * @param {string|number} mod  AE mod bucket value
 * @param {string} [mode] Change mode: add | upgrade
 * @returns {string}
 */
export function mergeFormulaMod(base, mod, mode = "add") {
  const baseStr = String(base ?? "").trim();
  const modStr = String(mod ?? "").trim();
  if (!modStr) return baseStr;

  if (mode === "upgrade") {
    return upgradePrimaryDie(baseStr, modStr) || baseStr;
  }

  const numericMod = modStr.replace(/^\+/, "");
  if (/^-?\d+(\.\d+)?$/.test(numericMod)) {
    const n = Number(numericMod);
    if (!baseStr) return String(n);
    return `${baseStr} + ${n}`;
  }

  if (!baseStr) return modStr;
  return `${baseStr} + ${modStr}`;
}
