/**
 * Unit tests for the granted-skill bookkeeping in bonus-skills-shared.mjs,
 * specifically the target-tracking added so a deleted skill's stale "already
 * granted" record can be cleared (no Foundry runtime beyond shim).
 * Run: node --test tests/bonus-skills-shared.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasGrantedSkill,
  recordGrantedSkill,
  clearGrantedSkillsForDeletedTarget,
  GRANTED_SKILLS_FLAG,
  GRANTED_SKILL_TARGETS_FLAG,
} from "../module/helpers/bonus-skills-shared.mjs";

function mockItem({ type = "focus", id = "item1", flags = {} } = {}) {
  const item = {
    type,
    id,
    flags: foundry_deepClone(flags),
    getFlag(ns, key) {
      return this.flags?.[ns]?.[key];
    },
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        applyDottedUpdate(item, path, value);
      }
    },
  };
  return item;
}

// Minimal stand-ins so this file doesn't depend on the shim's foundry.utils shape.
function foundry_deepClone(obj) {
  return JSON.parse(JSON.stringify(obj ?? {}));
}

/** Applies one `"flags.wwn.key"` / `"flags.wwn.key.-=sub"` style update path to a mock item. */
function applyDottedUpdate(item, path, value) {
  const deleteMatch = path.match(/^(.*)\.-=([^.]+)$/);
  if (deleteMatch) {
    const [, parentPath, subKey] = deleteMatch;
    const parent = getDottedPath(item, parentPath);
    if (parent) delete parent[subKey];
    return;
  }
  setDottedPath(item, path, value);
}

function getDottedPath(item, path) {
  const parts = path.split(".");
  let cur = item;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setDottedPath(item, path, value) {
  const parts = path.split(".");
  let cur = item;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

describe("recordGrantedSkill", () => {
  it("records the granted slug and, when given, the actual target skill id", async () => {
    const focus = mockItem();
    await recordGrantedSkill(focus, "fix", "skillItemId42");
    assert.equal(hasGrantedSkill(focus, "fix"), true);
    assert.deepEqual(focus.getFlag("wwn", GRANTED_SKILL_TARGETS_FLAG), { fix: "skillItemId42" });
  });

  it("still works with no target id (existing callers unaffected)", async () => {
    const focus = mockItem();
    await recordGrantedSkill(focus, "notice");
    assert.equal(hasGrantedSkill(focus, "notice"), true);
    assert.equal(focus.getFlag("wwn", GRANTED_SKILL_TARGETS_FLAG), undefined);
  });

  it("accumulates across multiple grants on the same item", async () => {
    const focus = mockItem();
    await recordGrantedSkill(focus, "survive", "skillA");
    await recordGrantedSkill(focus, "connect", "skillB");
    assert.deepEqual(focus.getFlag("wwn", GRANTED_SKILLS_FLAG), ["survive", "connect"]);
    assert.deepEqual(focus.getFlag("wwn", GRANTED_SKILL_TARGETS_FLAG), { survive: "skillA", connect: "skillB" });
  });
});

describe("clearGrantedSkillsForDeletedTarget", () => {
  it("removes only the slug(s) that targeted the deleted skill, on every granting item type", async () => {
    const focus = mockItem({
      type: "focus",
      flags: {
        wwn: {
          [GRANTED_SKILLS_FLAG]: ["fix", "notice"],
          [GRANTED_SKILL_TARGETS_FLAG]: { fix: "deletedSkillId", notice: "otherSkillId" },
        },
      },
    });
    const power = mockItem({
      type: "power",
      id: "power1",
      flags: {
        wwn: {
          [GRANTED_SKILLS_FLAG]: ["talk"],
          [GRANTED_SKILL_TARGETS_FLAG]: { talk: "deletedSkillId" },
        },
      },
    });
    const untouchedFocus = mockItem({
      type: "focus",
      id: "focus2",
      flags: {
        wwn: {
          [GRANTED_SKILLS_FLAG]: ["stab"],
          [GRANTED_SKILL_TARGETS_FLAG]: { stab: "unrelatedSkillId" },
        },
      },
    });
    const skillItem = mockItem({ type: "skill", id: "irrelevant" });
    const actor = { items: [focus, power, untouchedFocus, skillItem] };

    await clearGrantedSkillsForDeletedTarget(actor, "deletedSkillId");

    assert.deepEqual(focus.getFlag("wwn", GRANTED_SKILLS_FLAG), ["notice"]);
    assert.deepEqual(focus.getFlag("wwn", GRANTED_SKILL_TARGETS_FLAG), { notice: "otherSkillId" });
    assert.deepEqual(power.getFlag("wwn", GRANTED_SKILLS_FLAG), []);
    assert.deepEqual(power.getFlag("wwn", GRANTED_SKILL_TARGETS_FLAG), {});
    // Untouched items are never written.
    assert.deepEqual(untouchedFocus.getFlag("wwn", GRANTED_SKILLS_FLAG), ["stab"]);
  });

  it("does nothing when no granting item targeted the deleted skill", async () => {
    const focus = mockItem({
      type: "focus",
      flags: {
        wwn: {
          [GRANTED_SKILLS_FLAG]: ["fix"],
          [GRANTED_SKILL_TARGETS_FLAG]: { fix: "someOtherSkillId" },
        },
      },
    });
    const actor = { items: [focus] };
    await clearGrantedSkillsForDeletedTarget(actor, "deletedSkillId");
    assert.deepEqual(focus.getFlag("wwn", GRANTED_SKILLS_FLAG), ["fix"]);
  });

  it("handles items with no target-tracking flag at all (grants recorded before this fix)", async () => {
    const focus = mockItem({
      type: "focus",
      flags: { wwn: { [GRANTED_SKILLS_FLAG]: ["fix"] } },
    });
    const actor = { items: [focus] };
    await clearGrantedSkillsForDeletedTarget(actor, "deletedSkillId");
    assert.deepEqual(focus.getFlag("wwn", GRANTED_SKILLS_FLAG), ["fix"]);
  });
});
