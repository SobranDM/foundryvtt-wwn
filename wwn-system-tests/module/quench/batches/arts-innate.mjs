import { deleteTestActor, importCompendiumItem, packAvailable, settle, useQuenchTimeout, wwnImport, withSetting } from "../helpers.mjs";
import {
  GEAR_PACK,
  createFociTestPc,
  embedPackItem,
  skipIfNoAbilitiesPack,
} from "../foci-helpers.mjs";

const NO_AE_ARTS = [
  "Faultless Awareness",
  "Mob Justice",
  "Martial Style",
  "Master's Vigor",
  "Shattering Strike",
  "Consume Life Energy",
  "Unaging",
  "Sense Magic",
  "Pavis of Elements",
];

export default function register(quench) {
  quench.registerBatch(
    "wwn.arts.innate",
    (context) => {
      const { describe, it, assert } = context;

      describe("WWN arts innate AC and negatives", function () {
        useQuenchTimeout(this, 60000);

        beforeEach(function () {
          skipIfNoAbilitiesPack(this);
        });

        it("Unarmored Defense uses 13+floor(level/2) and drops when body armor is worn", async function () {
          const { deriveAC } = await wwnImport("/systems/wwn/module/derivations/ac.mjs");
          const actor = await createFociTestPc({ label: "uad", level: 1, skills: {} });
          try {
            await withSetting("separateRangedAC", false, async () => {
              await embedPackItem(actor, "Unarmored Defense");
              actor.prepareData();
              deriveAC(actor);
              assert.equal(actor.system.combat.innateAc.min, 13);
              assert.isAtLeast(actor.system.combat.ac.melee.value, 13);

              await actor.update({ "system.details.level": 3 });
              await settle();
              actor.prepareData();
              deriveAC(actor);
              assert.equal(actor.system.combat.innateAc.min, 14);

              await actor.createEmbeddedDocuments("Item", [
                {
                  name: "Quench Mail",
                  type: "armor",
                  system: { equipped: true, stowed: false, type: "medium", ac: 12, weight: 1 },
                },
              ]);
              await settle();
              actor.prepareData();
              deriveAC(actor);
              assert.equal(actor.system.combat.ac.melee.value, 12);
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Unarmored Defense still adds a shield bonus (known current behavior)", async function () {
          const { deriveAC } = await wwnImport("/systems/wwn/module/derivations/ac.mjs");
          const actor = await createFociTestPc({ label: "uad-sh", skills: {} });
          try {
            await embedPackItem(actor, "Unarmored Defense");
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Shield",
                type: "armor",
                system: { equipped: true, stowed: false, type: "shield", ac: 13, weight: 1 },
              },
            ]);
            await settle();
            actor.prepareData();
            deriveAC(actor);
            assert.isAbove(actor.system.combat.ac.melee.value, 13);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Cold Flesh is on the art, not Partial Necromancer", async function () {
          const { deriveAC } = await wwnImport("/systems/wwn/module/derivations/ac.mjs");
          const actor = await createFociTestPc({ label: "cold", level: 1, skills: {} });
          try {
            await embedPackItem(actor, "Partial Necromancer");
            actor.prepareData();
            deriveAC(actor);
            assert.equal(actor.system.combat.innateAc.min, 0);

            await embedPackItem(actor, "Cold Flesh");
            actor.prepareData();
            deriveAC(actor);
            assert.equal(actor.system.combat.innateAc.min, 12);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Pavis, Faultless Awareness, and Mob Justice do not set innate AC or surprise/shock flags", async function () {
          const actor = await createFociTestPc({ label: "neg-arts", skills: {} });
          try {
            await embedPackItem(actor, "Pavis of Elements");
            await embedPackItem(actor, "Faultless Awareness");
            await embedPackItem(actor, "Mob Justice");
            actor.prepareData();
            assert.equal(actor.system.combat.innateAc.min, 0);
            assert.isFalse(!!actor.system.combat.immuneToSurprise);
            assert.isFalse(!!actor.system.combat.immuneToShock);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("selected cost-0 arts transfer no combat AEs", async function () {
          const actor = await createFociTestPc({ label: "empty-arts", skills: {} });
          try {
            for (const name of NO_AE_ARTS) {
              const art = await embedPackItem(actor, name);
              assert.equal(art.effects.size, 0, name);
            }
            actor.prepareData();
            assert.equal(actor.system.combat.innateAc.min, 0);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Unarmed Might stays 1d6 / Shock 1 and does not get Armsmaster Stab", async function () {
          if (!packAvailable(GEAR_PACK)) this.skip();
          const src = await importCompendiumItem(GEAR_PACK, { nameEquals: "Unarmed Might" });
          if (!src) this.skip();
          const actor = await createFociTestPc({ label: "might" });
          try {
            await embedPackItem(actor, "Armsmaster");
            const might = await embedPackItem(actor, "Unarmed Might", { collection: GEAR_PACK });
            actor.prepareData();
            assert.equal(might.system.damage, "1d6");
            assert.equal(String(might.system.shock.damage), "1");
            const meleeLabel = game.i18n.localize("WWN.Effects.DamageMelee");
            const assembled = game.wwn.WwnDice.assembleAttack(actor, might, { attackKind: "melee" });
            assert.isFalse(assembled.damage.parts.some((p) => p.label === meleeLabel));
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("retired innate-AC armor items are not in the gear pack", async function () {
          if (!packAvailable(GEAR_PACK)) this.skip();
          for (const name of ["Unarmored Defense", "Cold Flesh", "Pavis of Elements"]) {
            const item = await importCompendiumItem(GEAR_PACK, { nameEquals: name, type: "armor" });
            assert.isNull(item, `${name} armor should be removed from gear`);
          }
        });
      });
    },
    { displayName: "WWN: Arts innate AC" },
  );
}
