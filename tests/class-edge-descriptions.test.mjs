import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packs",
  "source",
  "abilities",
  "Classes_wwnClsRoot000001",
);

const STUB_SNIPPETS = [
  "Effort and spell Cast/Prepared from the SRD tables",
  "Pair with another Partial class via Adventurer",
  "No Killing Blow or Veteran's Luck",
  "Quick Learner (+1 skill point/level",
];

function collectClassEdges(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectClassEdges(p));
    else if (ent.name.endsWith(".json")) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (data.type === "classEdge") out.push({ path: p, data });
    }
  }
  return out;
}

describe("classEdge pack descriptions", () => {
  const items = collectClassEdges(ROOT);

  it("finds all 23 classEdge items", () => {
    assert.equal(items.length, 23);
  });

  it("each description is a real write-up, not a stub", () => {
    for (const { path: p, data } of items) {
      const desc = data.system?.description ?? "";
      const plain = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      assert.ok(plain.length >= 400, `${data.name} too short (${plain.length}): ${p}`);
      for (const stub of STUB_SNIPPETS) {
        assert.ok(!plain.includes(stub), `${data.name} still has stub text: ${stub}`);
      }
      assert.ok(desc.includes("<p>"), `${data.name} should use HTML paragraphs`);
    }
  });
});
