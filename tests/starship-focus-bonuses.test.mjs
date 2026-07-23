/**
 * Unit tests for starship focus bonus helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  starshipFocusBonusesFromActor,
  mergeStarshipFocusBonuses,
} from "../module/helpers/starship-focus-bonuses.mjs";

describe("starshipFocusBonusesFromActor", () => {
  it("reads derived starship flags from a PC-like actor", () => {
    const actor = {
      system: {
        starship: {
          commandPointsBonus: 2,
          combatBonusHpPercent: 20,
          spikeDrillAutoSucceedDiff: 10,
          spikeDrillDoublePilot: true,
          spikeDriveLevelBonus: 1,
        },
      },
    };
    assert.deepEqual(starshipFocusBonusesFromActor(actor), {
      commandPointsBonus: 2,
      combatBonusHpPercent: 20,
      spikeDrillAutoSucceedDiff: 10,
      spikeDrillDoublePilot: true,
      spikeDriveLevelBonus: 1,
    });
  });

  it("returns zeros for missing actors", () => {
    assert.equal(starshipFocusBonusesFromActor(null).commandPointsBonus, 0);
  });
});

describe("mergeStarshipFocusBonuses", () => {
  it("sums CP and drive, maxes percent/diff, ORs double pilot", () => {
    const merged = mergeStarshipFocusBonuses(
      {
        commandPointsBonus: 2,
        combatBonusHpPercent: 20,
        spikeDrillAutoSucceedDiff: 8,
        spikeDrillDoublePilot: false,
        spikeDriveLevelBonus: 0,
      },
      {
        commandPointsBonus: 0,
        combatBonusHpPercent: 0,
        spikeDrillAutoSucceedDiff: 10,
        spikeDrillDoublePilot: true,
        spikeDriveLevelBonus: 1,
      },
    );
    assert.deepEqual(merged, {
      commandPointsBonus: 2,
      combatBonusHpPercent: 20,
      spikeDrillAutoSucceedDiff: 10,
      spikeDrillDoublePilot: true,
      spikeDriveLevelBonus: 1,
    });
  });
});
