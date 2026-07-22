/**
 * PC Hit Dice derivation and roll formula assembly.
 *
 * Structured data: hitDice { die, perLevelMod, staticMod }.
 * When owned classEdges provide hdGrant, those set base die / perLevelMod.
 * perLevelTotal = perLevelMod + CON mod (auto-derived).
 * Display: XdY+M where M = level × perLevelTotal + staticMod.
 * Roll: max(1dY+Z, 1) repeated per level, plus staticMod once.
 */

import { combineHdGrants } from "./class-edge-hd.mjs";

/**
 * Derive display values onto system.hitDice (PC only).
 * @param {Actor} actor
 */
export function deriveHitDice(actor) {
  const system = actor.system;
  const hd = system.hitDice;
  const level = Math.max(system.details?.level ?? 1, 1);
  const conMod = system.abilities?.con?.mod ?? 0;

  const edges = actor.items?.filter((i) => i.type === "classEdge") ?? [];
  const fromEdges = combineHdGrants(edges);
  hd.fromEdges = !!fromEdges;
  if (fromEdges) {
    // Ephemeral overlays for display (same pattern as combat.ab); do not treat
    // as sheet-editable when classEdges own the base die / per-level mod.
    hd.die = fromEdges.die;
    hd.perLevelMod = fromEdges.perLevelMod;
  }

  hd.perLevelTotal = (hd.perLevelMod ?? 0) + conMod;
  const flat = level * hd.perLevelTotal + (hd.staticMod ?? 0);
  const sign = flat >= 0 ? "+" : "−";
  hd.display = flat === 0 ? `${level}${hd.die}` : `${level}${hd.die}${sign}${Math.abs(flat)}`;
}

/**
 * Assemble the clamped per-level roll formula.
 * @param {Actor} actor
 * @returns {string}
 */
export function hitDiceRollFormula(actor) {
  const system = actor.system;
  const hd = system.hitDice;
  const level = Math.max(system.details?.level ?? 1, 1);
  const perLevel = hd.perLevelTotal ?? 0;
  const die = hd.die ?? "d6";

  let term = `1${die}`;
  if (perLevel > 0) term += `+${perLevel}`;
  else if (perLevel < 0) term += `${perLevel}`;

  const terms = Array.from({ length: level }, () => `max(${term}, 1)`);
  let formula = terms.join(" + ");
  const staticMod = hd.staticMod ?? 0;
  if (staticMod > 0) formula += ` + ${staticMod}`;
  else if (staticMod < 0) formula += ` - ${Math.abs(staticMod)}`;
  return formula;
}
