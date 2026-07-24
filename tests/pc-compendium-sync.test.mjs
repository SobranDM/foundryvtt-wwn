/**
 * Unit tests for PC compendium sync fingerprints (no Foundry runtime beyond shim).
 * Run: node --test tests/pc-compendium-sync.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  itemSyncKey,
  effectsFingerprint,
  classEdgeGrantsFingerprint,
  powerShapeFingerprint,
  itemShapeFingerprint,
  extractPreservedFields,
  buildReplacementData,
  needsCompendiumSwap,
  ensureBackupFolder,
} from "../module/migration/pc-compendium-sync.mjs";

describe("itemSyncKey", () => {
  it("keys focus and classEdge by type and lowercased name", () => {
    assert.equal(itemSyncKey({ type: "focus", name: " Alert " }), "focus::alert");
    assert.equal(itemSyncKey({ type: "classEdge", name: "Warrior" }), "classEdge::warrior");
  });

  it("keys powers by subtype and name", () => {
    assert.equal(
      itemSyncKey({ type: "power", name: "Shattering Strike", system: { subType: "art" } }),
      "power::art::shattering strike"
    );
  });

  it("returns null for unsupported types", () => {
    assert.equal(itemSyncKey({ type: "skill", name: "Exert" }), null);
  });
});

describe("effectsFingerprint", () => {
  it("is order-independent over change tuples", () => {
    const a = {
      effects: [
        {
          system: {
            changes: [
              { key: "system.combat.ac.mod", type: "add", value: 1, phase: "initial" },
              { key: "system.movement.bonus", type: "add", value: 2, phase: "initial" },
            ],
          },
        },
      ],
    };
    const b = {
      effects: [
        {
          system: {
            changes: [
              { key: "system.movement.bonus", type: "add", value: 2, phase: "initial" },
              { key: "system.combat.ac.mod", type: "add", value: 1, phase: "initial" },
            ],
          },
        },
      ],
    };
    assert.equal(effectsFingerprint(a), effectsFingerprint(b));
  });

  it("differs when a change is missing", () => {
    const withAe = {
      effects: [
        {
          system: {
            changes: [
              { key: "system.combat.initiative.individual.roll", type: "override", value: "2d8kh", phase: "initial" },
            ],
          },
        },
      ],
    };
    const bare = { effects: [] };
    assert.notEqual(effectsFingerprint(withAe), effectsFingerprint(bare));
  });
});

describe("classEdgeGrantsFingerprint", () => {
  it("ignores poolGrant.value", () => {
    const a = classEdgeGrantsFingerprint({
      attackProgression: "warrior",
      poolGrant: { name: "Effort", formula: "1+@level", value: 3 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    const b = classEdgeGrantsFingerprint({
      attackProgression: "warrior",
      poolGrant: { name: "Effort", formula: "1+@level", value: 0 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    assert.equal(a, b);
  });

  it("changes when formula changes", () => {
    const a = classEdgeGrantsFingerprint({
      attackProgression: "none",
      poolGrant: { name: "Effort", formula: "1", value: 0 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    const b = classEdgeGrantsFingerprint({
      attackProgression: "none",
      poolGrant: { name: "Effort", formula: "2", value: 0 },
      slotGrant: { enabled: false, progression: [], leveledProgression: [] },
    });
    assert.notEqual(a, b);
  });
});

describe("powerShapeFingerprint", () => {
  it("ignores poolCommitted and prepared", () => {
    const a = powerShapeFingerprint({
      damageRoll: "(@level)d12",
      healing: false,
      activation: { roll: "" },
      poolCommitted: { scene: 2 },
      prepared: true,
    });
    const b = powerShapeFingerprint({
      damageRoll: "(@level)d12",
      healing: false,
      activation: { roll: "" },
      poolCommitted: { scene: 0 },
      prepared: false,
    });
    assert.equal(a, b);
  });

  it("changes when damageRoll moves from activation", () => {
    const owned = powerShapeFingerprint({
      damageRoll: "",
      activation: { roll: "1d12" },
    });
    const pack = powerShapeFingerprint({
      damageRoll: "(@level)d12",
      activation: { roll: "" },
    });
    assert.notEqual(owned, pack);
  });
});

describe("itemShapeFingerprint / needsCompendiumSwap", () => {
  it("detects stale Alert without AEs", () => {
    const owned = { type: "focus", name: "Alert", effects: [], system: { ownedLevel: 2 } };
    const pack = {
      type: "focus",
      name: "Alert",
      effects: [
        {
          system: {
            changes: [
              { key: "system.combat.initiative.individual.roll", type: "override", value: "2d8kh", phase: "initial" },
            ],
          },
        },
      ],
      system: { ownedLevel: 1 },
    };
    assert.notEqual(itemShapeFingerprint(owned), itemShapeFingerprint(pack));
    assert.equal(needsCompendiumSwap(owned, pack), true);
  });

  it("detects stale power roll placement", () => {
    const owned = {
      type: "power",
      name: "Shattering Strike",
      effects: [],
      system: { subType: "art", damageRoll: "", activation: { roll: "1d12" } },
    };
    const pack = {
      type: "power",
      name: "Shattering Strike",
      effects: [],
      system: { subType: "art", damageRoll: "(@level)d12", activation: { roll: "" } },
    };
    assert.equal(needsCompendiumSwap(owned, pack), true);
  });

  it("does not swap when fingerprints match", () => {
    const item = {
      type: "focus",
      name: "Alert",
      effects: [
        {
          system: {
            changes: [{ key: "system.combat.immuneToSurprise", type: "override", value: "true", phase: "initial" }],
          },
        },
      ],
      system: {},
    };
    assert.equal(needsCompendiumSwap(item, foundry.utils.deepClone(item)), false);
  });
});

describe("extractPreservedFields / buildReplacementData", () => {
  it("preserves focus progress onto pack definition", () => {
    const owned = {
      type: "focus",
      name: "Alert",
      system: {
        ownedLevel: 2,
        bonusSkillsChosen: ["notice"],
        internalResource: { value: 1, max: 2 },
        bonusDice: 1,
      },
    };
    const preserved = extractPreservedFields(owned);
    assert.equal(preserved.ownedLevel, 2);
    assert.deepEqual(preserved.bonusSkillsChosen, ["notice"]);

    const pack = {
      _id: "packid",
      _key: "!items!packid",
      type: "focus",
      name: "Alert",
      system: {
        ownedLevel: 1,
        bonusSkillsChosen: [],
        internalResource: { value: 0, max: 0 },
        description: "New text",
      },
      effects: [{ _id: "e1", _key: "x", system: { changes: [] } }],
    };
    const created = buildReplacementData(pack, preserved);
    assert.equal(created._id, undefined);
    assert.equal(created.system.ownedLevel, 2);
    assert.deepEqual(created.system.bonusSkillsChosen, ["notice"]);
    assert.equal(created.system.description, "New text");
    assert.equal(created.effects[0]._id, undefined);
  });

  it("preserves classEdge poolGrant.value only", () => {
    const owned = {
      type: "classEdge",
      name: "Mage",
      system: {
        poolGrant: { name: "Effort", formula: "old", value: 4 },
        attackProgression: "mage",
      },
    };
    const preserved = extractPreservedFields(owned);
    const pack = {
      type: "classEdge",
      name: "Mage",
      system: {
        poolGrant: { name: "Effort", formula: "1+@level", value: 0 },
        attackProgression: "mage",
      },
      effects: [],
    };
    const created = buildReplacementData(pack, preserved);
    assert.equal(created.system.poolGrant.value, 4);
    assert.equal(created.system.poolGrant.formula, "1+@level");
  });

  it("preserves power spend and technique level", () => {
    const owned = {
      type: "power",
      name: "Psychic Succor",
      system: {
        subType: "psychic",
        poolCommitted: { none: 0, active: 0, scene: 0, day: 1 },
        prepared: false,
        isActive: true,
        internalResource: { value: 2, max: 3 },
        level: 2,
      },
    };
    const preserved = extractPreservedFields(owned);
    const pack = {
      type: "power",
      name: "Psychic Succor",
      system: {
        subType: "psychic",
        damageRoll: "1d6+1",
        healing: true,
        poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
        prepared: true,
        isActive: false,
        internalResource: { value: 0, max: 0 },
        level: 0,
      },
      effects: [],
    };
    const created = buildReplacementData(pack, preserved);
    assert.equal(created.system.poolCommitted.day, 1);
    assert.equal(created.system.isActive, true);
    assert.equal(created.system.level, 2);
    assert.equal(created.system.damageRoll, "1d6+1");
    assert.equal(created.system.healing, true);
  });
});

/**
 * Minimal Folder / game.folders mock for ensureBackupFolder.
 */
function installFolderMock(seed = []) {
  const folders = [...seed];
  let nextId = 1;

  class MockFolder {
    constructor({ name, type, folder = null, id }) {
      this.id = id ?? `folder${nextId++}`;
      this.name = name;
      this.type = type;
      this.folder = folder; // parent Folder doc or null
    }
    async update(data) {
      if ("folder" in data) {
        const parentId = data.folder;
        this.folder = parentId
          ? folders.find((f) => f.id === parentId) ?? null
          : null;
      }
      return this;
    }
  }

  globalThis.Folder = {
    async create(data) {
      const parent =
        data.folder == null
          ? null
          : folders.find((f) => f.id === data.folder) ?? null;
      const created = new MockFolder({
        name: data.name,
        type: data.type,
        folder: parent,
      });
      folders.push(created);
      return created;
    },
  };

  globalThis.game = {
    folders: {
      find: (fn) => folders.find(fn),
      some: (fn) => folders.some(fn),
      [Symbol.iterator]: function* () {
        yield* folders;
      },
    },
  };

  return { folders, MockFolder };
}

describe("ensureBackupFolder", () => {
  it("creates Migration Backups parent and nested actor folder", async () => {
    const { folders } = installFolderMock();
    const child = await ensureBackupFolder("Ted");
    const parent = folders.find((f) => f.name === "Migration Backups");
    assert.ok(parent);
    assert.equal(parent.folder, null);
    assert.equal(parent.type, "Item");
    assert.equal(child.name, "Migration Backup — Ted");
    assert.equal(child.folder?.id, parent.id);
  });

  it("reuses existing nested actor folder", async () => {
    const { folders, MockFolder } = installFolderMock();
    const parent = new MockFolder({
      name: "Migration Backups",
      type: "Item",
      folder: null,
      id: "parent1",
    });
    const existing = new MockFolder({
      name: "Migration Backup — Ted",
      type: "Item",
      folder: parent,
      id: "child1",
    });
    folders.push(parent, existing);
    const got = await ensureBackupFolder("Ted");
    assert.equal(got.id, "child1");
    assert.equal(folders.filter((f) => f.name === "Migration Backup — Ted").length, 1);
  });

  it("reparents a legacy top-level actor folder under Migration Backups", async () => {
    const { folders, MockFolder } = installFolderMock();
    const legacy = new MockFolder({
      name: "Migration Backup — Tom",
      type: "Item",
      folder: null,
      id: "legacy1",
    });
    folders.push(legacy);
    const got = await ensureBackupFolder("Tom");
    const parent = folders.find((f) => f.name === "Migration Backups");
    assert.ok(parent);
    assert.equal(got.id, "legacy1");
    assert.equal(got.folder?.id, parent.id);
  });

  it("ignores same-named Item folder under unrelated parent", async () => {
    const { folders, MockFolder } = installFolderMock();
    const otherParent = new MockFolder({
      name: "Other Parent",
      type: "Item",
      folder: null,
      id: "otherParent1",
    });
    const unrelated = new MockFolder({
      name: "Migration Backup — Ted",
      type: "Item",
      folder: otherParent,
      id: "unrelated1",
    });
    folders.push(otherParent, unrelated);
    const child = await ensureBackupFolder("Ted");
    const parent = folders.find((f) => f.name === "Migration Backups");
    assert.ok(parent);
    assert.equal(child.name, "Migration Backup — Ted");
    assert.equal(child.folder?.id, parent.id);
    assert.notEqual(child.id, "unrelated1");
  });

  it("prefers nested folder when both nested and top-level exist", async () => {
    const { folders, MockFolder } = installFolderMock();
    const parent = new MockFolder({
      name: "Migration Backups",
      type: "Item",
      folder: null,
      id: "parent1",
    });
    const nested = new MockFolder({
      name: "Migration Backup — Ted",
      type: "Item",
      folder: parent,
      id: "nested1",
    });
    const top = new MockFolder({
      name: "Migration Backup — Ted",
      type: "Item",
      folder: null,
      id: "top1",
    });
    folders.push(parent, nested, top);
    const got = await ensureBackupFolder("Ted");
    assert.equal(got.id, "nested1");
    assert.equal(top.folder, null);
  });
});
