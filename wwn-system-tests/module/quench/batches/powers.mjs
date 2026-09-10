import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.powers",
    (context) => {
      const { describe, it, assert } = context;

      describe("Power commitment refresh", function () {
        useQuenchTimeout(this);

        it("reclaims scene commitment via refreshPowers", async function () {
          const actor = await createTestActor("character", "power-pc");
          try {
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Effort Edge",
                type: "classEdge",
                system: {
                  edgeType: "class",
                  poolGrant: { name: "Effort", formula: "2", value: 2 },
                },
              },
              {
                name: "Quench Art",
                type: "power",
                system: {
                  subType: "art",
                  pool: "Effort",
                  poolCommitted: { scene: 1, day: 0, active: 0, none: 0 },
                  isActive: false,
                },
              },
            ]);
            await settle();
            const power = actor.items.find((i) => i.type === "power");
            assert.equal(power.system.poolCommitted.scene, 1);

            await game.wwn.refreshPowers(actor, "scene");
            await settle();
            const refreshed = actor.items.get(power.id);
            assert.equal(refreshed.system.poolCommitted.scene, 0);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Powers" },
  );
}
