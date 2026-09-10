import {
  createTestActor,
  createTestItem,
  deleteTestActor,
  deleteTestItem,
  renderSheetRoundTrip,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.sheets.persistence",
    (context) => {
      const { describe, it, assert } = context;

      describe("Sheet round-trips", function () {
        useQuenchTimeout(this);

        const actorSpecs = [
          { type: "character", fieldPath: "system.biography", value: "<p>Quench PC bio</p>" },
          { type: "monster", fieldPath: "system.biography", value: "<p>Quench NPC bio</p>" },
          { type: "faction", fieldPath: "system.description", value: "<p>Quench faction</p>" },
          { type: "starship", fieldPath: "system.description", value: "<p>Quench ship</p>" },
          { type: "powerArmor", fieldPath: "system.description", value: "<p>Quench suit</p>" },
        ];

        for (const spec of actorSpecs) {
          it(`persists ${spec.type} ${spec.fieldPath}`, async function () {
            const actor = await createTestActor(spec.type, `sheet-${spec.type}`);
            try {
              await renderSheetRoundTrip({
                doc: actor,
                fieldPath: spec.fieldPath,
                value: spec.value,
                assert,
              });
            } finally {
              await deleteTestActor(actor);
            }
          });
        }

        it("persists weapon description on an item sheet", async function () {
          const item = await createTestItem("weapon", "sheet-weapon");
          try {
            await renderSheetRoundTrip({
              doc: item,
              fieldPath: "system.description",
              value: "<p>Quench weapon</p>",
              assert,
            });
          } finally {
            await deleteTestItem(item);
          }
        });
      });
    },
    { displayName: "WWN: Sheets persistence" },
  );
}
