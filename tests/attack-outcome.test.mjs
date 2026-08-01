/**
 * Unit tests for attack hit / shock floor / apply rows.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAttackHit,
  applyShockFloor,
  buildAttackApplyRows,
  buildAttackNotices,
  naturalAttackDie,
  skillLevelWithCb,
  traumaticDamage,
} from "../module/helpers/attack-outcome.mjs";
import { resolveTargetAcForAttack } from "../module/helpers/attack-ac.mjs";
import { resolveWeaponTlGate, PRIMITIVE_IMMUNE_TL } from "../module/helpers/weapon-tl.mjs";

describe("resolveAttackHit", () => {
  it("forces miss on TL block even with nat 20", () => {
    assert.deepEqual(
      resolveAttackHit({ attackTotal: 30, naturalDie: 20, targetAc: 10, blockedByTl: true }),
      { hit: false, reason: "tl" }
    );
  });

  it("nat 1 misses and nat 20 hits", () => {
    assert.equal(resolveAttackHit({ attackTotal: 25, naturalDie: 1, targetAc: 10, blockedByTl: false }).reason, "nat1");
    assert.equal(resolveAttackHit({ attackTotal: 5, naturalDie: 20, targetAc: 20, blockedByTl: false }).reason, "nat20");
  });

  it("compares total to AC otherwise", () => {
    assert.equal(resolveAttackHit({ attackTotal: 15, naturalDie: 10, targetAc: 15, blockedByTl: false }).hit, true);
    assert.equal(resolveAttackHit({ attackTotal: 14, naturalDie: 10, targetAc: 15, blockedByTl: false }).hit, false);
  });
});

describe("applyShockFloor", () => {
  it("raises damage to shock when shock is higher", () => {
    assert.deepEqual(applyShockFloor(3, 5), { value: 5, floored: true });
    assert.deepEqual(applyShockFloor(7, 5), { value: 7, floored: false });
  });
});

describe("traumaticDamage", () => {
  it("multiplies floored (post-shock) damage by rating", () => {
    const floor = applyShockFloor(2, 5);
    assert.equal(traumaticDamage(floor.value, 3), 15);
  });
});

describe("skillLevelWithCb", () => {
  it("raises unskilled -2 to 0 when CB is present", () => {
    assert.equal(skillLevelWithCb(-2, ["CB"]), 0);
    assert.equal(skillLevelWithCb(-1, ["CB"]), 0);
  });

  it("leaves non-negative and non-CB levels unchanged", () => {
    assert.equal(skillLevelWithCb(1, ["CB"]), 1);
    assert.equal(skillLevelWithCb(-2, ["AP"]), -2);
    assert.equal(skillLevelWithCb(-2, []), -2);
  });
});

describe("naturalAttackDie", () => {
  it("prefers an active d20 face over other dice", () => {
    const roll = {
      terms: [
        { faces: 6, results: [{ result: 4, active: true }] },
        { faces: 20, results: [{ result: 17, active: true }] },
      ],
    };
    assert.equal(naturalAttackDie(roll), 17);
  });

  it("skips inactive results", () => {
    const roll = {
      terms: [
        {
          faces: 20,
          results: [
            { result: 1, active: false },
            { result: 14, active: true },
          ],
        },
      ],
    };
    assert.equal(naturalAttackDie(roll), 14);
  });
});

describe("buildAttackApplyRows", () => {
  const labels = {
    damage: "Damage",
    damageFloored: "Damage (Shock floor)",
    missDamage: "Miss damage",
    straight: null,
    shockVs: (v, ac) => `Shock ${v} vs ${ac}`,
    shockVsTarget: (v, t, a) => `Shock ${v} (${a}≤${t})`,
    trauma: (r) => `Trauma x${r}`,
  };

  it("on hit uses pre-floored damage and omits separate shock row", () => {
    const floor = applyShockFloor(2, 4);
    const rows = buildAttackApplyRows({
      hit: true,
      blockedByTl: false,
      damageValue: floor.value,
      damageFloored: floor.floored,
      straightValue: null,
      shockTotal: 4,
      shockAppliesOnMiss: true,
      shockLabelAc: 15,
      shockTargetAc: 12,
      trauma: null,
      missDamageValue: null,
      labels,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "damage");
    assert.equal(rows[0].value, 4);
    assert.equal(rows[0].shockFloored, true);
  });

  it("floors godbound straight damage the same as converted damage", () => {
    const shock = 5;
    const straightFloor = applyShockFloor(3, shock);
    const rows = buildAttackApplyRows({
      hit: true,
      blockedByTl: false,
      damageValue: applyShockFloor(2, shock).value,
      damageFloored: true,
      straightValue: straightFloor.value,
      shockTotal: shock,
      shockAppliesOnMiss: true,
      shockLabelAc: 15,
      shockTargetAc: 12,
      trauma: null,
      missDamageValue: null,
      labels: { ...labels, straight: (v) => `Straight ${v}` },
    });
    assert.equal(rows[0].value, 5);
    assert.equal(rows[0].altValue, 5);
  });

  it("on miss adds shock row when it applies", () => {
    const rows = buildAttackApplyRows({
      hit: false,
      blockedByTl: false,
      damageValue: 2,
      damageFloored: false,
      straightValue: null,
      shockTotal: 3,
      shockAppliesOnMiss: true,
      shockLabelAc: 15,
      shockTargetAc: 12,
      trauma: null,
      missDamageValue: null,
      labels,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "shock");
    assert.equal(rows[0].value, 3);
  });

  it("traumatic hit emits only trauma row (replaces base damage)", () => {
    const floor = applyShockFloor(2, 5);
    const rating = 2;
    const rows = buildAttackApplyRows({
      hit: true,
      blockedByTl: false,
      damageValue: floor.value,
      damageFloored: floor.floored,
      straightValue: null,
      shockTotal: 5,
      shockAppliesOnMiss: true,
      shockLabelAc: 15,
      shockTargetAc: 10,
      trauma: { traumatic: true, rating, multiplied: traumaticDamage(floor.value, rating) },
      missDamageValue: null,
      labels,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "trauma");
    assert.equal(rows[0].value, 10);
  });
});

describe("powered armor TL gate", () => {
  it("blocks TL≤3 weapons when powered body armor is equipped", () => {
    const target = {
      items: [{
        type: "armor",
        system: { equipped: true, type: "heavy", powered: true },
      }],
      system: { combat: {}, derived: {} },
    };
    const gate = resolveWeaponTlGate({}, target, { name: "Sword", system: { tl: PRIMITIVE_IMMUNE_TL } }, "melee");
    assert.equal(gate.blocked, true);
    const gate4 = resolveWeaponTlGate({}, target, { name: "Laser", system: { tl: 4 } }, "ranged");
    assert.equal(gate4.blocked, false);
  });
});

describe("miss shock vs ignored armor AC", () => {
  it("resolved attack AC can fall under shock threshold when stored AC would not", () => {
    const armor = {
      id: "a1",
      name: "Mail",
      type: "armor",
      system: {
        equipped: true,
        type: "medium",
        tl: 2,
        magical: false,
        ac: 16,
        acValue: 16,
        mod: 0,
        modValue: 0,
      },
    };
    const target = {
      type: "character",
      items: [armor],
      system: {
        abilities: { dex: { mod: 0 } },
        combat: {
          ac: { base: 10, mod: 0, melee: { mod: 0, value: 16 }, ranged: { mod: 0, value: 16 } },
          innateAc: { min: 0 },
        },
      },
    };
    const weapon = { system: { firearm: true, tl: 3, tags: [], shock: { damage: "1d4", ac: 15 } } };
    const storedMelee = target.system.combat.ac.melee.value;
    const threshold = weapon.system.shock.ac;
    assert.equal(storedMelee <= threshold, false);

    const acResult = resolveTargetAcForAttack({}, target, weapon, "melee", { separateRanged: false });
    assert.equal(acResult.ignored.length, 1);
    assert.ok(Number.isFinite(acResult.ac));
    assert.equal(acResult.ac <= threshold, true);
  });
});

describe("buildAttackNotices", () => {
  it("localizes TL block and suppresses ignore notices when blocked", () => {
    const notices = buildAttackNotices({
      blockedByTl: true,
      hitReason: "tl",
      ignored: [{ name: "Leather", reason: "firearm", isShield: false }],
      ac: 12,
      acKind: "melee",
    }, (key, data) => (data ? `${key}:${JSON.stringify(data)}` : key));
    assert.ok(notices.some((n) => n.includes("NoticeTlBlocked")));
    assert.ok(!notices.some((n) => n.includes("NoticeIgnoreFirearm")));
    assert.ok(!notices.some((n) => n.includes("NoticeTargetAc")));
  });

  it("localizes ignore reasons when the attack resolves vs AC", () => {
    const notices = buildAttackNotices({
      blockedByTl: false,
      hitReason: "hit",
      ignored: [{ name: "Leather", reason: "firearm", isShield: false }],
      ac: 12,
      acKind: "melee",
    }, (key, data) => (data ? `${key}:${JSON.stringify(data)}` : key));
    assert.ok(notices.some((n) => n.includes("NoticeIgnoreFirearm")));
    assert.ok(notices.some((n) => n.includes("NoticeTargetAc")));
  });
});
