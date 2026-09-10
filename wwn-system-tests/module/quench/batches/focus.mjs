import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withSetting,
  wwnImport,
} from "../helpers.mjs";

/**
 * Focus bonus Quench notes:
 * - New PCs async-seed primary skills (`WwnActor.#seedNewPc`). Without
 *   `wwnSkipSeeding`, a duplicate Survive/Know can exist and
 *   `findSkillBySlug` grants the seeded item while the test asserts on ours.
 * - `createItem` auto-sync is async and reads the live world setting; pin
 *   level/setting, then grant once via explicit sync (skip hook with
 *   `wwnMigrating`).
 * - Idempotency now lives on the granting focus itself
 *   (`flags.wwn.bonusSkillsGranted`, an array of skill slugs that focus has
 *   granted) rather than on the skill — see focus-bonus-skills.mjs's
 *   grantBonusSkill / bonus-skills-shared.mjs's hasGrantedSkill. There is no
 *   longer a `focusBonusMode`/`focusBonusLevelDelta`/`focusBonusFrom` flag to
 *   assert on.
 */
export default function register(quench) {
  quench.registerBatch(
    "wwn.focus",
    (context) => {
      const { describe, it, assert } = context;

      describe("Focus bonus skills", function () {
        useQuenchTimeout(this);

        it("grants a single rank at level 1 when points setting is off", async function () {
          const { syncFocusBonusSkills, shouldUseFocusBonusPoints, findSkillBySlug } = await wwnImport(
            "/systems/wwn/module/helpers/focus-bonus-skills.mjs",
          );
          const actor = await createTestActor("character", "focus-l1", {}, { wwnSkipSeeding: true });
          try {
            await actor.update({ "system.details.level": 1 });
            await settle();

            await withSetting("bonusSkillsGrantPointsAtFirstLevel", false, async () => {
              assert.equal(actor.system.details.level, 1);
              assert.equal(shouldUseFocusBonusPoints(actor), false);

              const created = await actor.createEmbeddedDocuments(
                "Item",
                [
                  {
                    name: "Survive",
                    type: "skill",
                    system: { slug: "survive", ownedLevel: -1, pointsInvested: 0, score: "int" },
                  },
                  {
                    name: "Quench Focus",
                    type: "focus",
                    system: {
                      ownedLevel: 1,
                      bonusSkills: ["survive"],
                      bonusSkillsPick: 1,
                      bonusSkillsChosen: ["survive"],
                    },
                  },
                ],
                { wwnMigrating: true },
              );
              const skill = created.find((i) => i.type === "skill");
              const focus = created.find((i) => i.type === "focus");
              assert.equal(actor.items.filter((i) => i.type === "skill").length, 1, "no seeded duplicate skills");
              assert.equal(findSkillBySlug(actor, "survive")?.id, skill.id);

              await syncFocusBonusSkills(focus, actor, { prompt: false });
              await settle();

              const refreshedSkill = actor.items.get(skill.id);
              const refreshedFocus = actor.items.get(focus.id);
              assert.equal(refreshedSkill.system.ownedLevel, 0);
              assert.deepEqual(refreshedFocus.getFlag("wwn", "bonusSkillsGranted"), ["survive"]);
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("uses +3 skill points path at level 2+", async function () {
          const { syncFocusBonusSkills, shouldUseFocusBonusPoints, findSkillBySlug } = await wwnImport(
            "/systems/wwn/module/helpers/focus-bonus-skills.mjs",
          );
          const actor = await createTestActor("character", "focus-l2", {}, { wwnSkipSeeding: true });
          try {
            await actor.update({ "system.details.level": 2 });
            await settle();
            assert.equal(shouldUseFocusBonusPoints(actor), true);

            const created = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Know",
                  type: "skill",
                  system: { slug: "know", ownedLevel: -1, pointsInvested: 0, score: "int" },
                },
                {
                  name: "Quench Focus L2",
                  type: "focus",
                  system: {
                    ownedLevel: 1,
                    bonusSkills: ["know"],
                    bonusSkillsPick: 1,
                    bonusSkillsChosen: ["know"],
                  },
                },
              ],
              { wwnMigrating: true },
            );
            const skill = created.find((i) => i.type === "skill");
            const focus = created.find((i) => i.type === "focus");
            assert.equal(findSkillBySlug(actor, "know")?.id, skill.id);

            await syncFocusBonusSkills(focus, actor, { prompt: false });
            await settle();

            const refreshedSkill = actor.items.get(skill.id);
            const refreshedFocus = actor.items.get(focus.id);
            // +3 points from untrained (-1): cost 1 → 0, cost 2 → 1, remainder 0
            assert.equal(refreshedSkill.system.ownedLevel, 1);
            assert.deepEqual(refreshedFocus.getFlag("wwn", "bonusSkillsGranted"), ["know"]);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("does not re-grant when the already-granted focus is edited again (e.g. leveled up)", async function () {
          const { syncFocusBonusSkills, findSkillBySlug } = await wwnImport(
            "/systems/wwn/module/helpers/focus-bonus-skills.mjs",
          );
          const actor = await createTestActor("character", "focus-reedit", {}, { wwnSkipSeeding: true });
          try {
            await actor.update({ "system.details.level": 1 });
            await settle();
            await withSetting("bonusSkillsGrantPointsAtFirstLevel", false, async () => {
              const created = await actor.createEmbeddedDocuments(
                "Item",
                [
                  {
                    name: "Perform",
                    type: "skill",
                    system: { slug: "perform", ownedLevel: -1, pointsInvested: 0, score: "cha" },
                  },
                  {
                    name: "Quench Reedit Focus",
                    type: "focus",
                    system: {
                      ownedLevel: 1,
                      bonusSkills: ["perform"],
                      bonusSkillsPick: 1,
                      bonusSkillsChosen: ["perform"],
                    },
                  },
                ],
                { wwnMigrating: true },
              );
              const skill = created.find((i) => i.type === "skill");
              const focus = created.find((i) => i.type === "focus");

              await syncFocusBonusSkills(focus, actor, { prompt: false });
              await settle();
              assert.equal(actor.items.get(skill.id).system.ownedLevel, 0, "first grant trains 0");

              // The player levels this focus up (a common, ordinary action —
              // e.g. "Specialist" going from L1 to L2's better dice tier).
              // The updateItem hook re-fires syncFocusBonusSkills for any
              // system.ownedLevel change; it must be a no-op here.
              await focus.update({ "system.ownedLevel": 2 });
              await settle();

              assert.equal(
                actor.items.get(skill.id).system.ownedLevel,
                0,
                "leveling the already-granted focus must not re-apply its bonus",
              );
              assert.deepEqual(
                actor.items.get(focus.id).getFlag("wwn", "bonusSkillsGranted"),
                ["perform"],
                "granted-skills record must not grow past its one real grant",
              );
              assert.equal(findSkillBySlug(actor, "perform").id, skill.id, "no duplicate skill item created");
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("deleting the granting focus does not revoke the skill points/rank it granted", async function () {
          const { syncFocusBonusSkills } = await wwnImport("/systems/wwn/module/helpers/focus-bonus-skills.mjs");
          const actor = await createTestActor("character", "focus-delete", {}, { wwnSkipSeeding: true });
          try {
            await actor.update({ "system.details.level": 1 });
            await settle();
            await withSetting("bonusSkillsGrantPointsAtFirstLevel", false, async () => {
              const created = await actor.createEmbeddedDocuments(
                "Item",
                [
                  {
                    name: "Craft",
                    type: "skill",
                    system: { slug: "craft", ownedLevel: -1, pointsInvested: 0, score: "int" },
                  },
                  {
                    name: "Quench Delete Focus",
                    type: "focus",
                    system: {
                      ownedLevel: 1,
                      bonusSkills: ["craft"],
                      bonusSkillsPick: 1,
                      bonusSkillsChosen: ["craft"],
                    },
                  },
                ],
                { wwnMigrating: true },
              );
              const skill = created.find((i) => i.type === "skill");
              const focus = created.find((i) => i.type === "focus");

              await syncFocusBonusSkills(focus, actor, { prompt: false });
              await settle();
              assert.equal(actor.items.get(skill.id).system.ownedLevel, 0);

              // Deleting a focus/power/classEdge is a permanent, sunk grant now
              // -- revokeFocusBonusSkills was removed on purpose (too narrow a
              // use case to justify the per-source delta bookkeeping it needed,
              // which is exactly what caused the shared-slot collision bug).
              await focus.delete();
              await settle();

              assert.equal(
                actor.items.get(skill.id)?.system.ownedLevel,
                0,
                "deleting the focus must not claw back the skill it already granted",
              );
              assert.notExists(actor.items.get(focus.id), "focus itself is gone");
            });
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Focus bonus skills" },
  );
}
