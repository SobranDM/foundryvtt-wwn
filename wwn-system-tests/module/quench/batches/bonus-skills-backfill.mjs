import { createTestActor, deleteTestActor, settle, useQuenchTimeout, withSetting, wwnImport } from "../helpers.mjs";

/**
 * Integration coverage for module/migration/bonus-skills-backfill.mjs and
 * the matching flags.wwn.bonusSkillsGranted preservation in
 * pc-compendium-sync.mjs. The pure decision functions
 * (needsBonusSkillsBackfill / computeBackfillSlugs) already have Node unit
 * tests (tests/bonus-skills-backfill.test.mjs); these exercise the real
 * orchestration against live Documents instead.
 */
export default function register(quench) {
  quench.registerBatch(
    "wwn.bonusSkillsBackfill",
    (context) => {
      const { describe, it, assert } = context;

      describe("Bonus-skill grant backfill (2.0.0-beta4)", function () {
        useQuenchTimeout(this);

        it("seeds bonusSkillsGranted from legacy evidence without touching the skill, and stays idempotent afterward", async function () {
          const { maybeBackfillBonusSkillsGranted } = await wwnImport(
            "/systems/wwn/module/migration/bonus-skills-backfill.mjs",
          );
          const { syncFocusBonusSkills } = await wwnImport("/systems/wwn/module/helpers/focus-bonus-skills.mjs");
          const actor = await createTestActor("character", "backfill-legacy", {}, { wwnSkipSeeding: true });
          try {
            const created = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Talk",
                  type: "skill",
                  // Stands in for "already granted, plus whatever the player
                  // has since spent themselves" -- the backfill must leave
                  // this exactly as-is; it only ever seeds bookkeeping.
                  system: { slug: "talk", ownedLevel: 1, pointsInvested: 2, score: "cha" },
                },
                {
                  name: "Quench Legacy Diplomat",
                  type: "focus",
                  system: { ownedLevel: 1, bonusSkills: ["talk"], bonusSkillsPick: 1, bonusSkillsChosen: [] },
                  // Legacy evidence: the old per-item "I already granted"
                  // boolean, with no flags.wwn.bonusSkillsGranted array yet
                  // -- exactly what a pre-2.0.0-beta4 world's foci look like.
                  flags: { wwn: { focusBonusGranted: true } },
                },
              ],
              { wwnMigrating: true },
            );
            const skill = created.find((i) => i.type === "skill");
            const focus = created.find((i) => i.type === "focus");
            assert.notExists(focus.getFlag("wwn", "bonusSkillsGranted"));

            await withSetting("bonusSkillsGrantedBackfillDone", false, async () => {
              await maybeBackfillBonusSkillsGranted();
              await settle();

              const refreshedFocus = actor.items.get(focus.id);
              assert.deepEqual(refreshedFocus.getFlag("wwn", "bonusSkillsGranted"), ["talk"]);
              assert.equal(
                actor.items.get(skill.id).system.ownedLevel,
                1,
                "backfill must never touch the skill's actual rank -- it only seeds bookkeeping",
              );
              assert.equal(
                actor.items.get(skill.id).system.pointsInvested,
                2,
                "backfill must never touch the skill's invested points either",
              );

              // The exact guarantee finding #1 (migration ordering) depends
              // on: once seeded, any later grant-sync call on this actor
              // (e.g. finalizeActorMigrationHooks re-running during a
              // migration pass) must be a pure no-op.
              await syncFocusBonusSkills(refreshedFocus, actor, { prompt: false });
              await settle();
              assert.equal(actor.items.get(skill.id).system.ownedLevel, 1, "no re-grant after backfill");
              assert.equal(actor.items.get(skill.id).system.pointsInvested, 2, "no re-grant after backfill");
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("leaves an item alone when it never granted anything (no legacy flag to backfill from)", async function () {
          const { maybeBackfillBonusSkillsGranted } = await wwnImport(
            "/systems/wwn/module/migration/bonus-skills-backfill.mjs",
          );
          const actor = await createTestActor("character", "backfill-nothing", {}, { wwnSkipSeeding: true });
          try {
            const [focus] = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Quench Ungranted Focus",
                  type: "focus",
                  system: { ownedLevel: 1, bonusSkills: [], bonusSkillsPick: 0, bonusSkillsChosen: [] },
                },
              ],
              { wwnMigrating: true },
            );

            await withSetting("bonusSkillsGrantedBackfillDone", false, async () => {
              await maybeBackfillBonusSkillsGranted();
              await settle();
              assert.notExists(
                actor.items.get(focus.id).getFlag("wwn", "bonusSkillsGranted"),
                "an item with no legacy grant evidence must not get a seeded (even empty) array",
              );
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("preserves bonusSkillsGranted across a PC compendium item swap", async function () {
          const { extractPreservedFields, buildReplacementData } = await wwnImport(
            "/systems/wwn/module/migration/pc-compendium-sync.mjs",
          );
          const actor = await createTestActor("character", "swap-preserve", {}, { wwnSkipSeeding: true });
          try {
            const [focus] = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Quench Swap Focus",
                  type: "focus",
                  system: { ownedLevel: 1, bonusSkills: ["talk"], bonusSkillsPick: 1, bonusSkillsChosen: [] },
                  flags: { wwn: { bonusSkillsGranted: ["talk"] } },
                },
              ],
              { wwnMigrating: true },
            );

            const preserved = extractPreservedFields(focus.toObject());
            assert.deepEqual(preserved.bonusSkillsGranted, ["talk"]);

            // A pack replacement item never carries this actor's grant
            // history -- swapOwnedItem always builds from a fresh pack copy.
            const packLike = foundry.utils.deepClone(focus.toObject());
            delete packLike.flags?.wwn?.bonusSkillsGranted;
            packLike._id = foundry.utils.randomID();

            const replacement = buildReplacementData(packLike, preserved);
            assert.deepEqual(
              replacement.flags?.wwn?.bonusSkillsGranted,
              ["talk"],
              "without this, a future compendium-generation swap produces a fresh item with no grant history, " +
                "which re-grants the first time it's edited again",
            );
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Bonus-skill grant backfill" },
  );
}
