/**
 * Typed Roll subclasses. The roll kind is explicit — never inferred from
 * formula shape — and Godbound conversion lives ONLY on WwnDamageRoll.
 */

/** Base WWN roll: carries an explicit kind and part metadata. */
export class WwnRoll extends foundry.dice.Roll {
  /** @type {"check"|"save"|"skill"|"attack"|"damage"|"formula"} */
  get kind() {
    return this.options.kind ?? "formula";
  }
}

export class WwnAttackRoll extends WwnRoll {
  /** @override */
  get kind() {
    return "attack";
  }
}

export class WwnSkillRoll extends WwnRoll {
  /** @override */
  get kind() {
    return "skill";
  }
}

/**
 * Damage roll. The only roll type eligible for Godbound damage conversion.
 */
export class WwnDamageRoll extends WwnRoll {
  /** @override */
  get kind() {
    return "damage";
  }

  /** Convert a single rolled value via the Godbound damage chart. */
  static convertValue(value) {
    if (value <= 1) return 0;
    if (value <= 5) return 1;
    if (value <= 9) return 2;
    return 4;
  }

  /**
   * Godbound-converted total: each die result converts individually;
   * flat modifiers convert as a single value.
   * Recurses into ParentheticalTerm / PoolTerm so wrapped formulas are not dropped.
   * @returns {{ total: number, breakdown: string[] }}
   */
  get godboundTotal() {
    if (!this._evaluated) return { total: 0, breakdown: [] };
    let total = 0;
    const breakdown = [];
    let flat = 0;

    const walk = (terms) => {
      for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        if (term instanceof foundry.dice.terms.DiceTerm) {
          for (const result of term.results) {
            if (!result.active) continue;
            const converted = WwnDamageRoll.convertValue(result.result);
            total += converted;
            breakdown.push(`${result.result} → ${converted}`);
          }
          continue;
        }
        if (term instanceof foundry.dice.terms.NumericTerm) {
          const operator = terms[i - 1];
          const sign = operator?.operator === "-" ? -1 : 1;
          flat += sign * term.number;
          continue;
        }
        if (term instanceof foundry.dice.terms.ParentheticalTerm && term.roll?.terms) {
          walk(term.roll.terms);
          continue;
        }
        if (term instanceof foundry.dice.terms.PoolTerm && Array.isArray(term.rolls)) {
          for (const nested of term.rolls) {
            if (nested?.terms) walk(nested.terms);
          }
        }
      }
    };

    walk(this.terms);
    if (flat !== 0) {
      const converted = WwnDamageRoll.convertValue(flat);
      total += converted;
      breakdown.push(`${flat} → ${converted}`);
    }
    return { total, breakdown };
  }
}
