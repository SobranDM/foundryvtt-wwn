const KIND_LABEL_KEYS = {
  attack: "WWN.Roll.Attack",
  damage: "WWN.Roll.Damage",
};

export function defaultRollRowLabel(kind) {
  const key = KIND_LABEL_KEYS[kind] ?? "WWN.Roll.Formula";
  return game.i18n.localize(key);
}

export function formatShockAcDetail(threshold) {
  if (threshold == null || threshold === "") return "";
  const ac = Number(threshold);
  if (Number.isNaN(ac)) return "";
  if (!Number.isFinite(ac)) return game.i18n.localize("WWN.Roll.ShockAcAnyDetail");
  return game.i18n.format("WWN.Roll.ShockAcDetail", { ac });
}

/**
 * Static Shock row when every compare AC is above the weapon threshold.
 * Keeps the Shock label and AC detail; total is 0 with an exceeded-AC hint.
 * @param {number|string|null} threshold
 * @param {{ insertAt?: number }} [options]
 */
export function buildNoShockRollRow(threshold, { insertAt = 2 } = {}) {
  return {
    label: game.i18n.localize("WWN.Roll.ShockBase"),
    detail: formatShockAcDetail(threshold),
    total: "0",
    breakdown: game.i18n.localize("WWN.Roll.ShockExceededHint"),
    strikeLabel: true,
    insertAt,
  };
}

/**
 * Attack-row AC detail. Names melee/ranged only when that setting is on.
 * @param {number|null} ac
 * @param {{ separateRanged?: boolean, acKind?: "melee"|"ranged" }} [options]
 * @returns {string}
 */
export function formatAttackAcDetail(ac, { separateRanged = false, acKind = "melee" } = {}) {
  if (ac == null || ac === "") return "";
  const n = Number(ac);
  if (!Number.isFinite(n)) return "";
  if (separateRanged) {
    return game.i18n.format("WWN.Roll.AttackAcKind", {
      kind: game.i18n.localize(acKind === "ranged" ? "WWN.Armor.ACRanged" : "WWN.Armor.ACMelee"),
      ac: n,
    });
  }
  return game.i18n.format("WWN.Roll.AttackAc", { ac: n });
}

/**
 * Trauma-row detail: vs target and rating, or rating only when untargeted.
 * @param {number|null} traumaTarget
 * @param {number|null} rating
 * @returns {string}
 */
export function formatTraumaDetail(traumaTarget, rating) {
  const r = Number(rating);
  const hasRating = Number.isFinite(r);
  if (traumaTarget == null || traumaTarget === "") {
    return hasRating ? game.i18n.format("WWN.Roll.TraumaRatingDetail", { rating: r }) : "";
  }
  const target = Number(traumaTarget);
  if (!Number.isFinite(target)) {
    return hasRating ? game.i18n.format("WWN.Roll.TraumaRatingDetail", { rating: r }) : "";
  }
  return game.i18n.format("WWN.Roll.TraumaDetail", {
    target,
    rating: hasRating ? r : "",
  });
}

function rollKind(roll) {
  return roll?.kind ?? roll?.options?.kind ?? "formula";
}

export async function buildRollRows(rolls = [], rollMeta = [], { isPrivate = false, extraRows = [] } = {}) {
  const rows = [];
  for (let i = 0; i < rolls.length; i++) {
    const roll = rolls[i];
    const meta = rollMeta[i] ?? {};
    const evaluated = !!roll?._evaluated;
    const privateRow = !!isPrivate;
    let tooltipHtml = "";
    if (evaluated && !privateRow && typeof roll.getTooltip === "function") {
      tooltipHtml = await roll.getTooltip();
    }
    rows.push({
      label: meta.label || defaultRollRowLabel(rollKind(roll)),
      detail: meta.detail ?? "",
      breakdown: privateRow ? "" : (meta.breakdown ?? ""),
      formula: privateRow ? "???" : String(roll?._formula ?? roll?.formula ?? ""),
      total: privateRow ? "?" : (evaluated && roll?.total != null ? String(roll.total) : ""),
      tooltipHtml,
    });
  }
  for (const extra of extraRows) {
    const row = {
      label: extra.label ?? "",
      message: extra.message ?? "",
      detail: extra.detail ?? "",
      breakdown: extra.breakdown ?? "",
      formula: "",
      total: extra.total ?? "",
      tooltipHtml: "",
      strikeLabel: !!extra.strikeLabel,
    };
    const at = Number.isInteger(extra.insertAt) ? extra.insertAt : rows.length;
    rows.splice(Math.min(Math.max(at, 0), rows.length), 0, row);
  }
  return rows;
}
