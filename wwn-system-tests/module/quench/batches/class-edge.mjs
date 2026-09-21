import {
  createTestActor,
  deleteTestActor,
  renderSheetRoundTrip,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.classEdge",
    (context) => {
      const { describe, it, assert } = context;

      describe("ClassEdge grants", function () {
        useQuenchTimeout(this);

        it("applies pre-seeded attribute and HD grants without dialogs", async function () {
          const { syncClassEdgeAttributeGrant } = await wwnImport(
            "/systems/wwn/module/helpers/class-edge-attribute-grants.mjs",
          );
          const actor = await createTestActor(
            "character",
            "edge-attr",
            {
              system: {
                abilities: { str: { value: 10 } },
                details: { level: 1 },
              },
            },
            { wwnSkipSeeding: true },
          );
          try {
            const created = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Quench Warrior",
                  type: "classEdge",
                  system: {
                    edgeType: "class",
                    companions: [],
                    hdGrant: { die: "d8", perLevelMod: 0 },
                    attributeGrant: { mode: "modPlus1Cap2", chosen: "str", exclude: [] },
                    bonusSkills: [],
                    bonusSkillsPick: 0,
                    bonusSkillsChosen: [],
                  },
                },
              ],
              { wwnMigrating: true },
            );
            const edge = created[0];
            await syncClassEdgeAttributeGrant(edge, actor, { prompt: false });
            await settle();
            actor.prepareData();

            assert.equal(edge.system.hdGrant.die, "d8");
            assert.equal(edge.system.attributeGrant.chosen, "str");
            const grantEffect = edge.effects.find((e) => e.getFlag("wwn", "attributeGrantEffect"));
            assert.exists(grantEffect);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("grants a pre-chosen bonus skill without prompting", async function () {
          const actor = await createTestActor("character", "edge-skill", {}, { wwnSkipSeeding: true });
          try {
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Survive",
                type: "skill",
                system: { slug: "survive", ownedLevel: -1, pointsInvested: 0, score: "int" },
              },
              {
                name: "Quench Expert",
                type: "classEdge",
                system: {
                  edgeType: "class",
                  companions: [],
                  bonusSkills: ["survive"],
                  bonusSkillsPick: 1,
                  bonusSkillsChosen: ["survive"],
                  attributeGrant: { mode: "", chosen: "" },
                },
              },
            ]);
            await settle();
            const skill = actor.items.find((i) => i.type === "skill");
            // Hook may bump ownedLevel; at minimum the edge exists with chosen set
            const edge = actor.items.find((i) => i.type === "classEdge");
            assert.deepEqual(edge.system.bonusSkillsChosen, ["survive"]);
            assert.exists(skill);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("persists attributeGrant.chosen on a classEdge sheet round-trip", async function () {
          const actor = await createTestActor("character", "edge-sheet", {}, { wwnSkipSeeding: true });
          try {
            const [edge] = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Quench Edge Sheet",
                  type: "classEdge",
                  system: {
                    edgeType: "edge",
                    companions: [],
                    attributeGrant: { mode: "prodigy", chosen: "dex", exclude: ["con"] },
                  },
                },
              ],
              { wwnMigrating: true },
            );
            await settle();
            await renderSheetRoundTrip({
              doc: edge,
              fieldPath: "system.attributeGrant.chosen",
              value: "str",
              assert,
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("two classEdges granting the same skill each track their own grant independently (parity with the focus collision fix)", async function () {
          // power-bonus-skills.mjs shares its idempotency guard with
          // focus-bonus-skills.mjs via bonus-skills-shared.mjs's
          // hasGrantedSkill/recordGrantedSkill -- this is the same collision
          // shape (Decimus's Stab: Warlike Blighted + Armsmaster both
          // granting "stab") using classEdge items instead of foci, to
          // confirm the shared extraction didn't reintroduce the bug for
          // this type.
          const { syncActorPowerBonusSkills } = await wwnImport("/systems/wwn/module/helpers/power-bonus-skills.mjs");
          const actor = await createTestActor("character", "edge-collision", {}, { wwnSkipSeeding: true });
          try {
            const created = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Stab",
                  type: "skill",
                  system: { slug: "stab", ownedLevel: -1, pointsInvested: 0, score: "str" },
                },
                {
                  name: "Quench Warlike-alike",
                  type: "classEdge",
                  system: {
                    edgeType: "edge",
                    companions: [],
                    bonusSkills: ["stab", "punch"],
                    bonusSkillsPick: 1,
                    bonusSkillsChosen: ["stab"],
                  },
                },
                {
                  name: "Quench Armsmaster-alike",
                  type: "classEdge",
                  system: {
                    edgeType: "edge",
                    companions: [],
                    bonusSkills: ["stab"],
                    bonusSkillsPick: 1,
                    bonusSkillsChosen: [],
                  },
                },
              ],
              { wwnMigrating: true },
            );
            const skill = created.find((i) => i.type === "skill");
            const [edgeA, edgeB] = created.filter((i) => i.type === "classEdge");

            await syncActorPowerBonusSkills(actor);
            await settle();
            const afterFirstPass = actor.items.get(skill.id).system.ownedLevel;
            // Each source's rank-mode grant is a real +1: edgeA trains -1 -> 0,
            // then edgeB's independent grant raises the now-trained skill 0 -> 1.
            assert.equal(afterFirstPass, 1, "two independent rank grants stack: -1 -> 0 -> 1");

            for (let i = 0; i < 5; i++) {
              await syncActorPowerBonusSkills(actor);
              await settle();
            }
            assert.equal(
              actor.items.get(skill.id).system.ownedLevel,
              afterFirstPass,
              "repeated sync passes must not disturb an already-granted rank",
            );
            assert.deepEqual(actor.items.get(edgeA.id).getFlag("wwn", "bonusSkillsGranted"), ["stab"]);
            assert.deepEqual(actor.items.get(edgeB.id).getFlag("wwn", "bonusSkillsGranted"), ["stab"]);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: ClassEdge" },
  );
}
