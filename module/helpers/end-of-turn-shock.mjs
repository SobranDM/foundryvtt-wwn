/**
 * End-of-turn adjacent Shock for Savage Fray L1.
 */
import { WwnDice } from "../dice/dice.mjs";
import { WwnDamageRoll } from "../dice/rolls.mjs";
import { isTruthyAeFlag } from "./combat-ae-flags.mjs";
import { adjacentShockTargets } from "./savage-fray.mjs";
import { createNoticeMessage } from "../chat/chat-card.mjs";

/**
 * @param {TokenDocument} token
 * @returns {TokenDocument[]}
 */
function adjacentHostileTokens(token) {
  if (!token?.object || !canvas?.tokens) return [];
  const origin = token.object.center;
  const foes = [];
  for (const t of canvas.tokens.placeables) {
    if (!t.actor || t.id === token.object.id) continue;
    if (t.document.disposition === token.disposition) continue;
    const dist = canvas.grid.measureDistance(origin, t.center, { gridSpaces: true });
    // Adjacent = within 1 grid space
    const spaces =
      typeof dist === "number" && dist > 20
        ? Math.round(dist / (canvas.dimensions?.distance || 5))
        : dist;
    if (spaces <= 1) foes.push(t.document);
  }
  return foes;
}

/**
 * Pick the actor's best equipped melee weapon that has Shock.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function readyMeleeShockWeapon(actor) {
  const weapons = actor?.items?.filter(
    (i) =>
      i.type === "weapon" &&
      i.system?.equipped &&
      i.system?.melee &&
      i.system?.shock?.damage,
  ) ?? [];
  return weapons[0] ?? null;
}

/**
 * Apply Savage Fray end-of-turn adjacent shock for a combatant.
 * @param {Combatant} combatant
 */
export async function applyEndOfTurnAdjacentShock(combatant) {
  const actor = combatant?.actor;
  if (!actor || !isTruthyAeFlag(actor.system.combat?.endOfTurnAdjacentShock)) return;
  const weapon = readyMeleeShockWeapon(actor);
  if (!weapon) return;

  const token = combatant.token;
  if (!token) return;

  const attacked = combatant.getFlag("wwn", "attackedThisTurn") ?? [];
  const adjacent = adjacentHostileTokens(token).map((t) => ({
    id: t.actorId ?? t.actor?.id,
    token: t,
    actor: t.actor,
  })).filter((f) => f.id && f.actor);

  const targets = adjacentShockTargets(adjacent, attacked);
  for (const foe of targets) {
    const { applies } = WwnDice.shockAppliesOnMiss(actor, foe.actor, weapon, "melee");
    if (!applies) continue;
    const parts = WwnDice.assembleAttack(actor, weapon, { attackKind: "melee" });
    if (!parts.shock) continue;
    const shockRoll = await new WwnDamageRoll(
      parts.shock.formula(),
      actor.getRollData(),
      { kind: "damage" },
    ).evaluate();
    await foe.actor.applyDamage(shockRoll.total, 1, {
      source: `${actor.name}: ${weapon.name} (end of turn Shock)`,
    });
    await createNoticeMessage({
      title: actor.name,
      body: `${foe.actor.name}: ${shockRoll.total} Shock`,
      flags: { kind: "shock" },
    }).catch(() => null);
  }
}
