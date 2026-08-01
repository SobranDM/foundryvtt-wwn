/**
 * Skipped-maintenance failure table for modular power armor (AWN).
 * Pure helpers; no Foundry imports.
 */

/**
 * PDF-style outcomes when maintenance intervals are skipped.
 * Roll 1d6 + skipped count (caller passes total).
 *
 * @param {number} rollTotal result of 1d6 + skipped intervals
 * @returns {{ id: string, label: string, apply: { disableRandomFitting?: boolean, cutRuntimeHalf?: boolean, soakMaxHalf?: boolean, depower?: boolean } }}
 */
export function resolveMaintenanceFailure(rollTotal) {
  const n = Number(rollTotal) || 0;
  if (n <= 3) {
    return { id: "glitch", label: "Minor glitch — no lasting effect", apply: {} };
  }
  if (n <= 5) {
    return {
      id: "runtime",
      label: "Power cell drains — remaining runtime halved",
      apply: { cutRuntimeHalf: true },
    };
  }
  if (n <= 7) {
    return {
      id: "fitting",
      label: "A random non-integral fitting fails (disabled)",
      apply: { disableRandomFitting: true },
    };
  }
  if (n <= 9) {
    return {
      id: "soak",
      label: "Plating stress — Soak maximum halved until maintained",
      apply: { soakMaxHalf: true },
    };
  }
  return {
    id: "shutdown",
    label: "Suit depowers and will not restart until maintained",
    apply: { depower: true },
  };
}

/**
 * Pick a random non-integral, non-disabled armor fitting to disable.
 * @param {Array<{ id?: string, _id?: string, type?: string, system?: object }>} items
 * @param {(max: number) => number} [rng] returns 0..max-1
 * @returns {string|null} item id
 */
export function pickRandomFittingToDisable(items, rng = (max) => Math.floor(Math.random() * max)) {
  const candidates = (items ?? []).filter(
    (i) => i.type === "armorFitting" && !i.system?.disabled && !i.system?.integral,
  );
  if (!candidates.length) return null;
  const pick = candidates[rng(candidates.length)];
  return pick?.id ?? pick?._id ?? null;
}
