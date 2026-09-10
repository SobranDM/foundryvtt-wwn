import {
  createTestActor,
  deleteTestActor,
  renderSheetRoundTrip,
  settle,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.powers.lifecycle",
    (context) => {
      const { describe, it, assert } = context;

      describe("Power commitment lifecycle", function () {
        useQuenchTimeout(this);

        it("usePower spends scene commitment and endScene reclaims it", async function () {
          const actor = await createTestActor("character", "pwr-scene", {}, { wwnSkipSeeding: true });
          try {
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Effort Edge",
                type: "classEdge",
                system: {
                  edgeType: "class",
                  poolGrant: { name: "Effort", formula: "3", value: 3 },
                  companions: [],
                  attributeGrant: { mode: "", chosen: "", exclude: [] },
                },
              },
              {
                name: "Quench Scene Art",
                type: "power",
                system: {
                  subType: "art",
                  resourceName: "Effort",
                  commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
                  poolCommitted: { scene: 0, day: 0, active: 0, none: 0 },
                  userStrain: "",
                  prepared: false,
                },
              },
            ]);
            await settle();
            actor.prepareData();
            const power = actor.items.find((i) => i.type === "power");
            assert.exists(power);

            await power.usePower({ skipDialog: true });
            await settle();
            assert.equal(actor.items.get(power.id).system.poolCommitted.scene, 1);

            await game.wwn.refreshPowers(actor, "scene");
            await settle();
            assert.equal(actor.items.get(power.id).system.poolCommitted.scene, 0);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("usePower day commitment reclaims via endDay", async function () {
          const actor = await createTestActor("character", "pwr-day", {}, { wwnSkipSeeding: true });
          try {
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Effort Edge Day",
                type: "classEdge",
                system: {
                  edgeType: "class",
                  poolGrant: { name: "Effort", formula: "2", value: 2 },
                  companions: [],
                },
              },
              {
                name: "Quench Day Art",
                type: "power",
                system: {
                  subType: "art",
                  resourceName: "Effort",
                  commitmentOptions: [{ cost: 1, length: "day", note: "" }],
                  userStrain: "",
                },
              },
            ]);
            await settle();
            const power = actor.items.find((i) => i.type === "power");
            await power.usePower({ skipDialog: true });
            await settle();
            assert.equal(actor.items.get(power.id).system.poolCommitted.day, 1);

            await game.wwn.refreshPowers(actor, "day");
            await settle();
            assert.equal(actor.items.get(power.id).system.poolCommitted.day, 0);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("blocks unprepared spells and allows prepared ones", async function () {
          const actor = await createTestActor(
            "character",
            "pwr-prep",
            { system: { details: { level: 1 } } },
            { wwnSkipSeeding: true },
          );
          try {
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Mage",
                type: "classEdge",
                system: {
                  edgeType: "class",
                  companions: [],
                  slotGrant: {
                    enabled: false,
                    progression: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
                    leveledProgression: [],
                    value: 0,
                  },
                },
              },
              {
                name: "Quench Spell",
                type: "power",
                system: {
                  subType: "spell",
                  resourceName: "Spell Slots",
                  prepared: false,
                  level: 1,
                  commitmentOptions: [{ cost: 1, length: "day", note: "" }],
                  userStrain: "",
                },
              },
            ]);
            await settle();
            const spell = actor.items.find((i) => i.type === "power");

            await spell.usePower({ skipDialog: true });
            await settle();
            assert.equal(actor.items.get(spell.id).system.poolCommitted.day, 0);

            await spell.update({ "system.prepared": true });
            await settle();
            actor.prepareData();
            await spell.usePower({ skipDialog: true });
            await settle();
            assert.equal(actor.items.get(spell.id).system.poolCommitted.day, 1);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("activatePower / deactivatePower toggles active commitment and transfer AEs", async function () {
          const actor = await createTestActor("character", "pwr-active", {}, { wwnSkipSeeding: true });
          try {
            const created = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Effort Active",
                type: "classEdge",
                system: {
                  edgeType: "class",
                  poolGrant: { name: "Effort", formula: "3", value: 3 },
                  companions: [],
                },
              },
              {
                name: "Quench Active Art",
                type: "power",
                system: {
                  subType: "art",
                  resourceName: "Effort",
                  commitmentOptions: [{ cost: 1, length: "active", note: "" }],
                  isActive: false,
                  userStrain: "",
                },
              },
            ]);
            const power = created.find((i) => i.type === "power");
            await power.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Quench Buff",
                transfer: true,
                disabled: true,
                changes: [
                  {
                    key: "system.combat.ab",
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    value: "1",
                    priority: 20,
                    phase: "initial",
                  },
                ],
              },
            ]);
            await settle();

            await power.activatePower({ skipDialog: true });
            await settle();
            const active = actor.items.get(power.id);
            assert.isTrue(active.system.isActive);
            assert.equal(active.system.poolCommitted.active, 1);
            const effect = active.effects.contents[0];
            assert.isFalse(effect.disabled);

            await power.deactivatePower();
            await settle();
            const inactive = actor.items.get(power.id);
            assert.isFalse(inactive.system.isActive);
            assert.isTrue(inactive.effects.contents[0].disabled);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("persists prepared flag on a power sheet round-trip", async function () {
          const actor = await createTestActor("character", "pwr-sheet", {}, { wwnSkipSeeding: true });
          try {
            const [spell] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Sheet Spell",
                type: "power",
                system: { subType: "spell", prepared: false, level: 1 },
              },
            ]);
            await settle();
            await renderSheetRoundTrip({
              doc: spell,
              fieldPath: "system.prepared",
              value: true,
              assert,
            });
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Powers lifecycle" },
  );
}
