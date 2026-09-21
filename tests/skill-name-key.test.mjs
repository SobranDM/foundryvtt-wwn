/**
 * Skill formula keys come from the item name, never a stored slug.
 * Run: node --test tests/skill-name-key.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { skillSlugOf, skillCreateDataFromPackDocs } from "../module/helpers/skill-set.mjs";
import { findSkillBySlug } from "../module/helpers/bonus-skills-shared.mjs";
import { applyEmbeddedItemMigration, migrateItemData } from "../module/migration/transforms.mjs";

describe("skillSlugOf", () => {
  it("derives the formula key from the name", () => {
    assert.equal(skillSlugOf({ name: "Sunblade", type: "skill", system: {} }), "sunblade");
    assert.equal(skillSlugOf({ name: "Exert", type: "skill", system: {} }), "exert");
  });

  it("ignores a leftover stored slug that disagrees with the name", () => {
    const skill = {
      name: "Sunblade",
      type: "skill",
      system: { slug: "biopsionics", ownedLevel: 1 },
    };
    assert.equal(skillSlugOf(skill), "sunblade");
  });
});

describe("findSkillBySlug", () => {
  it("matches the renamed skill, not the leftover slug", () => {
    const actor = {
      items: [
        { type: "skill", name: "Sunblade", system: { slug: "biopsionics", ownedLevel: 1 } },
      ],
    };
    assert.equal(findSkillBySlug(actor, "sunblade")?.name, "Sunblade");
    assert.equal(findSkillBySlug(actor, "biopsionics"), undefined);
  });
});

describe("skillCreateDataFromPackDocs", () => {
  it("looks up pack skills by name, not a stored slug", () => {
    const docs = [
      {
        name: "Biopsionics",
        type: "skill",
        _id: "sGRJCGdERZt1iQHK",
        folder: "K5CjewzS46t4IezS",
        system: { secondary: true, ownedLevel: -1, score: "int" },
      },
    ];
    const data = skillCreateDataFromPackDocs(docs, "biopsionics");
    assert.equal(data.name, "Biopsionics");
    assert.equal(data.system.slug, undefined);
    assert.equal(data._id, undefined);
  });
});

describe("skill slug migration", () => {
  it("strips leftover system.slug from an already-modern skill", () => {
    const item = {
      _id: "s1",
      name: "Sunblade",
      type: "skill",
      system: {
        description: "",
        ownedLevel: 1,
        score: "int",
        secondary: false,
        slug: "biopsionics",
        pointsInvested: 0,
      },
    };
    const patch = migrateItemData(item);
    assert.ok(patch);
    const out = applyEmbeddedItemMigration(item);
    assert.equal(out.system.slug, undefined);
    assert.equal(out.system.ownedLevel, 1);
    assert.equal(out.name, "Sunblade");
  });

  it("does not rewrite a skill that already has no slug", () => {
    const item = {
      _id: "s2",
      name: "Exert",
      type: "skill",
      system: {
        ownedLevel: 1,
        score: "str",
        secondary: false,
        pointsInvested: 0,
      },
    };
    assert.equal(migrateItemData(item), null);
  });
});
