import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WWN_AREA_MULTIPLIERS,
  parseEffectPoints,
  combineWwnDifficulty,
  computeWwnCost,
  computeGodboundCost,
  sumContributions,
  fundedTotalFor,
  fundedFraction,
  shouldAutoLapse,
} from "../module/helpers/project-calculator.mjs";

describe("project-calculator: WWN Working cost/time", () => {
  it("parses a comma-separated effect point list, dropping invalid entries", () => {
    assert.deepEqual(parseEffectPoints("12, 6, 4"), [12, 6, 4]);
    assert.deepEqual(parseEffectPoints("12,,abc, -3, 0, 6"), [12, 6]);
    assert.deepEqual(parseEffectPoints(""), []);
  });

  it("combines a single effect to itself (no averaging with nothing)", () => {
    assert.equal(combineWwnDifficulty([12]), 12);
  });

  it("combines multi-effect Workings: highest + half the rest, rounded up", () => {
    // Rulebook example shape: highest 12, plus half of (6+4)=10 -> 5 -> 17
    assert.equal(combineWwnDifficulty([12, 6, 4]), 17);
    // Odd remainder rounds up: highest 10, rest 3 -> ceil(1.5)=2 -> 12
    assert.equal(combineWwnDifficulty([10, 3]), 12);
  });

  it("Trivial Working: 4 points, Room (x1) -> 1,000sp / minimum 4-week time", () => {
    const result = computeWwnCost({ effectPoints: "4", areaKey: "room", doubleSilver: false });
    assert.equal(WWN_AREA_MULTIPLIERS.room, 1);
    assert.equal(result.difficulty, 4);
    assert.equal(result.cost, 4000);
    // 4 base weeks + ceil(4/5)=1 -> 5
    assert.equal(result.weeks, 5);
  });

  it("Minor Working: 8 points, Building (x4) -> 32 difficulty, 32,000sp", () => {
    const result = computeWwnCost({ effectPoints: "8", areaKey: "building", doubleSilver: false });
    assert.equal(result.difficulty, 32);
    assert.equal(result.cost, 32000);
    // 4 + ceil(32/5)=7 -> 11
    assert.equal(result.weeks, 11);
  });

  it("Major multi-effect Working over a Village halves time when paying double silver", () => {
    // highest 12 + ceil((6+4)/2)=5 -> 17 difficulty x16 (village) = 272
    const result = computeWwnCost({ effectPoints: "12,6,4", areaKey: "village", doubleSilver: true });
    assert.equal(result.difficulty, 272);
    assert.equal(result.cost, 272000);
    // base weeks = 4 + ceil(272/5)=55 -> 59; halved -> ceil(59/2)=30
    assert.equal(result.weeks, 30);
  });

  it("Supreme Working over a Region scales to the x256 multiplier", () => {
    const result = computeWwnCost({ effectPoints: "40", areaKey: "region", doubleSilver: false });
    assert.equal(result.difficulty, 40 * 256);
    assert.equal(result.cost, 40 * 256 * 1000);
  });
});

describe("project-calculator: Godbound Fact-change cost", () => {
  it("City scope, Plausible magnitude, no opposition", () => {
    assert.deepEqual(computeGodboundCost({ scopeBase: 2, wardRating: 0, resistanceRating: 0, magnitudeMult: 1 }), {
      cost: 2,
    });
  });

  it("Region scope with a ward and a rival, Improbable magnitude", () => {
    // (4 + 5 + 3) * 2 = 24
    assert.deepEqual(
      computeGodboundCost({ scopeBase: 4, wardRating: 5, resistanceRating: 3, magnitudeMult: 2 }),
      { cost: 24 }
    );
  });

  it("Nation scope, Impossible-vast magnitude", () => {
    // (8 + 0 + 0) * 8 = 64
    assert.deepEqual(
      computeGodboundCost({ scopeBase: 8, wardRating: 0, resistanceRating: 0, magnitudeMult: 8 }),
      { cost: 64 }
    );
  });
});

describe("project-calculator: contribution sums / funding", () => {
  it("sums influence, dominion, and WWN resource contributions independently", () => {
    const contributions = [
      { influenceCommitted: 3, dominionSpent: 1, resourceContributed: 0 },
      { influenceCommitted: 2, dominionSpent: 0, resourceContributed: 0 },
      { influenceCommitted: 0, dominionSpent: 2, resourceContributed: 5000 },
    ];
    const sums = sumContributions(contributions);
    assert.deepEqual(sums, { influence: 5, dominion: 3, resource: 5000, total: 8 });
  });

  it("funded total picks influence+dominion for godbound, resource for wwn", () => {
    const sums = { influence: 5, dominion: 3, resource: 7000, total: 8 };
    assert.equal(fundedTotalFor("godbound", sums), 8);
    assert.equal(fundedTotalFor("wwn", sums), 7000);
  });

  it("funded fraction clamps to [0,1] and treats a non-positive max as 0", () => {
    assert.equal(fundedFraction(5, 10), 0.5);
    assert.equal(fundedFraction(15, 10), 1);
    assert.equal(fundedFraction(5, 0), 0);
    assert.equal(fundedFraction(5, -1), 0);
  });
});

describe("project-calculator: Godbound auto-lapse", () => {
  it("lapses an in-progress project whose funded total falls below its cost", () => {
    assert.equal(
      shouldAutoLapse({ gameLine: "godbound", status: "inProgress", fundedTotal: 5, resourceMax: 10 }),
      true
    );
  });

  it("lapses a maintained project the same way", () => {
    assert.equal(
      shouldAutoLapse({ gameLine: "godbound", status: "maintained", fundedTotal: 9, resourceMax: 10 }),
      true
    );
  });

  it("does not lapse when fully funded", () => {
    assert.equal(
      shouldAutoLapse({ gameLine: "godbound", status: "inProgress", fundedTotal: 10, resourceMax: 10 }),
      false
    );
  });

  it("never lapses a WWN project", () => {
    assert.equal(
      shouldAutoLapse({ gameLine: "wwn", status: "inProgress", fundedTotal: 0, resourceMax: 10 }),
      false
    );
  });

  it("never lapses planning or complete projects, even if underfunded", () => {
    assert.equal(
      shouldAutoLapse({ gameLine: "godbound", status: "planning", fundedTotal: 0, resourceMax: 10 }),
      false
    );
    assert.equal(
      shouldAutoLapse({ gameLine: "godbound", status: "complete", fundedTotal: 0, resourceMax: 10 }),
      false
    );
  });

  it("does not lapse when resource.max is unset (0)", () => {
    assert.equal(
      shouldAutoLapse({ gameLine: "godbound", status: "inProgress", fundedTotal: 0, resourceMax: 0 }),
      false
    );
  });
});
