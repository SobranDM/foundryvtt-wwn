/**
 * Starship combat initiative helpers (Foundry-facing).
 */
import { isPc } from "../../helpers/actor-types.mjs";
import { bestAttributeMod } from "../../helpers/starship-crew.mjs";

/**
 * Resolve bridge actor for initiative (sync uuid lookup).
 * @param {Actor} starship
 * @returns {Actor|null}
 */
export function bridgeActorForInitiative(starship) {
  const uuid = starship?.system?.stations?.bridge?.actor;
  if (!uuid) return null;
  try {
    return fromUuidSync(uuid);
  } catch {
    return null;
  }
}

/**
 * Initiative modifier: better of Int/Dex of bridge crew, or NPC skill, or 0.
 * @param {Actor} starship
 * @returns {{ mod: number, isPcBridge: boolean, label: string }}
 */
export function starshipInitiativeMod(starship) {
  const bridge = bridgeActorForInitiative(starship);
  if (bridge) {
    const mod = bestAttributeMod(bridge.system?.abilities) ?? 0;
    return {
      mod,
      isPcBridge: isPc(bridge),
      label: bridge.name,
    };
  }
  // NPC formula station: no live actor — use 0 mod (formula rolled separately if needed)
  const formula = starship?.system?.stations?.bridge?.formula?.trim();
  if (formula) {
    return { mod: 0, isPcBridge: false, label: "formula" };
  }
  return { mod: 0, isPcBridge: false, label: "none" };
}

/**
 * Tie-break: PC bridge ships sort before NPC ships when totals equal.
 * Used as a small initiative nudge after rolling (PC +0.1) or in sort comparator.
 * @param {Combatant} a
 * @param {Combatant} b
 * @returns {number} sort delta (negative => a before b in descending initiative)
 */
export function compareStarshipInitiativeTie(a, b) {
  const aPc = a.actor?.type === "starship" ? starshipInitiativeMod(a.actor).isPcBridge : false;
  const bPc = b.actor?.type === "starship" ? starshipInitiativeMod(b.actor).isPcBridge : false;
  if (aPc === bPc) return 0;
  // Descending initiative: higher first. On tie, PC should win → treat PC as slightly higher.
  return aPc ? -1 : 1;
}

/**
 * Build initiative roll formula string for a starship combatant.
 * @param {Actor} starship
 */
export function starshipInitiativeFormula(starship) {
  const { mod } = starshipInitiativeMod(starship);
  const m = Number(mod) || 0;
  return m >= 0 ? `1d8 + ${m}` : `1d8 - ${Math.abs(m)}`;
}
