/**
 * Power-armor weapon skill resolution against the pilot.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePilotWeaponSkill } from "../module/helpers/power-armor-pilot-skill.mjs";

describe("resolvePilotWeaponSkill", () => {
  const punch = { id: "s1", type: "skill", name: "Punch" };
  const pilot = {
    items: {
      get: (id) => (id === "s1" ? punch : null),
      find: (fn) => [punch].find(fn),
    },
  };

  it("resolves skillId on the pilot", () => {
    assert.equal(
      resolvePilotWeaponSkill(pilot, { system: { skillId: "s1", skillFallback: "" } }),
      punch,
    );
  });

  it("resolves skillFallback by name on the pilot", () => {
    assert.equal(
      resolvePilotWeaponSkill(pilot, { system: { skillId: "", skillFallback: "punch" } }),
      punch,
    );
  });

  it("resolves string linkedSkill (armor fittings)", () => {
    assert.equal(
      resolvePilotWeaponSkill(pilot, { system: { linkedSkill: "Punch" } }),
      punch,
    );
  });

  it("does not use Item.toString from a linkedSkill getter result", () => {
    assert.equal(
      resolvePilotWeaponSkill(pilot, { system: { linkedSkill: punch } }),
      punch,
    );
  });

  it("returns null when missing", () => {
    assert.equal(
      resolvePilotWeaponSkill(pilot, { system: { skillId: "", skillFallback: "" } }),
      null,
    );
  });
});
