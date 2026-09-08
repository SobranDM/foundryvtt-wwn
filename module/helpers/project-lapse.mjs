/**
 * Godbound auto-lapse: if a contribution update/delete, OR a direct edit to
 * the project actor itself (e.g. the GM raising `resource.max` once the true
 * cost is known, or flipping `status` to "inProgress" on an already-
 * underfunded project), drops the summed Influence+Dominion below the
 * project's required cost, flip `status` to "lapsed". Pure arithmetic
 * comparison against `resource.max` — not a feasibility/capability check —
 * and only ever moves a project *into* "lapsed" from "inProgress"/
 * "maintained"; never auto-reverts (a GM does that by hand), and never
 * touches "planning"/"complete" projects. Dominion already spent is never
 * zeroed by this — only `status` changes.
 *
 * This function itself calls `project.update()` when it lapses a project.
 * Callers that are wired to `updateActor` (see module/wwn.mjs) MUST pass the
 * `wwnAutoLapse: true` update option along on that write and check for it on
 * entry to their hook, or this will retrigger itself via that same hook.
 * (The `updateItem`/`deleteItem` callers don't need this — those hooks fire
 * on a different document type than the `Actor#update` this function makes,
 * so they can't retrigger themselves.)
 */
import { sumContributions, fundedTotalFor, shouldAutoLapse } from "./project-calculator.mjs";

/** Update option flag: marks a write this module made, so the `updateActor`
 * hook in module/wwn.mjs can recognize and skip its own re-entrant call. */
export const AUTO_LAPSE_UPDATE_FLAG = "wwnAutoLapse";

/**
 * @param {Actor|undefined} project The project actor to check (either the parent of a
 *   contribution item that just changed, or the project actor itself on a direct edit).
 * @param {{ excludeItemId?: string }} [options] On delete, the hook can still see the item in
 *   `project.items` depending on timing — pass its id so the sum excludes it defensively either way.
 */
export async function checkGodboundAutoLapse(project, { excludeItemId } = {}) {
  if (!project || project.type !== "project") return;
  const system = project.system;
  if (system.gameLine !== "godbound") return;
  if (system.status !== "inProgress" && system.status !== "maintained") return;

  const contributions = project.items
    .filter((i) => i.type === "contribution" && i.id !== excludeItemId)
    .map((i) => i.system);
  const sums = sumContributions(contributions);
  const fundedTotal = fundedTotalFor("godbound", sums);

  const lapse = shouldAutoLapse({
    gameLine: "godbound",
    status: system.status,
    fundedTotal,
    resourceMax: system.resource.max,
  });
  if (lapse) await project.update({ "system.status": "lapsed" }, { [AUTO_LAPSE_UPDATE_FLAG]: true });
}
