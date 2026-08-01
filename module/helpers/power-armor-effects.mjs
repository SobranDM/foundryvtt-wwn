/**
 * Phase B power-armor fitting effect engine.
 * Handlers: Passive (derive), Action, Reaction, Gate.
 */
import { POWER_ARMOR_EFFECT_IDS as E } from "./power-armor-budget.mjs";
import {
  canSpend,
  EMPTY_SUIT_STATS,
  fittingStateKey,
  getFittingState,
  patchFittingState,
  spendUse,
} from "./power-armor-fitting-state.mjs";
async function rollFitting(suit, item, ctx) {
  const { rollSuitArmorFitting } = await import("./power-armor-rolls.mjs");
  return rollSuitArmorFitting(suit, item, ctx);
}

async function postFittingChat(suit, item, text, rolls = []) {
  const { createRollMessage } = await import("../chat/chat-card.mjs");
  return createRollMessage({
    rolls,
    kind: "formula",
    actor: suit,
    img: item.img,
    title: `${suit.name}: ${item.name}`,
    bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
    context: {
      breakdown: [],
      note: text,
    },
  });
}

/**
 * @typedef {object} FittingHandler
 * @property {"passive"|"action"|"reaction"|"gate"} kind
 * @property {boolean} [scene]
 * @property {boolean} [maint]
 * @property {boolean} [round]
 * @property {boolean} [blockConsecutive]
 * @property {number} [maxScene]
 * @property {number} [maxMaint]
 * @property {string} [chat]
 * @property {boolean} [rollFitting]
 * @property {boolean} [toggleActive]
 * @property {boolean} [reaction]
 */

/** @type {Record<string, FittingHandler>} */
export const FITTING_HANDLERS = Object.freeze({
  // Movement / modes
  [E.jumpJets]: {
    kind: "action",
    round: true,
    blockConsecutive: true,
    chat: "Leap up to 30m horizontal or vertical; ignore falls ≤30m. Place the token manually.",
  },
  [E.hydraulicJumpDampers]: {
    kind: "passive",
    chat: "Ignore the first 100m of falling damage; land on your feet.",
  },
  [E.wallcrawlerAnchors]: {
    kind: "passive",
    chat: "Climb sheer or overhanging surfaces at Move speed (one free hand).",
  },
  [E.aquaticAdaptationSuite]: {
    kind: "passive",
    chat: "3D underwater Move, breathe, pressure tolerance, and underwater weapons.",
  },
  [E.graviticFlightStruts]: {
    kind: "action",
    toggleActive: true,
    chat: "Fly at normal Move for up to 15 minutes, then recharge 15 minutes. Place token manually.",
  },
  [E.graviticFoldFlight]: {
    kind: "action",
    toggleActive: true,
    chat: "Fly indefinitely at 2× Move. Place token manually.",
  },
  [E.assaultChargeServos]: {
    kind: "action",
    scene: true,
    maxScene: 1,
    chat: "Move: triple Move this round; ignore Fighting Withdrawal. Place token manually.",
  },
  [E.shortRangeWarpCapacitor]: {
    kind: "action",
    scene: true,
    maxScene: 99,
    chat: "On Turn: teleport ≤30m. After the first use in a scene, roll 1d6 — fail on 3−.",
  },
  [E.pathfinderBridgingSystem]: {
    kind: "action",
    chat: "Deploy a 20×1m bridge (reclaim or leave; may lock until maintenance if abandoned).",
  },
  [E.ghostWalkerField]: {
    kind: "action",
    toggleActive: true,
    chat: "Invisible/inaudible for up to 15 minutes (+ recharge). Breaks on attack or run. Melee vs you −4 while active.",
  },
  [E.ablativeMeteorShielding]: {
    kind: "action",
    maint: true,
    maxMaint: 1,
    chat: "Orbital stealth vs sensors. Fitting is dead until next maintenance after use.",
  },
  [E.weaselProbe]: {
    kind: "action",
    chat: "Deploy remote probe (track HP/notes separately). Destroyed probe requires maintenance.",
  },
  [E.smokethrower]: {
    kind: "action",
    scene: true,
    maxScene: 1,
    chat: "1/scene: dense smoke; user sees through it for the duration.",
  },
  // Combat actions
  [E.breacherFist]: {
    kind: "action",
    rollFitting: true,
    chat: "Main Action: blast a human-sized hole in an adjacent wall (≤1m), or demo vs immobile targets.",
  },
  [E.fingerOfDeath]: {
    kind: "action",
    chat: "Main Action: lethal radiation beam ≤10m. On hit, death in 48h without TL4 care. Roll 1d6 — on 1, expose the user.",
  },
  [E.chokeCloudSprayer]: {
    kind: "action",
    chat: "Move: trigger a Readied gas grenade through the sprayer.",
  },
  [E.ricochetField]: {
    kind: "action",
    toggleActive: true,
    chat: "Frontal bullet deflect field (Move cost each round while active).",
  },
  [E.reactiveAntipersonnelArmor]: {
    kind: "action",
    scene: true,
    maxScene: 1,
    rollFitting: true,
    chat: "Main Action: antipersonnel blast. Reload requires 5 minutes + scrap between scenes.",
  },
  [E.plagueWindGenerator]: {
    kind: "action",
    maint: true,
    maxMaint: 1,
    rollFitting: true,
    chat: "Once between maintenance: 6d6 plague wind + Physical save.",
  },
  [E.deployableForceShield]: {
    kind: "action",
    scene: true,
    maxScene: 99,
    chat: "Deploy 3×3m cover shield. Reuse in the same scene: roll drain/failure die per PDF.",
  },
  [E.integralRipperBar]: { kind: "action", rollFitting: true },
  [E.skysweeperLaserSystem]: {
    kind: "reaction",
    round: true,
    maxScene: 99,
    chat: "1/round: auto-disable the first ballistic munition targeting the suit.",
  },
  [E.kineticRebukeShielding]: {
    kind: "reaction",
    round: true,
    rollFitting: true,
    chat: "Once/round when attacked within 5m: rebuke damage + save.",
  },
  [E.stunSkin]: {
    kind: "reaction",
    rollFitting: true,
    chat: "On grapple or unarmed hit: 2d6 stun discharge.",
  },
  // Mount / targeting
  [E.targetLockProcessor]: {
    kind: "action",
    chat: "Move: lock a target (+4 to hit that target until changed).",
  },
  [E.linkedTargetingSystem]: {
    kind: "action",
    chat: "When attacking with another mount weapon, make a bonus attack with the linked mount weapon.",
  },
  [E.integratedAmmoFeed]: {
    kind: "action",
    chat: "On Turn: reload a Readied weapon from the suit's integrated ammo (10 Enc).",
  },
  // Medical
  [E.onboardMedicalUnit]: {
    kind: "action",
    chat: "On Turn: administer a pharma dose / treat as medkit (doses tracked in fitting state).",
  },
  [E.traumaStabilizerUnit]: { kind: "passive" },
  [E.neuralBuffer]: { kind: "passive" },
  // VI / gates
  [E.tsukumogamiProcessor]: {
    kind: "action",
    round: true,
    chat: "VI Main: non-physical / systems action this round (+3 on assisted suit skills).",
  },
  [E.blackOfuda]: {
    kind: "gate",
    toggleActive: true,
    chat: "Jailbreak empty-suit mode (PDF empty-suit combat stats on the suit, not the PC).",
  },
  [E.backseatDriverMod]: {
    kind: "action",
    chat: "Autonav / SOS / empty return. ≥15 damage in one hit incapacitates until maintenance.",
  },
  [E.identificationLock]: {
    kind: "gate",
    chat: "Whitelist pilots; uninstall requires Fix/Program vs slag risk.",
  },
  // Narrative / badge passives
  [E.sealedSystemsBasic]: { kind: "passive" },
  [E.sealedSystemsAdvanced]: { kind: "passive" },
  [E.thermalAblativeLayer]: { kind: "passive" },
  [E.stormReinforcement]: { kind: "passive" },
  [E.commSuiteBasic]: { kind: "passive" },
  [E.commSuiteAdvanced]: { kind: "passive" },
  [E.ecmProjector]: { kind: "action", chat: "Jam nearby radios / remotes for the scene." },
  [E.qecmProjector]: { kind: "action", chat: "QECM: nuclear / exotic fizzle zone (GM adjudication)." },
  [E.droneMount]: { kind: "action", chat: "Bonus Main for the mounted drone this round." },
  [E.brainguardCap]: { kind: "passive" },
  [E.floodlights]: {
    kind: "action",
    toggleActive: true,
    chat: "Toggle floodlights (token light AE). −2 to hit while lights are on.",
  },
  [E.nightVisionSensors]: { kind: "passive" },
  [E.multispectralOptics]: { kind: "passive" },
  [E.camoSkinBasic]: { kind: "passive" },
  [E.camoSkinAdvanced]: { kind: "passive" },
});

function combatRound() {
  return game.combat?.round ?? null;
}

function fittingsActive(suit) {
  return !!suit?.system?.derived?.active;
}

/**
 * @param {Actor} suit
 * @param {Item} item
 * @param {FittingHandler} handler
 */
function spendChecks(suit, item, handler) {
  const key = fittingStateKey(item);
  const entry = getFittingState(suit.system, key);
  if (handler.maint && entry.deadUntilMaint) {
    return { ok: false, reason: "lockedUntilMaint", key, entry };
  }
  const check = canSpend(entry, {
    scene: !!handler.scene,
    maint: !!handler.maint,
    round: !!handler.round || !!handler.blockConsecutive,
    combatRound: combatRound(),
    maxScene: handler.maxScene ?? 1,
    maxMaint: handler.maxMaint ?? 1,
  });
  // consecutive-round special for jump jets
  if (handler.blockConsecutive && combatRound() != null && entry.lastUsedRound != null) {
    if (combatRound() === entry.lastUsedRound + 1) {
      return { ok: false, reason: "consecutiveRound", key, entry };
    }
  }
  if (handler.blockConsecutive && entry.flags) {
    // ensure flag present for canSpend path
  }
  if (!check.ok) return { ...check, key, entry };
  return { ok: true, key, entry };
}

/**
 * Activate a fitting from the sheet or item roll path.
 * @param {Actor} suit
 * @param {Item} item
 * @param {object} [ctx]
 */
export async function activateFitting(suit, item, ctx = {}) {
  if (suit?.type !== "powerArmor" || item?.type !== "armorFitting") {
    return { ok: false, reason: "invalid" };
  }
  if (!fittingsActive(suit) && item.system?.effectId !== E.platingImprovised) {
    // Still allow plating-only when depowered — activations need power
    if (!suit.system.powered || suit.system.overBudget) {
      ui.notifications?.warn?.(game.i18n.format("WWN.PowerArmor.FittingUnavailable", { reason: "inert" }));
      return { ok: false, reason: "inert" };
    }
  }

  const effectId = item.system.effectId;
  const handler = FITTING_HANDLERS[effectId];
  if (!handler || handler.kind === "passive") {
    // Fall back to roll path for weapon-like fittings
    if (item.system.isWeapon || item.system.damageRoll) {
      await rollFitting(suit, item, ctx);
      return { ok: true };
    }
    ui.notifications?.info?.(item.system.description?.replace(/<[^>]+>/g, "") || item.name);
    return { ok: true, passive: true };
  }

  const gate = spendChecks(suit, item, handler);
  if (!gate.ok) {
    ui.notifications?.warn?.(
      game.i18n.format("WWN.PowerArmor.FittingUnavailable", { reason: gate.reason }),
    );
    return { ok: false, reason: gate.reason };
  }

  // Special: target lock
  if (effectId === E.targetLockProcessor) {
    const targets = [...(game.user?.targets ?? [])];
    const token = targets[0];
    const uuid = token?.actor?.uuid ?? token?.document?.actor?.uuid ?? null;
    if (!uuid) {
      ui.notifications?.warn?.(game.i18n.localize("WWN.PowerArmor.SetTargetLock"));
      return { ok: false, reason: "noTarget" };
    }
    const next = patchFittingState(suit.system, gate.key, { targetUuid: uuid });
    await suit.update({ "system.fittingState": next });
    await postFittingChat(suit, item, `Target lock set: ${token.name ?? uuid}`);
    return { ok: true };
  }

  // Special: black ofuda toggle empty suit
  if (effectId === E.blackOfuda) {
    const entry = gate.entry;
    const emptySuit = !entry.emptySuit;
    const next = patchFittingState(suit.system, gate.key, {
      emptySuit,
      active: emptySuit,
      flags: { ...EMPTY_SUIT_STATS },
    });
    const update = { "system.fittingState": next };
    if (emptySuit) {
      update["system.viHp.value"] = EMPTY_SUIT_STATS.hp;
      update["system.viHp.max"] = EMPTY_SUIT_STATS.hp;
      update["system.soak.value"] = EMPTY_SUIT_STATS.soak;
    }
    await suit.update(update);
    await postFittingChat(
      suit,
      item,
      emptySuit
        ? game.i18n.format("WWN.PowerArmor.EmptySuitOn", EMPTY_SUIT_STATS)
        : game.i18n.localize("WWN.PowerArmor.EmptySuitOff"),
    );
    return { ok: true };
  }

  // Special: medical doses
  if (effectId === E.onboardMedicalUnit) {
    const doses = gate.entry.doses ?? 6;
    if (doses <= 0) {
      ui.notifications?.warn?.(
        game.i18n.format("WWN.PowerArmor.FittingUnavailable", { reason: "noDoses" }),
      );
      return { ok: false, reason: "noDoses" };
    }
    const next = patchFittingState(suit.system, gate.key, { doses: doses - 1 });
    await suit.update({ "system.fittingState": next });
    await postFittingChat(suit, item, `Administered medical dose (${doses - 1} remaining).`);
    return { ok: true };
  }

  // Special: short-range warp fail die after first scene use
  const rolls = [];
  let note = handler.chat ?? `${item.name} activated.`;
  if (effectId === E.shortRangeWarpCapacitor && (gate.entry.usesScene ?? 0) >= 1) {
    const { WwnRoll } = await import("../dice/rolls.mjs");
    const fail = await new WwnRoll("1d6", {}, { kind: "formula" }).evaluate();
    rolls.push(fail);
    if (fail.total <= 3) note += ` Warp instability! Rolled ${fail.total} — failure.`;
    else note += ` Warp OK (rolled ${fail.total}). Teleport ≤30m — place token manually.`;
  }

  if (effectId === E.fingerOfDeath) {
    const { WwnRoll } = await import("../dice/rolls.mjs");
    const expose = await new WwnRoll("1d6", {}, { kind: "formula" }).evaluate();
    rolls.push(expose);
    note += ` Exposure check: ${expose.total}${expose.total === 1 ? " — USER EXPOSED" : ""}.`;
  }

  if (effectId === E.ablativeMeteorShielding) {
    const spent = spendUse(gate.entry, { maint: true });
    spent.deadUntilMaint = true;
    const next = patchFittingState(suit.system, gate.key, spent);
    await suit.update({ "system.fittingState": next });
    await postFittingChat(suit, item, note, rolls);
    return { ok: true };
  }

  let nextEntry = spendUse(gate.entry, {
    scene: !!handler.scene,
    maint: !!handler.maint,
    combatRound: (handler.round || handler.blockConsecutive) ? combatRound() : null,
    flags: handler.blockConsecutive ? { blockConsecutive: true } : undefined,
  });

  // VI Main: mark assist active this round (out of combat has no lastUsedRound).
  if (effectId === E.tsukumogamiProcessor) {
    nextEntry = { ...nextEntry, active: true };
  }

  if (handler.toggleActive) {
    nextEntry = { ...nextEntry, active: !gate.entry.active };
    if (effectId === E.floodlights) {
      // Prefer toggling transferred light AE if present
      const ae = item.effects?.find?.((e) => !e.disabled) ?? item.effects?.contents?.[0];
      if (ae) await ae.update({ disabled: nextEntry.active ? false : true });
    }
  }

  const next = patchFittingState(suit.system, gate.key, nextEntry);
  await suit.update({ "system.fittingState": next });

  if (handler.rollFitting && (item.system.isWeapon || item.system.damageRoll)) {
    await rollFitting(suit, item, ctx);
  } else {
    await postFittingChat(suit, item, note, rolls);
  }

  ui.notifications?.info?.(
    game.i18n.format("WWN.PowerArmor.FittingActivated", { name: item.name }),
  );
  return { ok: true };
}

/**
 * Manually or automatically trigger a reaction fitting.
 * @param {Actor} suit
 * @param {string} effectId
 * @param {object} [ctx]
 */
export async function triggerReaction(suit, effectId, ctx = {}) {
  const item = suit.items.find(
    (i) => i.type === "armorFitting" && i.system?.effectId === effectId && !i.system?.disabled,
  );
  if (!item) return { ok: false, reason: "missing" };
  const handler = FITTING_HANDLERS[effectId];
  if (!handler || handler.kind !== "reaction") {
    return activateFitting(suit, item, ctx);
  }
  if (!fittingsActive(suit)) {
    return { ok: false, reason: "inert" };
  }
  const gate = spendChecks(suit, item, handler);
  if (!gate.ok) {
    ui.notifications?.warn?.(
      game.i18n.format("WWN.PowerArmor.FittingUnavailable", { reason: gate.reason }),
    );
    return { ok: false, reason: gate.reason };
  }
  const nextEntry = spendUse(gate.entry, {
    combatRound: combatRound(),
  });
  const next = patchFittingState(suit.system, gate.key, nextEntry);
  await suit.update({ "system.fittingState": next });

  if (handler.rollFitting && (item.system.damageRoll || item.system.isWeapon)) {
    await rollFitting(suit, item, ctx);
  } else {
    await postFittingChat(suit, item, handler.chat ?? item.name);
  }
  return { ok: true };
}

/**
 * After an attack resolves against a power-armor suit, try automatic reactions.
 * @param {Actor} suit
 * @param {{ distanceM?: number, unarmed?: boolean, ballistic?: boolean }} ctx
 */
export async function onSuitAttacked(suit, ctx = {}) {
  if (suit?.type !== "powerArmor" || !fittingsActive(suit)) return;
  const caps = suit.system.derived?.capabilities ?? {};

  if (caps.kineticRebuke && (ctx.distanceM == null || ctx.distanceM <= 5)) {
    await triggerReaction(suit, E.kineticRebukeShielding, ctx);
  }
  if (caps.stunSkin && ctx.unarmed) {
    await triggerReaction(suit, E.stunSkin, ctx);
  }
  if (caps.skysweeper && ctx.ballistic) {
    await triggerReaction(suit, E.skysweeperLaserSystem, ctx);
  }

  // Ghost walker breaks on being used to attack — handled by attacker path; also break if active and suit attacked? PDF: breaks on attack/run by user.
}

/**
 * Identification Lock: whether a pilot UUID may be assigned.
 * @param {Actor} suit
 * @param {string} pilotUuid
 */
export function isPilotAllowedByIdLock(suit, pilotUuid) {
  const caps = suit.system.derived?.capabilities ?? {};
  if (!caps.identificationLock) return true;
  const item = suit.items.find(
    (i) => i.type === "armorFitting" && i.system?.effectId === E.identificationLock && !i.system.disabled,
  );
  if (!item) return true;
  const entry = getFittingState(suit.system, fittingStateKey(item));
  const allowed = entry.allowedPilots ?? [];
  if (!allowed.length) return true; // unset whitelist = open until configured
  return allowed.includes(pilotUuid);
}

/**
 * Apply Backseat Driver incap when a single hit deals ≥15 after soak split.
 * @param {Actor} suit
 * @param {number} amount
 */
export async function checkBackseatIncap(suit, amount) {
  if (suit?.type !== "powerArmor") return false;
  if (!suit.system.derived?.capabilities?.backseatDriver) return false;
  if (amount < 15) return false;
  const item = suit.items.find(
    (i) => i.type === "armorFitting" && i.system?.effectId === E.backseatDriverMod && !i.system.disabled,
  );
  if (!item) return false;
  const key = fittingStateKey(item);
  const next = patchFittingState(suit.system, key, { incapUntilMaint: true });
  await suit.update({ "system.fittingState": next });
  ui.notifications?.warn?.(game.i18n.localize("WWN.PowerArmor.BackseatIncap"));
  return true;
}

/**
 * Target-lock attack bonus if the current user target matches.
 * @param {Actor} suit
 * @param {Actor|null} targetActor
 */
export function targetLockAttackBonus(suit, targetActor) {
  if (!suit?.system?.derived?.capabilities?.targetLock || !targetActor) return 0;
  const item = suit.items.find(
    (i) => i.type === "armorFitting" && i.system?.effectId === E.targetLockProcessor && !i.system.disabled,
  );
  if (!item) return 0;
  const entry = getFittingState(suit.system, fittingStateKey(item));
  if (!entry.targetUuid) return 0;
  return entry.targetUuid === targetActor.uuid ? 4 : 0;
}

/**
 * Tsukumogami +3 only after VI Main was spent this combat round
 * (or `active` when activated out of combat).
 * @param {Actor} suit
 */
export function tsukumogamiSkillBonus(suit) {
  if (!suit?.system?.derived?.capabilities?.tsukumogami) return 0;
  const item = suit.items?.find?.(
    (i) => i.type === "armorFitting" && i.system?.effectId === E.tsukumogamiProcessor && !i.system.disabled,
  );
  if (!item) return 0;
  const entry = getFittingState(suit.system, fittingStateKey(item));
  const round = combatRound();
  if (round != null) return entry.lastUsedRound === round ? 3 : 0;
  return entry.active ? 3 : 0;
}

/**
 * Floodlights −2 to hit while active.
 * @param {Actor} suit
 */
export function floodlightsAttackPenalty(suit) {
  if (!suit?.system?.derived?.capabilities?.floodlights) return 0;
  const item = suit.items.find(
    (i) => i.type === "armorFitting" && i.system?.effectId === E.floodlights && !i.system.disabled,
  );
  if (!item) return 0;
  const entry = getFittingState(suit.system, fittingStateKey(item));
  const aeOn = item.effects?.some?.((e) => !e.disabled);
  return (entry.active || aeOn) ? -2 : 0;
}

export { E as POWER_ARMOR_EFFECT_IDS };
