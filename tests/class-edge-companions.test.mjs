/**
 * Unit tests for classEdge companion manifest helpers.
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  companionsForClassEdge,
  missingCompanions,
} from "../module/helpers/class-edge-grants.mjs";

describe("companionsForClassEdge", () => {
  it("lists Full Warrior companions", () => {
    assert.deepEqual(companionsForClassEdge("Full Warrior"), ["Veteran's Luck"]);
  });

  it("returns empty for unknown", () => {
    assert.deepEqual(companionsForClassEdge("Partial Warrior"), []);
  });
});

describe("missingCompanions", () => {
  it("skips names already owned", () => {
    assert.deepEqual(
      missingCompanions("Full Warrior", new Set(["veteran's luck", "alert"])),
      []
    );
    assert.deepEqual(
      missingCompanions("Full Expert", new Set(["alert"])),
      ["Masterful Expertise"]
    );
  });
});
