/**
 * Node unit tests for starship combat pure helpers.
 * Run: node --test tests/starship-combat.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWeaponQualities, qualityAttackModifier } from "../module/combat/starship/qualities.mjs";
import {
  resolveStarshipDamage,
  damageControlHp,
  damageControlDifficulty,
} from "../module/combat/starship/armor.mjs";
import {
  startingCommandPoints,
  applySupportDiscount,
  spendCp,
  startTurnState,
  endTurnState,
} from "../module/combat/starship/cp.mjs";
import {
  applyEscapeCombatSuccess,
  applyPursueSuccess,
  hasEscapedAll,
  ESCAPE_THRESHOLD,
} from "../module/combat/starship/escape.mjs";
import {
  crisisFromRoll,
  armorWithCrises,
  bridgeActionsBlocked,
  createCrisisInstance,
} from "../module/combat/starship/crises.mjs";
import { isPcCrewMode, effectiveStarshipAc } from "../module/combat/starship/state.mjs";
import { getStarshipAction, STARSHIP_ACTIONS } from "../module/combat/starship/actions.mjs";
import { disableTargetCandidates } from "../module/combat/starship/systems.mjs";

describe("parseWeaponQualities", () => {
  it("parses AP, Ammo, Flak, Clumsy, Cloud", () => {
    const q = parseWeaponQualities("AP 20, Ammo 4, Flak");
    assert.equal(q.ap, 20);
    assert.equal(q.ammo, 4);
    assert.equal(q.flak, true);
    assert.equal(q.clumsy, false);
    assert.equal(parseWeaponQualities("Cloud, Clumsy").cloud, true);
    assert.equal(qualityAttackModifier({ clumsy: true, flak: false, cloud: false, ap: 0, ammo: null }, "fighter"), -4);
    assert.equal(qualityAttackModifier({ clumsy: true, flak: false, cloud: false, ap: 0, ammo: null }, "frigate"), 0);
  });
});

describe("resolveStarshipDamage", () => {
  it("subtracts armor after AP", () => {
    const r = resolveStarshipDamage({ rawDamage: 15, armor: 10, ap: 5 });
    assert.equal(r.effectiveArmor, 5);
    assert.equal(r.finalDamage, 10);
  });

  it("halves damage for Target Systems before armor", () => {
    const r = resolveStarshipDamage({ rawDamage: 11, armor: 0, targetSystems: true });
    assert.equal(r.damageBeforeArmor, 6);
    assert.equal(r.canDisable, true);
  });

  it("Hardened Polyceramic reduces AP by 5", () => {
    const r = resolveStarshipDamage({ rawDamage: 20, armor: 15, ap: 20, hardenedPolyceramic: true });
    assert.equal(r.effectiveArmor, 0);
  });

  it("cannot disable when armor negates all damage", () => {
    const r = resolveStarshipDamage({ rawDamage: 4, armor: 10, ap: 0, targetSystems: true });
    assert.equal(r.finalDamage, 0);
    assert.equal(r.canDisable, false);
  });
});

describe("damageControl", () => {
  it("scales HP by hull class", () => {
    assert.equal(damageControlHp(2, "fighter"), 4);
    assert.equal(damageControlHp(2, "capital"), 12);
  });

  it("escalates difficulty", () => {
    assert.equal(damageControlDifficulty(0), 7);
    assert.equal(damageControlDifficulty(2), 9);
  });
});

describe("command points", () => {
  it("NPC starts with npcCp + bonus − penalty", () => {
    assert.equal(startingCommandPoints({ pcCrew: false, npcCp: 5, captainCommandBonus: 1 }), 6);
    assert.equal(startingCommandPoints({ pcCrew: false, npcCp: 5, cpPenaltyNextTurn: 2 }), 3);
  });

  it("PC starts at 0 minus penalty", () => {
    assert.equal(startingCommandPoints({ pcCrew: true, cpPenaltyNextTurn: 2 }), -2);
  });

  it("applies support discount", () => {
    assert.equal(applySupportDiscount(2, true), 0);
    assert.equal(applySupportDiscount(3, true), 1);
  });

  it("spendCp refuses when insufficient", () => {
    const r = spendCp({ cp: 1 }, 2);
    assert.equal(r.ok, false);
  });

  it("start/end turn discard CP and clear round buffs", () => {
    let s = startTurnState({}, { pcCrew: false, npcCp: 4 });
    assert.equal(s.cp, 4);
    s = { ...s, cp: 2, buffs: { ...s.buffs, evasiveAcBonus: 2 } };
    s = endTurnState(s);
    assert.equal(s.cp, 0);
    assert.equal(s.buffs.evasiveAcBonus, 0);
  });
});

describe("escape", () => {
  it("reaches threshold at 3", () => {
    let { state, newlyEscapedFrom } = applyEscapeCombatSuccess({}, ["a", "b"]);
    assert.deepEqual(newlyEscapedFrom, []);
    ({ state, newlyEscapedFrom } = applyEscapeCombatSuccess(state, ["a"]));
    ({ state, newlyEscapedFrom } = applyEscapeCombatSuccess(state, ["a"]));
    assert.ok(newlyEscapedFrom.includes("a"));
    assert.equal(hasEscapedAll(state, ["a"]), true);
    assert.equal(hasEscapedAll(state, ["a", "b"]), false);
    assert.equal(ESCAPE_THRESHOLD, 3);
  });

  it("pursue reduces escape on fleeing ship", () => {
    const fleeing = { escape: { pursuer: 2 } };
    const { state, changed } = applyPursueSuccess(fleeing, "pursuer");
    assert.equal(changed, true);
    assert.equal(state.escape.pursuer, 1);
  });

  it("pursue wiring updates fleeing state keyed by pursuer id", () => {
    const pursuerId = "combatant-pursuer";
    const fleeingId = "combatant-fleeing";
    const fleeingState = { escape: { [pursuerId]: 3 } };
    const pursuerState = { escape: { [fleeingId]: 3 } };

    // Correct: applyPursueSuccess(fleeingCombatantState, pursuerCombatantId)
    const correct = applyPursueSuccess(fleeingState, pursuerId);
    assert.equal(correct.changed, true);
    assert.equal(correct.state.escape[pursuerId], 2);

    // Incorrect wiring (pursuer state + fleeing id) must not be treated as success
    const wrong = applyPursueSuccess(pursuerState, fleeingId);
    assert.notEqual(wrong.state.escape[pursuerId], 2);
    assert.equal(fleeingState.escape[pursuerId], 3);
  });
});

describe("crises", () => {
  it("maps d10 table", () => {
    assert.equal(crisisFromRoll(1).id, "armorLoss");
    assert.equal(crisisFromRoll(6).id, "haywire");
    assert.equal(crisisFromRoll(10).type, "acute");
  });

  it("halves armor per Armor Loss stack", () => {
    const c = createCrisisInstance(crisisFromRoll(1), { roundNumber: 1 });
    assert.equal(armorWithCrises(15, [c]), 7);
    assert.equal(armorWithCrises(15, [c, c]), 3);
  });

  it("blocks bridge on engine lock", () => {
    const c = createCrisisInstance(crisisFromRoll(4), { roundNumber: 1 });
    assert.equal(bridgeActionsBlocked([c]), true);
  });
});

describe("crew mode and AC", () => {
  it("detects PC crew from linked stations", () => {
    assert.equal(isPcCrewMode({ stations: { bridge: { actor: null } } }), false);
    assert.equal(isPcCrewMode({ stations: { bridge: { actor: "Actor.x" } } }), true);
  });

  it("sums AC buffs", () => {
    assert.equal(
      effectiveStarshipAc(12, { buffs: { evasiveAcBonus: 1, sensorGhostAcBonus: 2 } }),
      15,
    );
  });
});

describe("actions catalog", () => {
  it("has fire and crisis actions", () => {
    assert.ok(STARSHIP_ACTIONS.length >= 15);
    assert.equal(getStarshipAction("fireOneWeapon")?.cpCost, 2);
    assert.equal(getStarshipAction("doYourDuty")?.exclusive, true);
  });

  it("marks keepItTogether oncePerRound", () => {
    assert.equal(getStarshipAction("keepItTogether")?.oncePerRound, true);
  });
});

describe("disable targets", () => {
  it("lists weapons fittings defenses that are not destroyed", () => {
    const items = [
      { type: "shipWeapon", name: "Gun", system: { destroyed: false } },
      { type: "shipFitting", name: "Fit", system: { destroyed: true } },
      { type: "shipDefense", name: "Def", system: {} },
      { type: "item", name: "Other", system: {} },
    ];
    const list = disableTargetCandidates({ items });
    assert.equal(list.length, 2);
    assert.equal(list[0].name, "Gun");
    assert.equal(list[1].name, "Def");
  });
});
