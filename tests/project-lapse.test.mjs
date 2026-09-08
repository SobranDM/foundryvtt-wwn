import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkGodboundAutoLapse } from "../module/helpers/project-lapse.mjs";

/**
 * Minimal fake Actor stand-in — just enough shape for checkGodboundAutoLapse
 * to read (`type`, `system`, `items`) and write (`update`). No Foundry
 * imports needed: the hook target only calls into project-calculator.mjs.
 */
function fakeProject({ gameLine = "godbound", status = "inProgress", resourceMax = 10, contributions = [] } = {}) {
  const updateCalls = [];
  return {
    type: "project",
    system: { gameLine, status, resource: { max: resourceMax } },
    items: contributions.map((c, i) => ({
      id: c.id ?? `c${i}`,
      type: "contribution",
      system: { influenceCommitted: 0, dominionSpent: 0, resourceContributed: 0, ...c },
    })),
    update: async (data) => {
      updateCalls.push(data);
    },
    _updateCalls: updateCalls,
  };
}

describe("checkGodboundAutoLapse", () => {
  it("does nothing for a non-project actor / undefined actor", async () => {
    await checkGodboundAutoLapse(undefined);
    await checkGodboundAutoLapse({ type: "character" });
    // No throw is the assertion here — nothing to inspect.
  });

  it("lapses an in-progress project whose contribution update drops it below cost", async () => {
    const project = fakeProject({
      status: "inProgress",
      resourceMax: 20,
      contributions: [{ id: "a", influenceCommitted: 0 }, { id: "b", influenceCommitted: 8 }],
    });
    await checkGodboundAutoLapse(project);
    assert.deepEqual(project._updateCalls, [{ "system.status": "lapsed" }]);
  });

  it("lapses on the delete path even though the deleted item is still in `items` (excludeItemId)", async () => {
    const project = fakeProject({
      status: "maintained",
      resourceMax: 20,
      // Deleted item still present (hook-timing edge case); excludeItemId must drop it from the sum.
      contributions: [{ id: "leaving", influenceCommitted: 15 }, { id: "staying", influenceCommitted: 3 }],
    });
    await checkGodboundAutoLapse(project, { excludeItemId: "leaving" });
    assert.deepEqual(project._updateCalls, [{ "system.status": "lapsed" }]);
  });

  it("never calls update for a WWN project, even if it would be underfunded by godbound math", async () => {
    const project = fakeProject({ gameLine: "wwn", status: "inProgress", resourceMax: 20, contributions: [] });
    await checkGodboundAutoLapse(project);
    assert.deepEqual(project._updateCalls, []);
  });

  it("never calls update for a planning project", async () => {
    const project = fakeProject({ status: "planning", resourceMax: 20, contributions: [] });
    await checkGodboundAutoLapse(project);
    assert.deepEqual(project._updateCalls, []);
  });

  it("never calls update for a complete project", async () => {
    const project = fakeProject({ status: "complete", resourceMax: 20, contributions: [] });
    await checkGodboundAutoLapse(project);
    assert.deepEqual(project._updateCalls, []);
  });

  it("does not call update when still fully funded", async () => {
    const project = fakeProject({
      status: "inProgress",
      resourceMax: 20,
      contributions: [{ id: "a", influenceCommitted: 12 }, { id: "b", dominionSpent: 8 }],
    });
    await checkGodboundAutoLapse(project);
    assert.deepEqual(project._updateCalls, []);
  });

  it("writes exactly { status: lapsed } and nothing else", async () => {
    const project = fakeProject({ status: "inProgress", resourceMax: 20, contributions: [{ id: "a", influenceCommitted: 1 }] });
    await checkGodboundAutoLapse(project);
    assert.equal(project._updateCalls.length, 1);
    assert.deepEqual(Object.keys(project._updateCalls[0]), ["system.status"]);
    assert.equal(project._updateCalls[0]["system.status"], "lapsed");
  });
});
