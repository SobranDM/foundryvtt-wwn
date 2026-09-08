/**
 * Every classEdge that grants a named Effort pool must have at least one
 * backing power/art item to spend that Effort on. Guards against a repeat of
 * the Accursed/Bard/Beastmaster/Blood Priest/Duelist/Mageslayer/Skinshifter/
 * Thought Noble/Wise gap where the pool existed but no Arts did.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ABILITIES_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packs",
  "source",
  "abilities-wwn",
);
const CLASSES_ROOT = path.join(ABILITIES_ROOT, "Classes_wwnClsRoot000001");
const ARTS_ROOT = path.join(ABILITIES_ROOT, "Arts_Ppg5oHycFyEz3YFx");

function collectJson(dir, predicate) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectJson(p, predicate));
    else if (ent.name.endsWith(".json")) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (predicate(data)) out.push(data);
    }
  }
  return out;
}

describe("classEdge Effort pools have backing Arts", () => {
  const classEdges = collectJson(CLASSES_ROOT, (d) => d.type === "classEdge");
  const arts = collectJson(ARTS_ROOT, (d) => d.type === "power" && d.system?.subType === "art");

  const artSources = new Set(arts.map((a) => a.system.source));

  // "Full X" / "Partial X" classEdges share one pool under the base class name.
  // Only "X Effort"-named pools back Arts; Invoker's "Spell Points" pool feeds
  // the standalone Spells compendium instead and is intentionally excluded.
  const basePoolNames = new Set();
  for (const edge of classEdges) {
    const poolName = edge.system?.poolGrant?.name;
    if (!poolName || !poolName.endsWith(" Effort")) continue;
    basePoolNames.add(poolName.replace(/ Effort$/, ""));
  }

  it("collects a non-trivial number of classEdges and arts", () => {
    assert.ok(classEdges.length >= 23, `expected >=23 classEdges, got ${classEdges.length}`);
    assert.ok(arts.length >= 100, `expected >=100 art items, got ${arts.length}`);
  });

  for (const baseName of [...basePoolNames].sort()) {
    it(`"${baseName}" Effort pool has at least one backing art`, () => {
      assert.ok(
        artSources.has(baseName),
        `No power/art item has system.source === "${baseName}", but a classEdge grants "${baseName} Effort"`,
      );
    });
  }

  it("covers all nine previously-missing classes", () => {
    const restored = [
      "Accursed", "Bard", "Beastmaster", "Blood Priest", "Duelist",
      "Mageslayer", "Skinshifter", "Thought Noble", "Wise",
    ];
    for (const name of restored) {
      const count = arts.filter((a) => a.system.source === name).length;
      assert.ok(count > 0, `${name} still has no art items`);
    }
  });
});
