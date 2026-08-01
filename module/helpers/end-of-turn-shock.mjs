/**
 * End-of-turn adjacent Shock for Savage Fray L1.
 * Posts a chat card with apply rows — the damage target's owner applies.
 */
import { WwnDice } from "../dice/dice.mjs";
import { WwnDamageRoll } from "../dice/rolls.mjs";
import { isTruthyAeFlag } from "./combat-ae-flags.mjs";
import { adjacentShockTargets } from "./savage-fray.mjs";
import { resolveTargetAcForAttack } from "./attack-ac.mjs";
import { createRollMessage } from "../chat/chat-card.mjs";

/**
 * Grid spaces between two canvas points (Foundry v14 `measurePath`).
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
function gridSpacesBetween(a, b) {
  if (!canvas?.grid?.measurePath) return Infinity;
  const result = canvas.grid.measurePath([a, b]);
  return Number(result?.spaces) || 0;
}

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
    if (gridSpacesBetween(origin, t.center) <= 1) foes.push(t.document);
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
  if (!weapons.length) return null;
  // Prefer the highest shock damage formula total estimate (numeric prefix), else first.
  return weapons.sort((a, b) => {
    const av = Number(String(a.system.shock.damage).match(/\d+/)?.[0]) || 0;
    const bv = Number(String(b.system.shock.damage).match(/\d+/)?.[0]) || 0;
    return bv - av;
  })[0];
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
  const separateRanged = game.settings.get("wwn", "separateRangedAC");
  for (const foe of targets) {
    const acResult = resolveTargetAcForAttack(actor, foe.actor, weapon, "melee", { separateRanged });
    const { applies } = WwnDice.shockAppliesOnMiss(actor, foe.actor, weapon, "melee", {
      effectiveTargetAc: Number.isFinite(acResult.ac) ? acResult.ac : null,
    });
    if (!applies) continue;
    const parts = WwnDice.assembleAttack(actor, weapon, { attackKind: "melee" });
    if (!parts.shock) continue;
    const shockRoll = await new WwnDamageRoll(
      parts.shock.formula(),
      actor.getRollData(),
      { kind: "damage" },
    ).evaluate();
    const applyRows = [{
      id: "shock",
      label: game.i18n.localize("WWN.Roll.ShockBase"),
      value: shockRoll.total,
    }];
    await createRollMessage({
      rolls: [shockRoll],
      kind: "attack",
      actor,
      img: weapon.img,
      title: game.i18n.format("WWN.Roll.AttackTitle", { weapon: weapon.name }),
      subtitle: game.i18n.format("WWN.Roll.VsTarget", { target: foe.actor.name }),
      badge: {
        label: game.i18n.localize("WWN.Roll.ShockBase"),
        type: "warn",
      },
      bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
      context: {
        applyRows,
        notices: [game.i18n.localize("WWN.Chat.EndOfTurnShock")],
        hit: false,
      },
      flags: {
        applyRows: applyRows.map((r) => ({ id: r.id, value: r.value })),
        kind: "shock",
      },
    });
  }
}
