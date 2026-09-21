/**
 * Unit tests for the default-party ensure-on-load check (no Foundry runtime
 * beyond shim + a minimal `game`/`Actor` mock).
 * Run: node --test tests/party-migration.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  collectFlaggedPartyMemberUuids,
  maybeCreateDefaultParty,
} from "../module/migration/party-migration.mjs";

function mockPc({ uuid, flagged }) {
  return {
    type: "character",
    uuid,
    getFlag: (ns, key) => (ns === "wwn" && key === "party" ? flagged : undefined),
  };
}

describe("collectFlaggedPartyMemberUuids", () => {
  it("collects only PCs flagged flags.wwn.party === true", () => {
    const actors = [
      mockPc({ uuid: "Actor.a", flagged: true }),
      mockPc({ uuid: "Actor.b", flagged: false }),
      { type: "monster", uuid: "Actor.c", getFlag: () => true },
    ];
    assert.deepEqual(collectFlaggedPartyMemberUuids(actors), ["Actor.a"]);
  });

  it("returns an empty array when given nothing", () => {
    assert.deepEqual(collectFlaggedPartyMemberUuids(undefined), []);
    assert.deepEqual(collectFlaggedPartyMemberUuids([]), []);
  });
});

describe("maybeCreateDefaultParty", () => {
  const originalGame = globalThis.game;
  const originalActor = globalThis.Actor;

  function mockGame({ isGM = true, actors = [], settings = {} } = {}) {
    const store = { ...settings };
    return {
      user: { isGM },
      actors: Object.assign([...actors], { some: (fn) => actors.some(fn), contents: actors }),
      i18n: { localize: (key) => key },
      settings: {
        get: (_ns, key) => store[key] ?? false,
        set: async (_ns, key, value) => {
          store[key] = value;
        },
      },
    };
  }

  afterEach(() => {
    globalThis.game = originalGame;
    globalThis.Actor = originalActor;
  });

  it("does nothing for a non-GM user", async () => {
    let created = false;
    globalThis.Actor = { implementation: { create: async () => { created = true; } } };
    globalThis.game = mockGame({ isGM: false, actors: [mockPc({ uuid: "Actor.a", flagged: true })] });
    await maybeCreateDefaultParty();
    assert.equal(created, false);
  });

  it("creates a default party named 'Party' with no flagged PCs", async () => {
    const createCalls = [];
    globalThis.Actor = { implementation: { create: async (data) => { createCalls.push(data); return data; } } };
    globalThis.game = mockGame({ actors: [mockPc({ uuid: "Actor.a", flagged: false })] });
    await maybeCreateDefaultParty();
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].type, "party");
    assert.equal(createCalls[0].name, "WWN.party.defaultName");
    assert.deepEqual(createCalls[0].system.members, []);
  });

  it("creates exactly one default party seeded from flagged PCs, and marks the legacy seed done", async () => {
    const createCalls = [];
    globalThis.Actor = { implementation: { create: async (data) => { createCalls.push(data); return data; } } };
    globalThis.game = mockGame({
      actors: [
        mockPc({ uuid: "Actor.a", flagged: true }),
        mockPc({ uuid: "Actor.b", flagged: true }),
        mockPc({ uuid: "Actor.c", flagged: false }),
      ],
    });
    await maybeCreateDefaultParty();
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].type, "party");
    assert.deepEqual(createCalls[0].system.members, ["Actor.a", "Actor.b"]);
    assert.equal(globalThis.game.settings.get("wwn", "partyLegacySeedDone"), true);
  });

  it("does not create a second party if one already exists, regardless of name", async () => {
    let created = false;
    globalThis.Actor = { implementation: { create: async () => { created = true; } } };
    globalThis.game = mockGame({
      actors: [
        mockPc({ uuid: "Actor.a", flagged: true }),
        { type: "party", uuid: "Actor.existingParty" },
      ],
    });
    await maybeCreateDefaultParty();
    assert.equal(created, false);
  });

  it("creates an empty party (no legacy re-seed) once the one-time seed already ran", async () => {
    const createCalls = [];
    globalThis.Actor = { implementation: { create: async (data) => { createCalls.push(data); return data; } } };
    globalThis.game = mockGame({
      actors: [mockPc({ uuid: "Actor.a", flagged: true })],
      settings: { partyLegacySeedDone: true },
    });
    await maybeCreateDefaultParty();
    assert.equal(createCalls.length, 1);
    assert.deepEqual(createCalls[0].system.members, []);
  });
});
