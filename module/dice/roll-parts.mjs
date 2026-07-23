/**
 * RollParts: builds roll formulas from labeled parts.
 *
 * Non-zero modifier rule: numeric parts with value 0 are never added to the
 * formula or the tooltip, and labels can never desync from values because
 * both render from the same structure.
 */
/** Coerce \"+1\" / \"-2\" strings to numbers for roll assembly. */
export function normalizeRollPart(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const unsigned = trimmed.replace(/^\+/, "");
  if (/^-?\d+(\.\d+)?$/.test(unsigned)) return Number(unsigned);
  return trimmed;
}

/**
 * Resolve a skill's dice pool to a real dice formula.
 *
 * Bare integers like `"2"` / `"3"` must not pass through {@link normalizeRollPart}
 * as flat modifiers — that yields skill+attribute with no 2d6/3d6kh2 pool.
 * Map known counts onto the system skill-dice options; otherwise default to 2d6.
 *
 * @param {string|number|null|undefined} skillDice
 * @returns {string}
 */
export function resolveSkillDiceFormula(skillDice) {
  const raw = String(skillDice ?? "").trim();
  if (/\dd\d/i.test(raw)) return raw;

  const n = Number(raw);
  if (n === 3) return "3d6kh2";
  if (n === 4) return "4d6kh2";
  if (n === 1) return "1d6";
  return "2d6";
}

/**
 * Number of dice in a skill pool formula (e.g. 3d6kh2 → 3, bare "4" → 4).
 * @param {string|number|null|undefined} skillDice
 * @returns {number}
 */
export function skillDiceCount(skillDice) {
  const formula = resolveSkillDiceFormula(skillDice);
  const match = formula.match(/^(\d+)d/i);
  return match ? Number(match[1]) : 2;
}

export class RollParts {
  /** @type {Array<{value: number|string, label: string}>} */
  parts = [];

  /**
   * Add a part. Zero numeric values and blank strings are skipped.
   * @param {number|string} value
   * @param {string} label   Localized label shown in the tooltip
   * @returns {this}
   */
  add(value, label) {
    if (value === null || value === undefined) return this;
    value = normalizeRollPart(value);
    if (typeof value === "number" && value === 0) return this;
    if (typeof value === "string" && !value.trim()) return this;
    this.parts.push({ value, label });
    return this;
  }

  /** Wrap formula fragments that already contain operators. */
  #formatPart(value, isFirst) {
    const text = String(value);
    if (isFirst) return text;
    if (typeof value === "string" && /[+\-]/.test(text)) return `(${text})`;
    return text;
  }

  /** Assemble the formula string. */
  formula() {
    let formula = "";
    for (const part of this.parts) {
      const fragment = this.#formatPart(part.value, !formula);
      if (!formula) {
        formula = fragment;
        continue;
      }
      if (typeof part.value === "number" && part.value < 0) {
        formula += ` - ${Math.abs(part.value)}`;
      } else {
        formula += ` + ${fragment}`;
      }
    }
    return formula || "0";
  }

  /** Flavor breakdown, e.g. "1d20 + 2 (Attack Bonus) - 2 (Armor Penalty)". */
  breakdown() {
    let out = "";
    for (const p of this.parts) {
      const labeled =
        typeof p.value === "number" && p.value < 0
          ? `${Math.abs(p.value)}${p.label ? ` (${p.label})` : ""}`
          : p.label
            ? `${p.value} (${p.label})`
            : `${p.value}`;
      if (!out) {
        out = typeof p.value === "number" && p.value < 0 ? `-${labeled}` : labeled;
        continue;
      }
      if (typeof p.value === "number" && p.value < 0) out += ` - ${labeled}`;
      else out += ` + ${labeled}`;
    }
    return out;
  }

  get isEmpty() {
    return this.parts.length === 0;
  }
}
