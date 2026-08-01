import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getFittingState,
  patchFittingState,
  resetSceneFittingState,
  resetMaintFittingState,
  canSpend,
  spendUse,
  fittingStateKey,
  resolveEmptySuitMode,
  applyEmptySuitDerived,
  EMPTY_SUIT_STATS,
} from "../module/helpers/power-armor-fitting-state.mjs";
import { POWER_ARMOR_EFFECT_ID_SET, POWER_ARMOR_EFFECT_IDS as E } from "../module/helpers/power-armor-budget.mjs";
import { tsukumogamiSkillBonus } from "../module/helpers/power-armor-effects.mjs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("power-armor-fitting-state", () => {
  it("gets and patches entries by key", () => {
    const sys = { fittingState: {} };
    const next = patchFittingState(sys, "jumpJets", { usesScene: 1 });
    assert.equal(next.jumpJets.usesScene, 1);
    assert.equal(getFittingState({ fittingState: next }, "jumpJets").usesScene, 1);
  });

  it("resets scene counters and clears active modes", () => {
    const state = {
      jumpJets: { usesScene: 1, lastUsedRound: 3, doses: 2 },
      plagueWindGenerator: { usesMaint: 1, usesScene: 0 },
      ghostWalkerField: { active: true, activeUntil: 10, usesScene: 1 },
    };
    const next = resetSceneFittingState(state);
    assert.equal(next.jumpJets.usesScene, 0);
    assert.equal(next.jumpJets.lastUsedRound, null);
    assert.equal(next.jumpJets.doses, 2);
    assert.equal(next.ghostWalkerField.active, false);
    assert.equal(next.plagueWindGenerator.usesMaint, 1);
  });

  it("resets maint locks without clearing scene uses", () => {
    const state = {
      ablativeMeteorShielding: { usesScene: 1, deadUntilMaint: true, usesMaint: 1 },
    };
    const next = resetMaintFittingState(state);
    assert.equal(next.ablativeMeteorShielding.deadUntilMaint, false);
    assert.equal(next.ablativeMeteorShielding.usesMaint, 0);
    assert.equal(next.ablativeMeteorShielding.usesScene, 1);
  });

  it("canSpend enforces scene, maint, consecutive round, and cooldown", () => {
    assert.equal(canSpend({ usesScene: 1 }, { scene: true, maxScene: 1 }).ok, false);
    assert.equal(canSpend({ usesMaint: 1 }, { maint: true, maxMaint: 1 }).ok, false);
    assert.equal(canSpend({ cooldownRounds: 2 }, { scene: true }).ok, false);
    assert.equal(
      canSpend(
        { lastUsedRound: 4, flags: { blockConsecutive: true } },
        { round: true, combatRound: 5 },
      ).reason,
      "consecutiveRound",
    );
    assert.equal(canSpend({}, { scene: true }).ok, true);
  });

  it("spendUse increments counters", () => {
    const next = spendUse({}, { scene: true, combatRound: 2, flags: { blockConsecutive: true } });
    assert.equal(next.usesScene, 1);
    assert.equal(next.lastUsedRound, 2);
    assert.equal(next.flags.blockConsecutive, true);
  });

  it("fittingStateKey uses effectId:itemId for stackable", () => {
    assert.equal(
      fittingStateKey({ id: "abc", system: { effectId: "emergencyPowerCell", stackable: true } }),
      "emergencyPowerCell:abc",
    );
    assert.equal(
      fittingStateKey({ id: "abc", system: { effectId: "jumpJets" } }),
      "jumpJets",
    );
  });
});

describe("power-armor effectId catalog", () => {
  it("includes every pack armor-fitting effectId", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../packs/source/armor-fittings");
    const ids = new Set();
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith(".json")) {
          const data = JSON.parse(readFileSync(p, "utf8"));
          const id = data.system?.effectId;
          if (id) ids.add(id);
        }
      }
    };
    walk(root);
    assert.ok(ids.size >= 60, `expected many pack ids, got ${ids.size}`);
    for (const id of ids) {
      assert.ok(POWER_ARMOR_EFFECT_ID_SET.has(id), `missing catalog entry for ${id}`);
    }
  });

  it("resolveEmptySuitMode / applyEmptySuitDerived overlay book stats", () => {
    assert.equal(resolveEmptySuitMode({ fittingState: {} }).active, false);
    const on = resolveEmptySuitMode({ fittingState: { blackOfuda: { emptySuit: true } } });
    assert.equal(on.active, true);
    assert.equal(on.ab, EMPTY_SUIT_STATS.ab);
    assert.equal(on.hp, 15);
    assert.equal(on.move, 10);
    assert.equal(on.save, 14);
    const derived = applyEmptySuitDerived({ soakMax: 25, ac: 18 }, on);
    assert.equal(derived.soakMax, 15);
    assert.equal(derived.attackBonus, 6);
    assert.equal(derived.move, 10);
    assert.equal(derived.saveTarget, 14);
    assert.equal(derived.emptySuit.active, true);
  });

  it("tsukumogamiSkillBonus requires VI Main this round (or active OOC)", () => {
    globalThis.game = { combat: { round: 4 } };
    const item = {
      type: "armorFitting",
      system: { effectId: E.tsukumogamiProcessor, disabled: false },
    };
    const suit = {
      items: [item],
      system: {
        derived: { capabilities: { tsukumogami: true } },
        fittingState: { [E.tsukumogamiProcessor]: { lastUsedRound: 4 } },
      },
    };
    assert.equal(tsukumogamiSkillBonus(suit), 3);
    suit.system.fittingState[E.tsukumogamiProcessor].lastUsedRound = 3;
    assert.equal(tsukumogamiSkillBonus(suit), 0);
    globalThis.game = { combat: null };
    suit.system.fittingState[E.tsukumogamiProcessor] = { active: true };
    assert.equal(tsukumogamiSkillBonus(suit), 3);
    suit.system.fittingState[E.tsukumogamiProcessor] = { active: false };
    assert.equal(tsukumogamiSkillBonus(suit), 0);
  });
});
