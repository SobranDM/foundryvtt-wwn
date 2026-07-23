/**
 * Unit tests for commitment reclaim / pool totals.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  poolCommittedTotal,
  shouldReclaimCommitment,
} from "../module/helpers/commitment.mjs";

describe("poolCommittedTotal", () => {
  it("sums known commitment keys", () => {
    assert.equal(poolCommittedTotal(null), 0);
    assert.equal(poolCommittedTotal({ scene: 2, day: 1, active: 0, none: 0 }), 3);
  });
});

describe("shouldReclaimCommitment", () => {
  it("never reclaims none", () => {
    assert.equal(shouldReclaimCommitment("scene", "none", false), false);
    assert.equal(shouldReclaimCommitment("day", "none", true), false);
  });

  it("day scope reclaims any non-none length", () => {
    assert.equal(shouldReclaimCommitment("day", "scene", true), true);
    assert.equal(shouldReclaimCommitment("day", "active", true), true);
    assert.equal(shouldReclaimCommitment("day", "day", false), true);
  });

  it("scene scope reclaims scene always and active only when inactive", () => {
    assert.equal(shouldReclaimCommitment("scene", "scene", true), true);
    assert.equal(shouldReclaimCommitment("scene", "active", false), true);
    assert.equal(shouldReclaimCommitment("scene", "active", true), false);
    assert.equal(shouldReclaimCommitment("scene", "day", false), false);
  });
});
