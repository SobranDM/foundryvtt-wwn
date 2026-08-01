import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  derivePowerArmorEffects,
  weaponMountBonuses,
  resolveCamoStealthBonus,
  resolvePowerArmorTraumaGate,
  isShockImmuneTarget,
} from "../module/helpers/power-armor-derive.mjs";
import { PHASE_A_EFFECT_IDS } from "../module/helpers/power-armor-budget.mjs";

describe("power-armor-derive", () => {
  it("applies basic plating when powered and not inert", () => {
    const d = derivePowerArmorEffects(
      [{ type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingBasic } }],
      { powered: true, inert: false },
    );
    assert.equal(d.ac, 18);
    assert.equal(d.soakMax, 20);
    assert.equal(d.shockImmune, true);
  });

  it("halves soak and reduces AC with plating optimization", () => {
    const d = derivePowerArmorEffects(
      [
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingBasic } },
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingOptimization } },
      ],
      { powered: true, inert: false },
    );
    assert.equal(d.ac, 16);
    assert.equal(d.soakMax, 10);
  });

  it("keeps plating AC/Soak when depowered but drops exo", () => {
    const d = derivePowerArmorEffects(
      [
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingAdvanced } },
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.exoBasic } },
      ],
      { powered: false, inert: false },
    );
    assert.equal(d.ac, 20);
    assert.equal(d.soakMax, 25);
    assert.equal(d.effectiveStrength, null);
  });

  it("grants no benefits when inert even if powered", () => {
    const d = derivePowerArmorEffects(
      [{ type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingPretech } }],
      { powered: true, inert: true },
    );
    assert.equal(d.ac, 10);
    assert.equal(d.soakMax, 0);
  });

  it("sets efficiency runtime and Tarnkappe multiplier", () => {
    const d = derivePowerArmorEffects(
      [{ type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.efficiencyAdvanced } }],
      { powered: true, inert: false, runtimeMultiplier: 0.2 },
    );
    assert.equal(d.runtimeMax, Math.floor(480 * 0.2));
  });

  it("forbids efficiency on Culverin-style frames", () => {
    const d = derivePowerArmorEffects(
      [{ type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.efficiencyBasic } }],
      { powered: true, inert: false, forbidEfficiency: true },
    );
    assert.equal(d.efficiency, null);
    assert.equal(d.runtimeMax, 30);
  });

  it("returns mount bonuses", () => {
    assert.equal(weaponMountBonuses(PHASE_A_EFFECT_IDS.weaponMountBasic).attackBonus, 2);
    assert.equal(weaponMountBonuses(PHASE_A_EFFECT_IDS.weaponMountAdvanced).damageBonus, 3);
  });

  it("adds Regenerative Force Field soak when active", () => {
    const d = derivePowerArmorEffects(
      [
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.platingBasic } },
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.regenerativeForceField } },
      ],
      { powered: true, inert: false },
    );
    assert.equal(d.soakMax, 30);
  });

  it("applies Camo Skin stealth bonus when active", () => {
    const d = derivePowerArmorEffects(
      [{ type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.camoSkinAdvanced } }],
      { powered: true, inert: false },
    );
    assert.equal(d.stealthBonus, 2);
  });

  it("counts Emergency Power Cells when active", () => {
    const d = derivePowerArmorEffects(
      [
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.emergencyPowerCell } },
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.emergencyPowerCell } },
        { type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.emergencyPowerCell, disabled: true } },
      ],
      { powered: true, inert: false },
    );
    assert.equal(d.emergencyCells, 2);
  });

  it("derives Phase B capability flags", () => {
    const d = derivePowerArmorEffects(
      [
        { type: "armorFitting", system: { effectId: "sealedSystemsAdvanced" } },
        { type: "armorFitting", system: { effectId: "thermalAblativeLayer" } },
        { type: "armorFitting", system: { effectId: "graviticFoldFlight" } },
        { type: "armorFitting", system: { effectId: "brainguardCap" } },
      ],
      { powered: true, inert: false },
    );
    assert.equal(d.capabilities.sealed, "advanced");
    assert.equal(d.capabilities.thermalAblative, true);
    assert.equal(d.capabilities.flight, "fold");
    assert.equal(d.capabilities.brainguard, true);
    assert.ok(d.capabilityBadges.length >= 3);
  });

  it("gates camo basic stealth bonus by range", () => {
    const d = derivePowerArmorEffects(
      [{ type: "armorFitting", system: { effectId: PHASE_A_EFFECT_IDS.camoSkinBasic } }],
      { powered: true, inert: false },
    );
    assert.equal(d.stealthBonusRangeM, 20);
    assert.equal(resolveCamoStealthBonus(d, 10), 2);
    assert.equal(resolveCamoStealthBonus(d, 25), 0);
    assert.equal(resolveCamoStealthBonus(d, null), 2);
  });

  it("applies trauma gate for pretech plating", () => {
    const target = {
      type: "powerArmor",
      system: {
        trauma: { value: 6 },
        derived: { traumaTargetBonus: 2, traumaOnlyVehicles: true },
      },
    };
    const blocked = resolvePowerArmorTraumaGate(target, { system: {} });
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.traumaTarget, 8);
    const ok = resolvePowerArmorTraumaGate(target, { system: { vehicleWeapon: true } });
    assert.equal(ok.blocked, false);
  });

  it("detects shock immunity from derived plating", () => {
    assert.equal(isShockImmuneTarget({ system: { derived: { shockImmune: true } } }), true);
    assert.equal(isShockImmuneTarget({ system: { combat: { immuneToShock: true } } }), true);
    assert.equal(isShockImmuneTarget({ system: {} }), false);
  });
});
