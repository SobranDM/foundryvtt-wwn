import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMaintenanceFailure,
  pickRandomFittingToDisable,
} from "../module/helpers/power-armor-maintenance.mjs";
import { FITTING_HANDLERS } from "../module/helpers/power-armor-effects.mjs";
import { POWER_ARMOR_EFFECT_IDS } from "../module/helpers/power-armor-budget.mjs";

describe("power-armor-maintenance", () => {
  it("maps roll totals to concrete failure applies", () => {
    assert.equal(resolveMaintenanceFailure(2).id, "glitch");
    assert.equal(resolveMaintenanceFailure(4).apply.cutRuntimeHalf, true);
    assert.equal(resolveMaintenanceFailure(6).apply.disableRandomFitting, true);
    assert.equal(resolveMaintenanceFailure(8).apply.soakMaxHalf, true);
    assert.equal(resolveMaintenanceFailure(12).apply.depower, true);
  });

  it("picks a non-integral fitting to disable", () => {
    const id = pickRandomFittingToDisable(
      [
        { id: "a", type: "armorFitting", system: { integral: true } },
        { id: "b", type: "armorFitting", system: { disabled: true } },
        { id: "c", type: "armorFitting", system: {} },
      ],
      () => 0,
    );
    assert.equal(id, "c");
  });
});

describe("power-armor-effects registry", () => {
  it("registers handlers for Phase B action and reaction fittings", () => {
    assert.equal(FITTING_HANDLERS[POWER_ARMOR_EFFECT_IDS.jumpJets].kind, "action");
    assert.equal(FITTING_HANDLERS[POWER_ARMOR_EFFECT_IDS.kineticRebukeShielding].kind, "reaction");
    assert.equal(FITTING_HANDLERS[POWER_ARMOR_EFFECT_IDS.blackOfuda].kind, "gate");
    assert.equal(FITTING_HANDLERS[POWER_ARMOR_EFFECT_IDS.identificationLock].kind, "gate");
    assert.ok(FITTING_HANDLERS[POWER_ARMOR_EFFECT_IDS.ghostWalkerField].toggleActive);
  });
});
