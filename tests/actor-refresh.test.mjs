/**
 * refreshActorDerivedData forces a fresh prepareDerivedData() pass (and a
 * sheet re-render) after a transfer effect becomes newly applicable or
 * inapplicable — Actor#prepareData() does not reliably do this on its own;
 * see module/helpers/actor-refresh.mjs for the full story.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { refreshActorDerivedData } from "../module/helpers/actor-refresh.mjs";

function actorStub({ documentName = "Actor" } = {}) {
  const calls = { prepareDerivedData: 0, render: 0 };
  return {
    calls,
    actor: {
      documentName,
      system: { prepareDerivedData: () => calls.prepareDerivedData++ },
      sheet: { render: () => calls.render++ },
    },
  };
}

describe("refreshActorDerivedData", () => {
  it("calls prepareDerivedData and re-renders the open sheet", () => {
    const { actor, calls } = actorStub();
    refreshActorDerivedData(actor);
    assert.equal(calls.prepareDerivedData, 1);
    assert.equal(calls.render, 1);
  });

  it("no-ops for a non-Actor document", () => {
    const { actor, calls } = actorStub({ documentName: "Item" });
    refreshActorDerivedData(actor);
    assert.equal(calls.prepareDerivedData, 0);
    assert.equal(calls.render, 0);
  });

  it("no-ops for null/undefined", () => {
    assert.doesNotThrow(() => refreshActorDerivedData(null));
    assert.doesNotThrow(() => refreshActorDerivedData(undefined));
  });

  it("skips the render call when no sheet is open", () => {
    const calls = { prepareDerivedData: 0 };
    const actor = { documentName: "Actor", system: { prepareDerivedData: () => calls.prepareDerivedData++ }, sheet: null };
    assert.doesNotThrow(() => refreshActorDerivedData(actor));
    assert.equal(calls.prepareDerivedData, 1);
  });
});
