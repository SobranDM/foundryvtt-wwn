import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.starship",
    (context) => {
      const { describe, it, assert } = context;

      describe("Starship hull and stations", function () {
        useQuenchTimeout(this);

        it("applies a hull preset and assigns a station actor", async function () {
          const { applyHullPreset } = await wwnImport(
            "/systems/wwn/module/config/starship-hulls.mjs",
          );
          const { buildStationAssignmentUpdate } = await wwnImport(
            "/systems/wwn/module/helpers/starship-crew.mjs",
          );

          const crew = await createTestActor("character", "crew");
          const ship = await createTestActor("starship", "ship");
          try {
            const hullUpdate = applyHullPreset("freeMerchant");
            assert.equal(hullUpdate["system.hullType"], "freeMerchant");
            await ship.update(hullUpdate);
            await settle();
            assert.equal(ship.system.hullType, "freeMerchant");
            assert.equal(ship.system.hp.max, 20);

            const stationUpdate = buildStationAssignmentUpdate(
              ship.system.stations,
              "captain",
              crew.uuid,
              { exclusive: true },
            );
            await ship.update(stationUpdate);
            await settle();
            assert.equal(ship.system.stations.captain.actor, crew.uuid);
          } finally {
            await deleteTestActor(ship);
            await deleteTestActor(crew);
          }
        });
      });
    },
    { displayName: "WWN: Starship" },
  );
}
