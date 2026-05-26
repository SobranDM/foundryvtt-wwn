export const THRESHOLD_CONTEXT_FLAG = "thresholdAttack";
export const THRESHOLD_CONTEXT_SCHEMA_VERSION = 1;
export const THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE = "normal-attack-damage";

export function normalizeInjuryResistance(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

export function getActorInjuryResistance(actor) {
  return normalizeInjuryResistance(actor?.system?.injuryResistance);
}

export function getTargetAac(actor) {
  const value = Number(actor?.system?.aac?.value);
  return Number.isFinite(value) ? value : null;
}

export function computeEdge({ attackTotal, targetAac, naturalD20 } = {}) {
  if (Number(naturalD20) === 20) {
    return { eligible: true, edge: 3, source: "natural20", margin: null };
  }

  const attack = Number(attackTotal);
  const aac = Number(targetAac);
  if (!Number.isFinite(attack) || !Number.isFinite(aac)) {
    return { eligible: true, edge: 0, source: "unknown", margin: null };
  }

  const margin = attack - aac;
  if (margin < 0) {
    return { eligible: false, edge: 0, source: "miss", margin, reason: "attack-margin-below-aac" };
  }
  if (margin >= 10) return { eligible: true, edge: 2, source: "margin10", margin };
  if (margin >= 5) return { eligible: true, edge: 1, source: "margin5", margin };
  return { eligible: true, edge: 0, source: "hit", margin };
}

export function computeInjuryTargetNumber({ injuryResistance = 0, edge = 0 } = {}) {
  return 8 + normalizeInjuryResistance(injuryResistance) - Number(edge || 0);
}

export function evaluateInjuryDie({ dieResult, targetNumber } = {}) {
  const die = Number(dieResult);
  const target = Number(targetNumber);
  if (!Number.isFinite(die) || !Number.isFinite(target)) return false;
  return target <= 10 && die >= target;
}

export function isPositiveNormalAttackDamage(context = {}) {
  return context?.actionFamily === THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE
    && context?.damageKind === "normal"
    && Number(context?.amount) > 0
    && Number(context?.multiplier) > 0;
}

export function resolveTrustedThresholdAction({ attackContext, actionId, domAction, amount, multiplier } = {}) {
  const action = attackContext?.actions?.[actionId];
  if (!action) return { action: null, reason: "unknown-threshold-action" };
  if (action.domAction && action.domAction !== domAction) {
    return { action: null, reason: "threshold-action-dom-mismatch" };
  }
  if (action.amount !== undefined && Number(action.amount) !== Number(amount)) {
    return { action: null, reason: "threshold-action-amount-mismatch" };
  }
  if (action.multiplier !== undefined && Number(action.multiplier) !== Number(multiplier)) {
    return { action: null, reason: "threshold-action-multiplier-mismatch" };
  }
  return { action, reason: null };
}

export function maxWeaponDamage(formula) {
  if (typeof formula !== "string" || formula.trim() === "") return null;
  const normalized = formula.replace(/\s+/g, "").toLowerCase();
  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];
  let total = 0;
  let found = false;

  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const diceMatch = body.match(/^(\d*)d(\d+)$/);
    if (diceMatch) {
      const count = diceMatch[1] === "" ? 1 : Number(diceMatch[1]);
      const faces = Number(diceMatch[2]);
      if (Number.isFinite(count) && Number.isFinite(faces)) {
        total += sign * count * faces;
        found = true;
      }
      continue;
    }
    const number = Number(body);
    if (Number.isFinite(number)) {
      total += sign * number;
      found = true;
    }
  }

  return found ? total : null;
}

export function computeWeaponPressure(formula) {
  const maximum = maxWeaponDamage(formula);
  if (maximum === null) return 0;
  if (maximum <= 6) return -1;
  if (maximum >= 10) return 1;
  return 0;
}

export function computeHealthPressure({ hpValue, hpMax } = {}) {
  const value = Number(hpValue);
  const max = Number(hpMax);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return value > 0 && value <= max / 2 ? 1 : 0;
}

export function computeExistingInjuryPressure(injuries) {
  const count = Math.max(0, Math.floor(Number(injuries) || 0));
  return Math.min(2, count);
}

export function computeTotalPressure({ weaponPressure = 0, healthPressure = 0, injuryPressure = 0 } = {}) {
  return Math.min(4, Number(weaponPressure || 0) + Number(healthPressure || 0) + Number(injuryPressure || 0));
}

export function computeSeverityBand(score) {
  const value = Number(score);
  if (value <= 3) return { band: "Minor", persistent: false };
  if (value <= 5) return { band: "Moderate", persistent: true };
  if (value <= 7) return { band: "Serious", persistent: true };
  return { band: "Severe", persistent: true };
}

export function buildThresholdAttemptKey({ messageUuid, targetUuid, actionFamily } = {}) {
  return [messageUuid, targetUuid, actionFamily]
    .filter(Boolean)
    .map((part) => String(part)
      .replaceAll("%", "%25")
      .replaceAll(".", "%2E")
      .replaceAll("|", "%7C"))
    .join("|");
}

export function isValidAttackContext(context = {}) {
  return context?.schemaVersion === THRESHOLD_CONTEXT_SCHEMA_VERSION
    && context?.createdBy === "wwn.sendAttackRoll"
    && Number.isFinite(Number(context?.attackTotal))
    && Number.isFinite(Number(context?.naturalD20))
    && !!context?.sourceActorId
    && !!context?.sourceItemId
    && (!!context?.sourceItemSnapshot || typeof context?.sourceItemName === "string")
    && typeof context?.baseWeaponDamageFormula === "string"
    && context?.actions?.normalDamage?.actionFamily === THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE;
}
