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
 * Base number of dice in a skill check's dice pool. All skills are 2d6
 * unless a focus/power bonus adds extra dice (see `getFocusSkillDiceBonus`).
 */
export const BASE_SKILL_DICE_COUNT = 2;

export class RollParts {
  /** @type {Array<{value: number|string, label: string}>} */
  parts = [];

  /** @param {object|null} [rollData] Actor roll data used to resolve `@skill` in part values. */
  constructor(rollData = null) {
    this.rollData = rollData;
  }

  /**
   * Add a part. Zero numeric values and blank strings are skipped.
   * @param {number|string} value
   * @param {string} label   Localized label shown in the tooltip
   * @returns {this}
   */
  add(value, label) {
    if (value === null || value === undefined) return this;
    value = normalizeRollPart(value);
    value = this.#resolveAtRefs(value);
    if (typeof value === "number" && value === 0) return this;
    if (typeof value === "string" && !value.trim()) return this;
    this.parts.push({ value, label });
    return this;
  }

  /** Substitute `@attr` from roll data so tooltips show numbers, not `@stab`. */
  #resolveAtRefs(value) {
    if (typeof value !== "string" || !value.includes("@") || !this.rollData) return value;
    const Roll = foundry.dice?.Roll;
    if (typeof Roll?.replaceFormulaData !== "function") return value;
    const replaced = Roll.replaceFormulaData(value, this.rollData, { missing: "0" });
    return normalizeRollPart(replaced);
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
