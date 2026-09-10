import {
  createTestActor,
  deleteTestActor,
  importCompendiumItem,
  packAvailable,
  settle,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.compendiums",
    (context) => {
      const { describe, it, assert } = context;

      describe("Abilities pack", function () {
        useQuenchTimeout(this);

        it("loads a skill from wwn.abilities-wwn and embeds it", async function () {
          if (!packAvailable("wwn.abilities-wwn")) {
            this.skip();
          }
          const packSkill = await importCompendiumItem("wwn.abilities-wwn", { type: "skill" });
          assert.exists(packSkill, "expected a skill in abilities-wwn");

          const actor = await createTestActor("character", "pack-pc");
          try {
            const [embedded] = await actor.createEmbeddedDocuments("Item", [
              packSkill.toObject(),
            ]);
            await settle();
            assert.equal(embedded.type, "skill");
            assert.isString(embedded.name);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Compendiums" },
  );
}
