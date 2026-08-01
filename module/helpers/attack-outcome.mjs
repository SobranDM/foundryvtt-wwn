/**
 * Pure attack-outcome helpers: nat 1/20, shock floor, apply rows, notice keys.
 */

/**
 * First active face from an evaluated Foundry roll, preferring a d20 term.
 * @param {Roll|object} attackRoll
 * @returns {number|null}
 */
export function naturalAttackDie(attackRoll) {
  const terms = attackRoll?.terms;
  if (!Array.isArray(terms)) return null;

  const readActive = (term) => {
    const results = term?.results;
    if (!Array.isArray(results)) return null;
    for (const result of results) {
      if (result?.active === false) continue;
      const n = Number(result.result ?? result);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  for (const term of terms) {
    if (Number(term?.faces) === 20) {
      const n = readActive(term);
      if (n != null) return n;
    }
  }
  for (const term of terms) {
    const n = readActive(term);
    if (n != null) return n;
  }
  return null;
}

/**
 * CB tag: treat unskilled (−2 / negative) as skill 0 for the attack roll.
 * @param {number} skillLevel
 * @param {string[]|unknown} tags
 * @returns {number}
 */
export function skillLevelWithCb(skillLevel, tags) {
  const level = Number(skillLevel);
  const base = Number.isFinite(level) ? level : -2;
  const hasCb = Array.isArray(tags) && tags.includes("CB");
  if (hasCb && base < 0) return 0;
  return base;
}

/**
 * Traumatic damage from floored (post-Godbound) hit damage × rating.
 * @param {number} flooredDamage
 * @param {number} rating
 * @returns {number}
 */
export function traumaticDamage(flooredDamage, rating) {
  return Number(flooredDamage) * Number(rating);
}

/**
 * @param {{
 *   attackTotal: number,
 *   naturalDie: number|null,
 *   targetAc: number|null,
 *   blockedByTl: boolean,
 * }} input
 * @returns {{ hit: boolean, reason: "tl"|"nat1"|"nat20"|"hit"|"miss"|"noTarget" }}
 */
export function resolveAttackHit({ attackTotal, naturalDie, targetAc, blockedByTl }) {
  if (blockedByTl) return { hit: false, reason: "tl" };
  if (naturalDie === 1) return { hit: false, reason: "nat1" };
  if (naturalDie === 20) return { hit: true, reason: "nat20" };
  if (targetAc == null || !Number.isFinite(targetAc)) return { hit: true, reason: "noTarget" };
  const hit = attackTotal >= targetAc;
  return { hit, reason: hit ? "hit" : "miss" };
}

/**
 * Hit damage after Shock floor (book: damage never below Shock on a hit).
 * @param {number} damage
 * @param {number|null} shock
 * @returns {{ value: number, floored: boolean }}
 */
export function applyShockFloor(damage, shock) {
  if (shock == null || !Number.isFinite(shock)) return { value: damage, floored: false };
  if (shock > damage) return { value: shock, floored: true };
  return { value: damage, floored: false };
}

/**
 * Build localized notice strings from resolution context.
 * @param {object} ctx
 * @param {(key: string, data?: object) => string} localize
 * @returns {string[]}
 */
export function buildAttackNotices(ctx, localize) {
  const notices = [];
  const L = (key, data) => (data ? localize(key, data) : localize(key));

  if (ctx.blockedByTl) {
    notices.push(L("WWN.Roll.NoticeTlBlocked"));
  }
  if (ctx.hitReason === "nat1") notices.push(L("WWN.Roll.NoticeNat1"));
  if (ctx.hitReason === "nat20") notices.push(L("WWN.Roll.NoticeNat20"));

  // Armor-ignore / target-AC notices are irrelevant when the attack never resolved vs AC.
  if (!ctx.blockedByTl) {
    for (const piece of ctx.ignored ?? []) {
      const reasonKey =
        piece.reason === "ap" ? "WWN.Roll.NoticeIgnoreAp"
          : piece.reason === "firearm" ? "WWN.Roll.NoticeIgnoreFirearm"
            : "WWN.Roll.NoticeIgnoreHighTl";
      notices.push(L(reasonKey, {
        name: piece.name,
        kind: piece.isShield ? L("WWN.Armor.shield") : L("WWN.Roll.NoticeArmor"),
      }));
    }

    if (ctx.ac != null && ctx.acKind) {
      notices.push(L("WWN.Roll.NoticeTargetAc", {
        ac: ctx.ac,
        kind: ctx.acKind === "ranged" ? L("WWN.Armor.ACRanged") : L("WWN.Armor.ACMelee"),
      }));
    }
  }

  if (ctx.shockSuppressedReason === "tl") {
    notices.push(L("WWN.Roll.NoticeNoShockTl"));
  } else if (ctx.shockSuppressedReason === "immune") {
    notices.push(L("WWN.Roll.NoticeNoShockImmune"));
  } else if (ctx.shockSuppressedReason === "ac") {
    notices.push(L("WWN.Roll.NoticeNoShockAc", {
      targetAc: ctx.shockTargetAc,
      threshold: ctx.shockThreshold,
    }));
  }

  if (ctx.shockFloored) {
    notices.push(L("WWN.Roll.NoticeShockFloor", { shock: ctx.shockTotal, damage: ctx.rawDamage }));
  }

  return notices;
}

/**
 * Assemble chat apply rows for a personal attack.
 * On hit: damageValue is already Shock-floored; damageFloored labels the row.
 * On miss: optional shock row.
 *
 * @param {object} input
 * @returns {object[]}
 */
export function buildAttackApplyRows({
  hit,
  blockedByTl,
  damageValue,
  damageFloored = false,
  straightValue,
  shockTotal,
  shockAppliesOnMiss,
  shockLabelAc,
  shockTargetAc,
  trauma,
  missDamageValue,
  labels,
}) {
  const applyRows = [];
  // Traumatic hit replaces normal damage — avoid offering both apply buttons.
  if (hit && trauma?.traumatic) {
    applyRows.push({
      id: "trauma",
      label: labels.trauma(trauma.rating),
      value: trauma.multiplied,
    });
    return applyRows;
  }

  if (hit) {
    applyRows.push({
      id: "damage",
      label: damageFloored ? labels.damageFloored : labels.damage,
      value: damageValue,
      altValue: straightValue,
      altLabel: straightValue != null ? labels.straight?.(straightValue) : null,
      shockFloored: !!damageFloored,
    });
  } else if (!blockedByTl && missDamageValue != null) {
    applyRows.push({
      id: "miss-damage",
      label: labels.missDamage,
      value: missDamageValue,
    });
  }

  if (!hit && !blockedByTl && shockTotal != null && shockAppliesOnMiss) {
    applyRows.push({
      id: "shock",
      label: shockTargetAc != null
        ? labels.shockVsTarget(shockTotal, shockLabelAc, shockTargetAc)
        : labels.shockVs(shockTotal, shockLabelAc),
      value: shockTotal,
    });
  }

  return applyRows;
}
