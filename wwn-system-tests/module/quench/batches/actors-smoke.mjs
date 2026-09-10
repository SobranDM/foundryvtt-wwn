import {
  ACTOR_SMOKE_TYPES,
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.actors.smoke",
    (context) => {
      const { describe, it, assert } = context;

      describe("Actor creation", function () {
        useQuenchTimeout(this);

        for (const type of ACTOR_SMOKE_TYPES) {
          it(`creates a ${type} actor`, async function () {
            const actor = await createTestActor(type);
            try {
              await settle();
              assert.equal(actor.type, type);
              assert.exists(actor.system);
              if (type === "character" || type === "monster") {
                assert.isAtLeast(Number(actor.system.hp?.max ?? 0), 0);
              }
            } finally {
              await deleteTestActor(actor);
            }
          });
        }
      });
    },
    { displayName: "WWN: Actors smoke" },
  );
}
