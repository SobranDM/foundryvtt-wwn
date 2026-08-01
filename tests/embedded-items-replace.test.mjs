/**
 * Embedded item replace detection (migration orchestration helper).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { embeddedItemsNeedReplace } from "../module/migration/embedded-items.mjs";

describe("embeddedItemsNeedReplace", () => {
  it("returns false when types and systems match", () => {
    const items = [{ type: "weapon", system: { ammoMode: "linked" } }];
    assert.equal(embeddedItemsNeedReplace(items, items), false);
  });

  it("detects system-only diffs (e.g. ammoMode / tl backfill)", () => {
    const before = [{ type: "weapon", system: {} }];
    const after = [{ type: "weapon", system: { ammoMode: "none", firearm: false } }];
    assert.equal(embeddedItemsNeedReplace(before, after), true);
  });

  it("detects type / legacy type changes", () => {
    assert.equal(
      embeddedItemsNeedReplace(
        [{ type: "art", system: {} }],
        [{ type: "power", system: { subtype: "art" } }]
      ),
      true
    );
  });

  it("detects length mismatch", () => {
    assert.equal(
      embeddedItemsNeedReplace([{ type: "item", system: {} }], []),
      true
    );
  });
});
