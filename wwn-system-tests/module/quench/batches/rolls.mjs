import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withPinnedDice,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.rolls",
    (context) => {
      const { describe, it, assert } = context;

      describe("WwnDice rolls", function () {
        useQuenchTimeout(this);

        it("rolls a skill check with pinned dice", async function () {
          const actor = await createTestActor("character", "roll-skill");
          try {
            const [skill] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Stab",
                type: "skill",
                system: { slug: "stab", ownedLevel: 1, skillDice: "2d6", score: "str" },
              },
            ]);
            await settle();
            const msg = await withPinnedDice(0.5, () =>
              game.wwn.WwnDice.rollSkill(actor, skill, { skipDialog: true }),
            );
            assert.exists(msg);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("rolls a save with pinned dice", async function () {
          const actor = await createTestActor("character", "roll-save");
          try {
            await settle();
            const saveId = Object.keys(actor.system.saves ?? {}).find((k) => k !== "base") ?? "physical";
            const msg = await withPinnedDice(0.5, () =>
              game.wwn.WwnDice.rollSave(actor, saveId, { skipDialog: true }),
            );
            assert.exists(msg);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("rolls an attack without a target", async function () {
          const actor = await createTestActor("character", "roll-attack");
          try {
            const [weapon] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Sword",
                type: "weapon",
                system: {
                  damage: "1d8",
                  melee: true,
                  missile: false,
                  ammoMode: "none",
                  score: "str",
                },
              },
            ]);
            await settle();
            const msg = await withPinnedDice(0.99, () =>
              game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
            );
            assert.exists(msg);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Rolls" },
  );
}
