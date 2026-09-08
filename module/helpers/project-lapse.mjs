/**
 * Godbound auto-lapse: if a contribution update/delete drops the summed
 * Influence+Dominion below the project's required cost, flip `status` to
 * "lapsed". Pure arithmetic comparison against `resource.max` — not a
 * feasibility/capability check — and only ever moves a project *into*
 * "lapsed" from "inProgress"/"maintained"; never auto-reverts (a GM does
 * that by hand), and never touches "planning"/"complete" projects.
 * Dominion already spent is never zeroed by this — only `status` changes.
 */
import { sumContributions, fundedTotalFor, shouldAutoLapse } from "./project-calculator.mjs";

/**
 * @param {Actor|undefined} project The parent actor of the contribution item that just changed.
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
  if (lapse) await project.update({ "system.status": "lapsed" });
}
