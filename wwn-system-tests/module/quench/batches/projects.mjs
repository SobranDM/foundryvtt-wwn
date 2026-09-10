import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

/**
 * Document-level coverage for the new `project` Actor type / `contribution`
 * Item type (WWN Magical Workings / Godbound world-changes).
 *
 * The pure funded-fraction/auto-lapse arithmetic already has thorough
 * coverage in the main repo's `tests/project-calculator.test.mjs` and
 * `tests/project-lapse.test.mjs` (plain Node, including a fake-actor stand-in
 * that calls `checkGodboundAutoLapse` directly). What those Node tests
 * cannot exercise is the real document lifecycle: an actual embedded
 * `contribution` Item being created/updated/deleted on a real `project`
 * Actor and the real `createItem`/`updateItem`/`deleteItem` hooks in
 * `module/wwn.mjs` wiring that into `checkGodboundAutoLapse` end-to-end.
 * That real-hook wiring, plus the derived-data pipeline
 * (`contributionSums`/`fundedTotal`/`fundedFraction`) and sheet rendering,
 * is what these tests cover.
 */
export default function register(quench) {
  quench.registerBatch(
    "wwn.projects",
    (context) => {
      const { describe, it, assert } = context;

      describe("Project / Contribution document lifecycle", function () {
        useQuenchTimeout(this);

        it("derives contributionSums / fundedTotal / fundedFraction from embedded contribution items", async function () {
          const project = await createTestActor("project", "proj-fund", {
            system: { gameLine: "godbound", resource: { max: 20 } },
          });
          try {
            await settle();
            assert.equal(project.system.fundedTotal, 0);

            const [c1] = await project.createEmbeddedDocuments("Item", [
              {
                name: "Quench Contributor A",
                type: "contribution",
                system: { influenceCommitted: 5, dominionSpent: 3 },
              },
            ]);
            await settle();
            assert.equal(project.system.contributionSums.total, 8);
            assert.equal(project.system.fundedTotal, 8);
            assert.equal(project.system.fundedFraction, 0.4);

            await c1.delete();
            await settle();
            assert.equal(project.system.fundedTotal, 0);
          } finally {
            await deleteTestActor(project);
          }
        });

        it("auto-lapses a Godbound project when a contribution is withdrawn below cost (real deleteItem hook)", async function () {
          const project = await createTestActor("project", "proj-lapse-delete", {
            system: { gameLine: "godbound", status: "inProgress", resource: { max: 10 } },
          });
          try {
            // Both contributions in one createEmbeddedDocuments call so the
            // hook only ever sees the fully-funded state (12 >= 10) before
            // either delete -- splitting this into two calls would let the
            // first (6 < 10) auto-lapse prematurely.
            const [c1] = await project.createEmbeddedDocuments("Item", [
              { name: "Quench Contributor A", type: "contribution", system: { influenceCommitted: 6 } },
              { name: "Quench Contributor B", type: "contribution", system: { influenceCommitted: 6 } },
            ]);
            await settle();
            assert.equal(
              game.actors.get(project.id).system.status,
              "inProgress",
              "fully funded (12 >= 10) must not lapse"
            );

            await c1.delete();
            await settle();
            assert.equal(
              game.actors.get(project.id).system.status,
              "lapsed",
              "dropping to 6 < 10 must auto-lapse via the real deleteItem hook wiring"
            );
          } finally {
            await deleteTestActor(project);
          }
        });

        it("auto-lapses a Godbound project when an existing contribution is edited down (real updateItem hook)", async function () {
          const project = await createTestActor("project", "proj-lapse-update", {
            system: { gameLine: "godbound", status: "maintained", resource: { max: 10 } },
          });
          try {
            const [c1] = await project.createEmbeddedDocuments("Item", [
              { name: "Quench Contributor", type: "contribution", system: { influenceCommitted: 10 } },
            ]);
            await settle();
            assert.equal(game.actors.get(project.id).system.status, "maintained");

            await c1.update({ "system.influenceCommitted": 2 });
            await settle();
            assert.equal(
              game.actors.get(project.id).system.status,
              "lapsed",
              "editing a contribution down below cost must auto-lapse via the real updateItem hook wiring"
            );
          } finally {
            await deleteTestActor(project);
          }
        });

        it("does not auto-lapse a WWN-gameline project even when underfunded (real hook no-ops for non-Godbound)", async function () {
          const project = await createTestActor("project", "proj-wwn-nolapse", {
            system: { gameLine: "wwn", status: "inProgress", resource: { max: 100 } },
          });
          try {
            await project.createEmbeddedDocuments("Item", [
              { name: "Quench Contributor", type: "contribution", system: { resourceContributed: 1 } },
            ]);
            await settle();
            assert.equal(game.actors.get(project.id).system.status, "inProgress");
          } finally {
            await deleteTestActor(project);
          }
        });

        it("renders the project actor sheet without error", async function () {
          const project = await createTestActor("project", "proj-sheet");
          try {
            await project.sheet.render(true);
            await settle();
            assert.exists(project.sheet.element);
            await project.sheet.close();
          } finally {
            await deleteTestActor(project);
          }
        });

        it("has a Progress tab (Contributions/calculator) and a Description tab (Effects/Notes), and switching between them works", async function () {
          const project = await createTestActor("project", "proj-tabs", {
            system: { gameLine: "godbound", effects: "<p>tab-split effects</p>", notes: "<p>tab-split notes</p>" },
          });
          try {
            await project.createEmbeddedDocuments("Item", [
              { name: "Quench Contributor", type: "contribution", system: { influenceCommitted: 2 } },
            ]);
            await project.sheet.render(true);
            await settle();
            try {
              // AppV2 renders every tab's part into the DOM up front (CSS/the
              // mixin toggles which one is visually active) -- so "on the
              // Progress tab" is checked by scoping the query to that tab's
              // own [data-tab] section, not by asserting the other tab's
              // content is entirely absent from the document.
              assert.equal(project.sheet.tabGroups.primary, "progress", "Progress should be the initial tab");
              const root = project.sheet.element;
              // Both the tab-nav <a> and the tab content <section> carry
              // matching data-tab attributes -- scope to the <section> (the
              // nav link comes first in document order and would otherwise
              // false-match the plain attribute selector).
              const progressSection = root.querySelector('section[data-tab="progress"]');
              const descriptionSection = root.querySelector('section[data-tab="description"]');
              assert.exists(progressSection, "a section[data-tab=\"progress\"] should exist");
              assert.exists(descriptionSection, "a section[data-tab=\"description\"] should exist");
              assert.exists(
                progressSection.querySelector(".wwn-project-contributions"),
                "Contributions panel should be on the Progress tab"
              );
              assert.exists(
                progressSection.querySelector(".wwn-project-calculator"),
                "Suggested-cost calculator should be on the Progress tab"
              );
              assert.notExists(
                progressSection.querySelector('[name="system.effects"]'),
                "Effects editor should be on the Description tab's section, not the Progress tab's"
              );
              assert.exists(
                descriptionSection.querySelector('[name="system.effects"]'),
                "Effects editor should render inside the Description tab's section"
              );
              assert.exists(
                descriptionSection.querySelector('[name="system.notes"]'),
                "Notes editor should render inside the Description tab's section"
              );

              project.sheet.changeTab("description", "primary");
              await settle();
              assert.equal(project.sheet.tabGroups.primary, "description", "changeTab should move to Description");

              project.sheet.changeTab("progress", "primary");
              await settle();
              assert.equal(project.sheet.tabGroups.primary, "progress", "changeTab should move back to Progress");
              assert.exists(
                root.querySelector('section[data-tab="progress"] .wwn-project-contributions'),
                "Contributions panel should still be reachable after switching back to Progress"
              );
            } finally {
              await project.sheet.close();
            }
          } finally {
            await deleteTestActor(project);
          }
        });

        // --- code-review fix coverage -----------------------------------

        it("auto-lapses when resource.max is raised directly on the actor past the funded total (real updateActor hook, not just contribution hooks)", async function () {
          const project = await createTestActor("project", "proj-lapse-direct-max", {
            system: { gameLine: "godbound", status: "inProgress", resource: { max: 10 } },
          });
          try {
            await project.createEmbeddedDocuments("Item", [
              { name: "Quench Contributor", type: "contribution", system: { influenceCommitted: 10 } },
            ]);
            await settle();
            assert.equal(
              game.actors.get(project.id).system.status,
              "inProgress",
              "fully funded (10 >= 10) must not lapse"
            );

            // Direct edit to the project actor itself -- e.g. the GM
            // discovering the true cost is higher and raising resource.max
            // by hand -- never touches a contribution item, so only the
            // updateActor hook (not updateItem/deleteItem) can catch this.
            await project.update({ "system.resource.max": 25 });
            await settle();
            assert.equal(
              game.actors.get(project.id).system.status,
              "lapsed",
              "raising resource.max past the already-committed total must auto-lapse via the real updateActor hook"
            );
          } finally {
            await deleteTestActor(project);
          }
        });

        it("auto-lapses when status is flipped directly to inProgress on an already-underfunded project (real updateActor hook)", async function () {
          const project = await createTestActor("project", "proj-lapse-direct-status", {
            system: { gameLine: "godbound", status: "planning", resource: { max: 50 } },
          });
          try {
            await project.createEmbeddedDocuments("Item", [
              { name: "Quench Contributor", type: "contribution", system: { influenceCommitted: 5 } },
            ]);
            await settle();
            assert.equal(
              game.actors.get(project.id).system.status,
              "planning",
              "an underfunded planning project must not lapse before it is ever started"
            );

            await project.update({ "system.status": "inProgress" });
            await settle();
            assert.equal(
              game.actors.get(project.id).system.status,
              "lapsed",
              "starting an already-underfunded project must immediately auto-lapse"
            );
          } finally {
            await deleteTestActor(project);
          }
        });

        it("the direct-actor-edit lapse write does not re-trigger itself (bounded, not infinite)", async function () {
          // Foundry itself can fire `updateActor` more than once per logical
          // `Document#update()` call (a local optimistic apply plus a
          // server-echo reconciliation with an empty diff) -- so this test
          // can't assert a fixed raw hook-fire count. What actually proves
          // "no infinite loop" is the invariant the AUTO_LAPSE_UPDATE_FLAG
          // guard exists to provide: after the GM's own (unflagged) direct
          // edit, every further `updateActor` firing for this project must
          // carry the flag -- i.e. the hook's own status-flip write never
          // re-enters checkGodboundAutoLapse and produces a *second*,
          // unflagged write of its own.
          const { AUTO_LAPSE_UPDATE_FLAG } = await wwnImport("/systems/wwn/module/helpers/project-lapse.mjs");

          const project = await createTestActor("project", "proj-lapse-no-loop", {
            system: { gameLine: "godbound", status: "inProgress", resource: { max: 10 } },
          });
          try {
            await project.createEmbeddedDocuments("Item", [
              { name: "Quench Contributor", type: "contribution", system: { influenceCommitted: 10 } },
            ]);
            await settle();

            const calls = [];
            const recordUpdates = (actor, changes, options) => {
              if (actor.id === project.id) calls.push(!!options?.[AUTO_LAPSE_UPDATE_FLAG]);
            };
            Hooks.on("updateActor", recordUpdates);
            try {
              await project.update({ "system.resource.max": 25 });
              await settle(150);
            } finally {
              Hooks.off("updateActor", recordUpdates);
            }

            assert.equal(game.actors.get(project.id).system.status, "lapsed");
            assert.ok(calls.length >= 2, "expected at least the direct edit plus one lapse write");
            assert.equal(calls[0], false, "the GM's own direct edit must not carry the auto-lapse flag");
            assert.ok(
              calls.slice(1).every((flagged) => flagged === true),
              `every updateActor firing after the direct edit must carry AUTO_LAPSE_UPDATE_FLAG (an unflagged one would mean checkGodboundAutoLapse re-entered itself): ${JSON.stringify(calls)}`
            );
          } finally {
            await deleteTestActor(project);
          }
        });

        it("the suggested-cost calculator display updates live from persisted calc inputs, with no separate Calculate step (regression: stale cached result)", async function () {
          const project = await createTestActor("project", "proj-calc-live", {
            system: { gameLine: "wwn" },
          });
          try {
            await project.update({
              "system.calc.effectPoints": "12",
              "system.calc.area": "room",
            });
            await project.sheet.render(true);
            await settle();
            try {
              const resultEl = () => project.sheet.element.querySelector(".wwn-project-calc-result");
              assert.exists(resultEl(), "calculator result readout should always be present, not gated behind a Calculate click");
              // 12 points x Room (x1) = 12 difficulty -> 12,000sp
              assert.include(resultEl().textContent, "12000", "initial calc inputs should be reflected without clicking anything");

              // Change an input (as if the GM edited the Area dropdown) via
              // the same path submitOnChange uses, then re-render -- there is
              // no "Calculate" action to click anymore, so the only way this
              // can show the right number is if it's derived live every render.
              await project.update({ "system.calc.area": "village" });
              await project.sheet.render(true);
              await settle();
              // 12 points x Village (x16) = 192 difficulty -> 192,000sp
              assert.include(
                resultEl().textContent,
                "192000",
                "changing a calc input and re-rendering must update the suggested cost without a separate Calculate click"
              );
            } finally {
              await project.sheet.close();
            }
          } finally {
            await deleteTestActor(project);
          }
        });

        it("the Godbound suggested-cost calculator resolves the named Scope dropdown tier (not a raw number field)", async function () {
          const project = await createTestActor("project", "proj-calc-scope-live", {
            system: { gameLine: "godbound" },
          });
          try {
            await project.update({
              "system.calc.scope": "village",
              "system.calc.wardRating": 0,
              "system.calc.resistanceRating": 0,
              "system.calc.magnitudeMult": 1,
            });
            await project.sheet.render(true);
            await settle();
            try {
              const resultEl = () => project.sheet.element.querySelector(".wwn-project-calc-result");
              const scopeSelect = () => project.sheet.element.querySelector('select[name="system.calc.scope"]');
              assert.exists(scopeSelect(), "Scope must be a <select>, not a raw number input");
              assert.equal(scopeSelect().tagName, "SELECT");
              // Village (1) + 0 + 0, x1 -> 1
              assert.include(resultEl().textContent, "Suggested Cost: 1", "village tier should resolve to base 1");

              await project.update({ "system.calc.scope": "region" });
              await project.sheet.render(true);
              await settle();
              // Region (4) + 0 + 0, x1 -> 4
              assert.include(resultEl().textContent, "Suggested Cost: 4", "region tier should resolve to base 4");

              await project.update({ "system.calc.scope": "realm" });
              await project.sheet.render(true);
              await settle();
              // Realm (16) + 0 + 0, x1 -> 16
              assert.include(resultEl().textContent, "Suggested Cost: 16", "realm tier should resolve to base 16");
            } finally {
              await project.sheet.close();
            }
          } finally {
            await deleteTestActor(project);
          }
        });

        it("contribution rows with identical display names both render without throwing (regression: invalid two-way sort comparator)", async function () {
          const project = await createTestActor("project", "proj-dup-names", {
            system: { gameLine: "wwn" },
          });
          try {
            const contributions = await project.createEmbeddedDocuments("Item", [
              { name: "New Contribution", type: "contribution", system: { resourceContributed: 1 } },
              { name: "New Contribution", type: "contribution", system: { resourceContributed: 2 } },
            ]);
            await settle();
            await project.sheet.render(true);
            await settle();
            try {
              const root = project.sheet.element;
              for (const item of contributions) {
                assert.exists(
                  root.querySelector(`[data-item-id="${item.id}"]`),
                  `contribution ${item.id} should still render even with a duplicate display name`
                );
              }
            } finally {
              await project.sheet.close();
            }
          } finally {
            await deleteTestActor(project);
          }
        });
      });
    },
    { displayName: "WWN: Projects" },
  );
}
