/**
 * Regression coverage for a real gap: `applyPowerEffectsToActor` /
 * `expireScopedPowerEffects` (module/helpers/power-effects.mjs) create and
 * delete ActiveEffects directly on an Actor (`transfer: false`, since a
 * scene/day self-cast power's effects aren't item-owned transfer effects).
 * The generic `createActiveEffect` / `updateActiveEffect` / `deleteActiveEffect`
 * hooks in wwn.mjs only call `refreshActorDerivedData` when `effect.transfer`
 * is true and `effect.parent` is an Item embedded in an Actor -- for these
 * actor-owned non-transfer effects, `effect.parent` IS the actor itself, so
 * neither hook condition is ever satisfied and a final-phase derived field
 * (e.g. `system.combat.innateAc.min`, used by real content like Cold Flesh)
 * could go stale exactly like the bug `refreshActorDerivedData` was built to
 * fix. The fix: refresh explicitly at the effect creation/deletion call
 * sites themselves, not via the generic hooks. These tests prove that.
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyPowerEffectsToActor, expireScopedPowerEffects } from "../module/helpers/power-effects.mjs";

const FLAG = "wwn";

/** Array subclass so `actor.effects` supports both Collection-like get/has and array methods. */
class FakeEffects extends Array {
  get(id) {
    return this.find((e) => e.id === id);
  }
  has(id) {
    return this.some((e) => e.id === id);
  }
}

/** @param {object} [overrides] */
function fakeActor(overrides = {}) {
  let nextId = 1;
  const calls = { prepareDerivedData: 0, render: 0 };
  const actor = {
    documentName: "Actor",
    uuid: "Actor.fake",
    effects: new FakeEffects(),
    _source: { effects: [] },
    system: { prepareDerivedData: () => calls.prepareDerivedData++ },
    sheet: { render: () => calls.render++ },
    async createEmbeddedDocuments(docType, dataArray) {
      if (docType !== "ActiveEffect") throw new Error("unexpected docType");
      const created = dataArray.map((data) => {
        const id = `fake-effect-${nextId++}`;
        const doc = {
          id,
          _id: id,
          origin: data.origin,
          disabled: !!data.disabled,
          transfer: !!data.transfer,
          flags: foundry.utils.deepClone(data.flags ?? {}),
          getFlag(scope, key) {
            return this.flags?.[scope]?.[key];
          },
        };
        actor.effects.push(doc);
        actor._source.effects.push({ _id: id });
        return doc;
      });
      return created;
    },
    async deleteEmbeddedDocuments(docType, ids) {
      if (docType !== "ActiveEffect") throw new Error("unexpected docType");
      for (const id of ids) {
        const idx = actor.effects.findIndex((e) => e.id === id);
        if (idx >= 0) actor.effects.splice(idx, 1);
        const srcIdx = actor._source.effects.findIndex((e) => e._id === id);
        if (srcIdx >= 0) actor._source.effects.splice(srcIdx, 1);
      }
      return ids;
    },
    ...overrides,
  };
  return { actor, calls };
}

/** @param {{ name?: string, uuid?: string, effects?: object[] }} [overrides] */
function fakeItem(overrides = {}) {
  return {
    uuid: "Item.fake",
    effects: [
      {
        name: "Fake Buff",
        img: "icons/svg/aura.svg",
        system: { changes: [{ key: "system.combat.innateAc.min", type: "upgrade", value: 14, phase: "final" }] },
        statuses: [],
      },
    ],
    ...overrides,
  };
}

describe("applyPowerEffectsToActor refreshes derived data", () => {
  it("creates the effect and calls refreshActorDerivedData when applying", async () => {
    const { actor, calls } = fakeActor();
    const item = fakeItem();
    const result = await applyPowerEffectsToActor(actor, item, { durationScope: "scene" });
    assert.equal(result.applied, 1);
    assert.equal(actor.effects.length, 1);
    assert.equal(calls.prepareDerivedData, 1, "must refresh derived data after creating a non-transfer actor effect");
    assert.equal(calls.render, 1);
  });

  it("does NOT refresh when every effect is already applied (skipped, nothing created)", async () => {
    const { actor, calls } = fakeActor();
    const item = fakeItem();
    await applyPowerEffectsToActor(actor, item, { durationScope: "scene" });
    calls.prepareDerivedData = 0;
    calls.render = 0;

    const again = await applyPowerEffectsToActor(actor, item, { durationScope: "scene" });
    assert.equal(again.applied, 0);
    assert.equal(again.skipped, 1);
    assert.equal(calls.prepareDerivedData, 0, "no new effect created -> no refresh needed");
  });
});

describe("expireScopedPowerEffects refreshes derived data", () => {
  it("deletes scoped power effects and calls refreshActorDerivedData", async () => {
    const { actor, calls } = fakeActor();
    const item = fakeItem();
    await applyPowerEffectsToActor(actor, item, { durationScope: "scene" });
    calls.prepareDerivedData = 0;
    calls.render = 0;

    await expireScopedPowerEffects(actor, "scene");
    assert.equal(actor.effects.length, 0, "the scoped effect must be removed");
    assert.equal(calls.prepareDerivedData, 1, "must refresh derived data after deleting a non-transfer actor effect");
    assert.equal(calls.render, 1);
  });

  it("does NOT refresh when there is nothing to expire", async () => {
    const { actor, calls } = fakeActor();
    await expireScopedPowerEffects(actor, "day");
    assert.equal(calls.prepareDerivedData, 0);
    assert.equal(calls.render, 0);
  });

  it("only expires effects matching the requested scope, leaving the other scope's refresh untouched", async () => {
    const { actor, calls } = fakeActor();
    const sceneItem = fakeItem({ uuid: "Item.scene" });
    const dayItem = fakeItem({ uuid: "Item.day" });
    await applyPowerEffectsToActor(actor, sceneItem, { durationScope: "scene" });
    await applyPowerEffectsToActor(actor, dayItem, { durationScope: "day" });
    calls.prepareDerivedData = 0;

    await expireScopedPowerEffects(actor, "scene");
    assert.equal(actor.effects.length, 1, "only the scene-scoped effect should be gone");
    assert.equal(actor.effects[0].origin, "Item.day");
    assert.equal(calls.prepareDerivedData, 1);
  });
});
