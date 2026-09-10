import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withSetting,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.actors.derived",
    (context) => {
      const { describe, it, assert } = context;

      describe("PC derived data", function () {
        useQuenchTimeout(this);

        it("updates ability mods and AC after ability / armor changes", async function () {
          const actor = await createTestActor("character", "derived-pc");
          try {
            await actor.update({
              "system.abilities.str.value": 14,
              "system.abilities.dex.value": 14,
              "system.details.level": 2,
            });
            await settle();
            assert.isAtLeast(actor.system.abilities.str.mod, 1);
            assert.isAtLeast(actor.system.abilities.dex.mod, 1);
            assert.exists(actor.system.combat?.ac?.melee?.value);

            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Armor",
                type: "armor",
                system: { equipped: true, type: "medium", ac: 14, weight: 1 },
              },
            ]);
            await settle();
            assert.isAtLeast(actor.system.combat.ac.melee.value, 14);
            assert.exists(actor.system.saves?.physical?.value);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("mirrors ranged AC to melee after innate floor when separate ranged is off", async function () {
          const actor = await createTestActor("character", "innate-ac");
          try {
            await withSetting("separateRangedAC", false, async () => {
              await actor.createEmbeddedDocuments("ActiveEffect", [
                {
                  name: "Quench Innate AC",
                  changes: [
                    {
                      key: "system.combat.innateAc.min",
                      mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE,
                      value: "15",
                      priority: 20,
                      // deriveAC runs in prepareDerivedData (before final-phase AEs),
                      // so the floor must be present as initial for AC values to update.
                      phase: "initial",
                    },
                  ],
                  transfer: false,
                  disabled: false,
                },
              ]);
              await settle();
              actor.prepareData();
              assert.equal(actor.system.combat.ac.melee.value, actor.system.combat.ac.ranged.value);
              assert.isAtLeast(actor.system.combat.ac.melee.value, 15);
            });
          } finally {
            await deleteTestActor(actor);
          }
        });
      });

      describe("NPC derived data", function () {
        useQuenchTimeout(this);

        it("derives HD-based saves for monsters", async function () {
          const actor = await createTestActor("monster", "derived-npc", {
            system: { hd: "4" },
          });
          try {
            await settle();
            assert.exists(actor.system.saves?.physical?.value);
            assert.isNumber(actor.system.saves.physical.value);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Actors derived" },
  );
}
