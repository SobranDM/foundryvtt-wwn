import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.activeEffects",
    (context) => {
      const { describe, it, assert } = context;

      describe("Active Effects on PCs", function () {
        useQuenchTimeout(this);

        it("ability baseMod AE raises derived ability mod", async function () {
          const actor = await createTestActor("character", "ae-pc");
          try {
            await actor.update({ "system.abilities.str.value": 10 });
            await settle();
            const before = actor.system.abilities.str.mod;

            await actor.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Quench STR +1",
                changes: [
                  {
                    key: "system.abilities.str.baseMod",
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    value: "1",
                    priority: 20,
                    phase: "initial",
                  },
                ],
                transfer: false,
                disabled: false,
              },
            ]);
            await settle();
            actor.prepareData();
            assert.isAbove(actor.system.abilities.str.mod, before);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("combat AC mod AE raises melee AC", async function () {
          const actor = await createTestActor("character", "ae-ac");
          try {
            await settle();
            const before = actor.system.combat.ac.melee.value;
            await actor.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Quench AC +2",
                changes: [
                  {
                    key: "system.combat.ac.mod",
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    value: "2",
                    priority: 20,
                    phase: "initial",
                  },
                ],
                transfer: false,
                disabled: false,
              },
            ]);
            await settle();
            actor.prepareData();
            assert.isAtLeast(actor.system.combat.ac.melee.value, before + 2);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Active Effects" },
  );
}
