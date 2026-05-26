export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampNumber(value, min, max) {
  const number = finiteNumber(value, min);
  const low = finiteNumber(min, 0);
  const high = finiteNumber(max, low);
  return Math.min(Math.max(number, low), high);
}

export function normalizeCriticalResistance(value) {
  const number = Math.floor(finiteNumber(value, 0));
  return number > 0 ? number : 0;
}

export function computeHpDamage({ hpValue = 0, hpMax = 0, amount = 0, multiplier = 1 } = {}) {
  const rawAmount = finiteNumber(parseInt(amount), 0);
  const appliedAmount = Math.floor(rawAmount * finiteNumber(multiplier, 1));
  const currentHp = finiteNumber(hpValue, 0);
  const maxHp = finiteNumber(hpMax, 0);
  const excessDamage = appliedAmount > 0 && currentHp - appliedAmount < 0
    ? Math.abs(currentHp - appliedAmount)
    : 0;

  return {
    rawAmount,
    appliedAmount,
    preDamageHp: { value: currentHp, max: maxHp },
    excessDamage,
    nextHp: clampNumber(currentHp - appliedAmount, 0, maxHp),
  };
}

export function computeWoundPointsAfterExcess({ wpValue = 0, wpMax = 0, excessDamage = 0 } = {}) {
  return clampNumber(finiteNumber(wpValue, 0) - finiteNumber(excessDamage, 0), 0, finiteNumber(wpMax, 0));
}

export function buildBelowZeroWoundFormula({ currentInjuries = 0, excessDamage = 0, critResistance = 0 } = {}) {
  return `1d12 + ${Math.max(0, Math.floor(finiteNumber(currentInjuries, 0)))} + ${Math.max(0, Math.floor(finiteNumber(excessDamage, 0)))} - ${normalizeCriticalResistance(critResistance)}`;
}
