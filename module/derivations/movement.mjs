import { isPc } from "../helpers/actor-types.mjs";
/**
 * Movement derivation: combat / exploration / daily speeds from base,
 * with optional encumbrance-driven auto-calculation (PCs only).
 * Must run after encumbrance derivation.
 */

/**
 * @param {Actor} actor
 */
export function deriveMovement(actor) {
  const system = actor.system;
  const movement = system.movement;
  const bonus = movement.bonus ?? 0;

  let base = (movement.base?.value ?? 30) + bonus;

  if (isPc(actor) && game.settings.get("wwn", "showMovement") && system.encumbrance) {
    const rateKey = game.settings.get("wwn", "movementRate") ?? "movewwn";
    const tiers = CONFIG.WWN.movementRates[rateKey] ?? CONFIG.WWN.movementRates.movewwn;
    const { readied, stowed } = system.encumbrance;
    const rv = Number(readied.value);
    const rm = readied.max;
    const sv = Number(stowed.value);
    const sm = stowed.max;

    if (rv <= rm && sv <= sm) base = tiers[0] + bonus;
    else if (rv <= rm + 2 && sv <= sm) base = tiers[1] + bonus;
    else if (rv <= rm && sv <= sm + 4) base = tiers[1] + bonus;
    else if (rv <= rm + 2 && sv <= sm + 4) base = tiers[2] + bonus;
    else if (rv <= rm + 4 && sv <= sm) base = tiers[2] + bonus;
    else if (rv <= rm && sv <= sm + 8) base = tiers[2] + bonus;
    else base = 0;
  }

  movement.combat = base;
  movement.exploration = base * 3;
  movement.daily = base / 5;
}
