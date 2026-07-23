/**
 * Pack inventory tests for SWN/AWN/CWN classEdge items.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packs", "source");

function collect(dir, type = "classEdge") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collect(p, type));
    else if (ent.name.endsWith(".json") && !ent.name.startsWith("_")) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (data.type === type) out.push({ path: p, data });
    }
  }
  return out;
}

describe("SWN classEdge packs", () => {
  const items = collect(path.join(ROOT, "abilities-swn"));
  const byName = Object.fromEntries(items.map(({ data }) => [data.name, data]));

  it("has 6 class items", () => {
    assert.equal(items.length, 6);
  });

  it("Full Psychic grants Psychic Effort", () => {
    const p = byName["Full Psychic"];
    assert.equal(p.system.poolGrant.name, "Psychic Effort");
    assert.match(p.system.poolGrant.formula, /highestPsychic/);
    assert.equal(p.system.bonusSkillsPick, 2);
  });

  it("Full Warrior is warrior AB without Killing Blow AE", () => {
    const w = byName["Full Warrior"];
    assert.equal(w.system.attackProgression, "warrior");
    assert.equal(w.system.hdGrant.perLevelMod, 2);
    assert.equal(w.effects.length, 0);
    assert.deepEqual(w.system.companions, ["Veteran's Luck"]);
  });

  it("Full Expert uses Expert Skill Reroll companion", () => {
    assert.deepEqual(byName["Full Expert"].system.companions, ["Expert Skill Reroll"]);
  });
});

describe("AWN classEdge packs", () => {
  const items = collect(path.join(ROOT, "abilities-awn"));
  const byName = Object.fromEntries(items.map(({ data }) => [data.name, data]));

  it("has 20 edge items", () => {
    assert.equal(items.length, 20);
  });

  it("all items are edgeType edge", () => {
    for (const { data } of items) {
      assert.equal(data.system.edgeType, "edge", data.name);
    }
  });

  it("On Target is warrior AB", () => {
    assert.equal(byName["On Target"].system.attackProgression, "warrior");
  });

  it("Hard To Kill grants d6+2 and trauma AE", () => {
    const h = byName["Hard To Kill"];
    assert.equal(h.system.hdGrant.die, "d6");
    assert.equal(h.system.hdGrant.perLevelMod, 2);
    assert.ok(h.effects.some((e) =>
      (e.system?.changes ?? []).some((c) => c.key === "system.trauma.targetMod")));
  });

  it("Educated uses any-skill pick and 4 skill points", () => {
    const e = byName.Educated;
    assert.equal(e.system.skillPointsPerLevel, 4);
    assert.equal(e.system.bonusSkillsMode, "any");
    assert.equal(e.system.bonusSkillsPick, 1);
  });
});

describe("CWN classEdge packs", () => {
  const items = collect(path.join(ROOT, "abilities-cwn"));
  const byName = Object.fromEntries(items.map(({ data }) => [data.name, data]));

  it("has 14 edge items", () => {
    assert.equal(items.length, 14);
  });

  it("Killing Blow has half-level damage and trauma die AE", () => {
    const k = byName["Killing Blow"];
    const changes = k.effects.flatMap((e) => e.system?.changes ?? []);
    assert.ok(changes.some((c) => c.key === "system.combat.allDamage" && c.value === "@halfLevel"));
    assert.ok(changes.some((c) => c.key === "system.trauma.dieMod"));
  });

  it("Prodigy uses attributeGrant prodigy mode", () => {
    const p = byName.Prodigy;
    assert.equal(p.system.attributeGrant.mode, "prodigy");
    assert.deepEqual(p.system.attributeGrant.exclude, ["con"]);
  });
});
