import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.powerArmor",
    (context) => {
      const { describe, it, assert } = context;

      describe("Power armor pilot and plating", function () {
        useQuenchTimeout(this);

        it("links a pilot and derives plating AC from fittings", async function () {
          const { PHASE_A_EFFECT_IDS } = await wwnImport(
            "/systems/wwn/module/helpers/power-armor-budget.mjs",
          );

          const pilot = await createTestActor("character", "pilot");
          const suit = await createTestActor("powerArmor", "suit", {
            system: {
              mass: { max: 10 },
              power: { max: 10 },
              powered: true,
            },
          });
          try {
            await suit.update({
              "system.pilot.actor": pilot.uuid,
              "system.trainedPilots": [pilot.uuid],
            });
            await suit.createEmbeddedDocuments("Item", [
              {
                name: "Basic Plating",
                type: "armorFitting",
                system: {
                  mass: 1,
                  power: 0,
                  effectId: PHASE_A_EFFECT_IDS.platingBasic,
                  disabled: false,
                },
              },
            ]);
            await settle();
            suit.prepareData();
            assert.equal(suit.system.pilot.actor, pilot.uuid);
            assert.isTrue(suit.system.pilotTrained);
            assert.equal(suit.system.derived?.ac ?? suit.system.ac, 18);
          } finally {
            await deleteTestActor(suit);
            await deleteTestActor(pilot);
          }
        });
      });
    },
    { displayName: "WWN: Power armor" },
  );
}
