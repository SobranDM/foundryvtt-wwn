import {
  createTestActor,
  deleteTestActor,
  renderSheetRoundTrip,
  settle,
  useQuenchTimeout,
  withSetting,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.encumbrance",
    (context) => {
      const { describe, it, assert } = context;

      describe("Encumbrance and movement", function () {
        useQuenchTimeout(this);

        it("counts readied vs stowed weight and currency slots", async function () {
          const actor = await createTestActor(
            "character",
            "enc-pc",
            {
              system: {
                abilities: { str: { value: 10 } },
              },
            },
            { wwnSkipSeeding: true },
          );
          try {
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Readied Pack",
                type: "item",
                system: { weight: 2, quantity: 1, equipped: true, stowed: false },
              },
              {
                name: "Quench Stowed Pack",
                type: "item",
                system: { weight: 3, quantity: 1, equipped: false, stowed: true },
              },
              {
                name: "Silver",
                type: "currency",
                system: { carried: 100, banked: 0, perSlot: 100 },
              },
            ]);
            await settle();
            actor.prepareData();

            assert.equal(actor.system.encumbrance.readied.value, 2);
            // stowed: 3 gear + 1 currency slot
            assert.equal(actor.system.encumbrance.stowed.value, 4);
            assert.equal(actor.system.encumbrance.readied.max, 5);
            assert.equal(actor.system.encumbrance.stowed.max, 10);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("derives WWN vs B/X movement rates under load", async function () {
          const actor = await createTestActor(
            "character",
            "move-pc",
            {
              system: {
                abilities: { str: { value: 10 } },
              },
            },
            { wwnSkipSeeding: true },
          );
          try {
            await withSetting("showMovement", true, async () => {
              await withSetting("movementRate", "movewwn", async () => {
                actor.prepareData();
                const wwnCombat = actor.system.movement.combat;
                assert.isAtLeast(wwnCombat, 15);

                await withSetting("movementRate", "movebx", async () => {
                  actor.prepareData();
                  const bxCombat = actor.system.movement.combat;
                  assert.isAtLeast(bxCombat, 20);
                  assert.notEqual(bxCombat, wwnCombat);
                });
              });
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("persists equipped/stowed on a gear sheet round-trip", async function () {
          const actor = await createTestActor("character", "enc-sheet", {}, { wwnSkipSeeding: true });
          try {
            const [gear] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Rope",
                type: "item",
                system: { weight: 1, quantity: 1, equipped: false, stowed: true },
              },
            ]);
            await settle();
            await renderSheetRoundTrip({
              doc: gear,
              fieldPath: "system.equipped",
              value: true,
              assert,
            });
            await gear.update({ "system.stowed": false });
            await settle();
            assert.isTrue(gear.system.equipped);
            assert.isFalse(gear.system.stowed);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Encumbrance" },
  );
}
