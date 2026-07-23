/**
 * Skill-set pack ids after abilities consolidation.
 * Run: node --test tests/skill-set-packs.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WWN } from "../module/config/index.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("skillSetPacks", () => {
  it("points at abilities packs per line", () => {
    assert.equal(WWN.skillSetPacks.wwn, "wwn.abilities-wwn");
    assert.equal(WWN.skillSetPacks.swn, "wwn.abilities-swn");
    assert.equal(WWN.skillSetPacks.awn, "wwn.abilities-awn");
    assert.equal(WWN.skillSetPacks.cwn, "wwn.abilities-cwn");
  });
});

describe("abilities pack source layout", () => {
  for (const pack of ["abilities-wwn", "abilities-swn", "abilities-awn", "abilities-cwn"]) {
    it(`${pack} has a Skills folder with skill items`, () => {
      const dir = path.join(ROOT, "packs", "source", pack);
      assert.ok(fs.existsSync(dir), `${pack} source missing`);

      function* walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) yield* walk(p);
          else if (e.name.endsWith(".json")) yield p;
        }
      }

      let skillsFolder = null;
      const skills = [];
      for (const file of walk(dir)) {
        const doc = JSON.parse(fs.readFileSync(file, "utf8"));
        if (doc._key?.startsWith("!folders") && doc.name === "Skills" && !doc.folder) {
          skillsFolder = doc;
        }
        if (doc.type === "skill") skills.push(doc);
      }

      assert.ok(skillsFolder, `${pack}: Skills folder missing`);
      assert.ok(skills.length > 0, `${pack}: no skills`);
      for (const s of skills) {
        assert.equal(s.folder, skillsFolder._id, `${s.name} not in Skills folder`);
      }
    });
  }

  it("abilities-cwn marks Cast and Summon as secondary", () => {
    const dir = path.join(ROOT, "packs", "source", "abilities-cwn");
    function* walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) yield* walk(p);
        else if (e.name.endsWith(".json")) yield p;
      }
    }
    const bySlug = new Map();
    for (const file of walk(dir)) {
      const doc = JSON.parse(fs.readFileSync(file, "utf8"));
      if (doc.type === "skill") bySlug.set(doc.system.slug, doc);
    }
    assert.equal(bySlug.get("cast")?.system.secondary, true);
    assert.equal(bySlug.get("summon")?.system.secondary, true);
    assert.equal(bySlug.get("drive")?.system.secondary, false);
    const primary = [...bySlug.values()].filter((s) => !s.system.secondary);
    assert.equal(primary.length, 19);
  });

  it("abilities-cwn includes CWN foci", () => {
    const dir = path.join(ROOT, "packs", "source", "abilities-cwn");
    function* walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) yield* walk(p);
        else if (e.name.endsWith(".json")) yield p;
      }
    }
    const foci = [];
    for (const file of walk(dir)) {
      const doc = JSON.parse(fs.readFileSync(file, "utf8"));
      if (doc.type === "focus") foci.push(doc.name);
    }
    assert.ok(foci.includes("Ace Driver"));
    assert.ok(foci.includes("All Natural"));
    assert.ok(foci.includes("Unregistered"));
    assert.equal(foci.length, 26);
  });

  it("system.json declares abilities packs and not legacy skills packs", () => {
    const system = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
    const names = system.packs.map((p) => p.name);
    assert.ok(names.includes("abilities-wwn"));
    assert.ok(names.includes("abilities-swn"));
    assert.ok(names.includes("abilities-awn"));
    assert.ok(names.includes("abilities-cwn"));
    assert.ok(!names.includes("abilities"));
    assert.ok(!names.includes("skills-wwn"));
    assert.ok(!names.includes("skills-swn"));
    assert.ok(!names.includes("skills-awn"));
    const cwnFolder = system.packFolders.find((f) => f.name === "Cities Without Number");
    assert.ok(cwnFolder?.packs.includes("abilities-cwn"));
  });
});
