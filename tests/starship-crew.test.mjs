import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STATIONS,
  DEFAULT_STATION_SKILL,
  resolveStation,
  maintenanceCost,
  findSkillItem,
  findStationSkillItem,
  gunnerySkillName,
  bestAttributeMod,
  buildStationAssignmentUpdate,
} from "../module/helpers/starship-crew.mjs";

describe("starship-crew", () => {
  it("exports station list and default skills", () => {
    assert.deepEqual(STATIONS, ["bridge", "gunnery", "engineering", "comms", "captain"]);
    assert.equal(DEFAULT_STATION_SKILL.bridge, "Pilot");
    assert.equal(DEFAULT_STATION_SKILL.gunnery, "Shoot");
    assert.equal(DEFAULT_STATION_SKILL.engineering, "Fix");
    assert.equal(DEFAULT_STATION_SKILL.comms, "Program");
    assert.equal(DEFAULT_STATION_SKILL.captain, "Lead");
  });

  it("prefers linked actor over formula", () => {
    const actor = { uuid: "Actor.abc123", name: "Helmsman" };
    const result = resolveStation(
      { actor: "Actor.abc123", formula: "2d6+2" },
      { getActor: () => actor },
    );
    assert.equal(result.mode, "actor");
    assert.equal(result.actor, actor);
    assert.equal(result.actorUuid, "Actor.abc123");
  });

  it("falls through to formula when actor UUID does not resolve", () => {
    const result = resolveStation(
      { actor: "Actor.missing", formula: "  1d8+1  " },
      { getActor: () => null },
    );
    assert.equal(result.mode, "formula");
    assert.equal(result.formula, "1d8+1");
  });

  it("returns unassigned when actor and formula are empty", () => {
    assert.deepEqual(resolveStation({ actor: null, formula: "" }), { mode: "unassigned" });
    assert.deepEqual(resolveStation({ actor: "", formula: "   " }), { mode: "unassigned" });
    assert.deepEqual(resolveStation({}), { mode: "unassigned" });
  });

  it("computes six-month maintenance as 5% of ship cost", () => {
    assert.equal(maintenanceCost(1_000_000), 50_000);
    assert.equal(maintenanceCost(999), Math.floor(999 * 0.05));
    assert.equal(maintenanceCost(0), 0);
  });
});

describe("findSkillItem", () => {
  const items = [
    { type: "skill", name: "Shoot" },
    { type: "skill", name: "Pilot" },
    { type: "weapon", name: "Shoot" },
  ];

  it("matches skill items by name, case-insensitively", () => {
    assert.equal(findSkillItem(items, "shoot"), items[0]);
    assert.equal(findSkillItem(items, "PILOT"), items[1]);
  });

  it("ignores non-skill items with a matching name", () => {
    assert.equal(findSkillItem([items[2]], "Shoot"), null);
  });

  it("returns null when no match or inputs are empty", () => {
    assert.equal(findSkillItem(items, "Fix"), null);
    assert.equal(findSkillItem([], "Shoot"), null);
    assert.equal(findSkillItem(items, ""), null);
    assert.equal(findSkillItem(null, "Shoot"), null);
  });
});

describe("findStationSkillItem", () => {
  it("prefers the SWN-named skill when present", () => {
    const items = [
      { type: "skill", name: "Sail" },
      { type: "skill", name: "Pilot" },
    ];
    assert.equal(findStationSkillItem(items, "Pilot"), items[1]);
  });

  it("falls back to WWN aliases (Pilot→Sail, Fix→Craft, Program→Know)", () => {
    assert.equal(
      findStationSkillItem([{ type: "skill", name: "Sail" }], "Pilot")?.name,
      "Sail",
    );
    assert.equal(
      findStationSkillItem([{ type: "skill", name: "Craft" }], "Fix")?.name,
      "Craft",
    );
    assert.equal(
      findStationSkillItem([{ type: "skill", name: "Know" }], "Program")?.name,
      "Know",
    );
  });
});

describe("gunnerySkillName", () => {
  it("uses Pilot on fighters, Shoot on every other hull class", () => {
    assert.equal(gunnerySkillName("fighter"), "Pilot");
    assert.equal(gunnerySkillName("frigate"), "Shoot");
    assert.equal(gunnerySkillName("cruiser"), "Shoot");
    assert.equal(gunnerySkillName(undefined), "Shoot");
  });
});

describe("bestAttributeMod", () => {
  it("returns the better of Int/Dex mod", () => {
    assert.equal(bestAttributeMod({ int: { mod: 1 }, dex: { mod: 3 } }), 3);
    assert.equal(bestAttributeMod({ int: { mod: 2 }, dex: { mod: -1 } }), 2);
  });

  it("defaults missing mods to 0", () => {
    assert.equal(bestAttributeMod({}), 0);
    assert.equal(bestAttributeMod(undefined), 0);
  });
});

describe("buildStationAssignmentUpdate", () => {
  it("assigns an actor UUID to the chosen station", () => {
    assert.deepEqual(buildStationAssignmentUpdate({}, "bridge", "Actor.abc"), {
      "system.stations.bridge.actor": "Actor.abc",
    });
  });

  it("clears the same UUID from other stations when exclusive", () => {
    const stations = {
      bridge: { actor: "Actor.abc" },
      gunnery: { actor: "Actor.xyz" },
      engineering: { actor: null },
    };
    const updates = buildStationAssignmentUpdate(stations, "captain", "Actor.abc", {
      exclusive: true,
    });
    assert.equal(updates["system.stations.captain.actor"], "Actor.abc");
    assert.equal(updates["system.stations.bridge.actor"], null);
    assert.equal(updates["system.stations.gunnery.actor"], undefined);
  });

  it("returns empty for unknown stations", () => {
    assert.deepEqual(buildStationAssignmentUpdate({}, "cargo", "Actor.abc"), {});
  });
});

describe("starship station roll wiring", () => {
  it("passes a ship and department title to actor-linked skill rolls", () => {
    const source = readFileSync(
      new URL("../module/helpers/starship-rolls.mjs", import.meta.url),
      "utf8",
    );

    assert.match(source, /const title = `\$\{starship\.name\}: \$\{stationLabel\}`;/);
    assert.match(
      source,
      /WwnDice\.rollSkill\(resolved\.actor, skill, \{ skipDialog, title \}\)/,
    );
    assert.match(source, /resolveSkillDiceFormula/);
  });
});
