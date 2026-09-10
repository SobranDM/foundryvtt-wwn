import {
  createPilotedPowerArmor,
  deleteTestActor,
  renderSheetRoundTrip,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

/**
 * Basic plating is required for soakMax > 0 (unplated suits clamp soak to 0).
 * @param {Actor} armor
 */
async function installBasicPlating(armor) {
  const { PHASE_A_EFFECT_IDS } = await wwnImport(
    "/systems/wwn/module/helpers/power-armor-budget.mjs",
  );
  await armor.createEmbeddedDocuments("Item", [
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
  armor.prepareData();
}

export default function register(quench) {
  quench.registerBatch(
    "wwn.powerArmor.combat",
    (context) => {
      const { describe, it, assert } = context;

      describe("Power armor combat damage", function () {
        useQuenchTimeout(this);

        it("depletes soak then overflows to the pilot ignoring personal soak", async function () {
          const { armor, pilot } = await createPilotedPowerArmor({
            label: "pa-dmg",
            armorSystem: {
              mass: { max: 10 },
              power: { max: 10 },
              powered: true,
              soak: { value: 5, max: 5 },
            },
            pilotSystem: { hp: { value: 12, max: 12 } },
          });
          try {
            await installBasicPlating(armor);
            await armor.update({ "system.soak.value": 5 });
            await settle();
            armor.prepareData();
            assert.isAtLeast(Number(armor.system.derived?.soakMax ?? 0), 5);

            const pilotBefore = pilot.system.hp.value;
            await armor.applyDamage(8);
            await settle();

            assert.equal(armor.system.soak.value, 0);
            assert.equal(pilot.system.hp.value, pilotBefore - 3);
          } finally {
            await deleteTestActor(armor);
            await deleteTestActor(pilot);
          }
        });

        it("damages viHp when Black Ofuda empty-suit mode is active", async function () {
          const { EMPTY_SUIT_STATS, patchFittingState } = await wwnImport(
            "/systems/wwn/module/helpers/power-armor-fitting-state.mjs",
          );
          const { armor, pilot } = await createPilotedPowerArmor({
            label: "pa-vi",
            armorSystem: {
              soak: { value: 5, max: 5 },
              viHp: { value: 15, max: 15 },
            },
          });
          try {
            const next = patchFittingState(armor.system, "blackOfuda", {
              emptySuit: true,
              active: true,
              flags: { ...EMPTY_SUIT_STATS },
            });
            await armor.update({
              "system.fittingState": next,
              "system.viHp.value": EMPTY_SUIT_STATS.hp,
              "system.viHp.max": EMPTY_SUIT_STATS.hp,
              "system.soak.value": EMPTY_SUIT_STATS.soak,
            });
            await settle();
            armor.prepareData();
            assert.isTrue(!!armor.system.derived?.emptySuit?.active);

            const before = armor.system.viHp.value;
            const pilotBefore = pilot.system.hp.value;
            // Empty-suit soak is 15; overflow past soak damages viHp (not the pilot).
            await armor.applyDamage(20);
            await settle();
            assert.equal(armor.system.soak.value, 0);
            assert.equal(armor.system.viHp.value, before - 5);
            assert.equal(pilot.system.hp.value, pilotBefore);
          } finally {
            await deleteTestActor(armor);
            await deleteTestActor(pilot);
          }
        });

        it("persists pilot UUID and soak on the power-armor sheet", async function () {
          const { armor, pilot } = await createPilotedPowerArmor({
            label: "pa-sheet",
            armorSystem: {
              mass: { max: 10 },
              power: { max: 10 },
              powered: true,
            },
          });
          try {
            await installBasicPlating(armor);
            await renderSheetRoundTrip({
              doc: armor,
              fieldPath: "system.pilot.actor",
              value: pilot.uuid,
              assert,
            });
            await renderSheetRoundTrip({
              doc: armor,
              fieldPath: "system.soak.value",
              value: 3,
              assert,
            });
          } finally {
            await deleteTestActor(armor);
            await deleteTestActor(pilot);
          }
        });
      });
    },
    { displayName: "WWN: Power armor combat" },
  );
}
