import {
  createCrewedStarship,
  createTestActor,
  deleteTestActor,
  deleteTestCombat,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.combat.encounters",
    (context) => {
      const { describe, it, assert } = context;

      describe("Encounter segregation", function () {
        useQuenchTimeout(this);

        it("rejects adding a starship into a personal combat", async function () {
          const { canAddActorTypeToCombat } = await wwnImport(
            "/systems/wwn/module/combat/encounter-kind.mjs",
          );
          const pc = await createTestActor("character", "enc-pc", {}, { wwnSkipSeeding: true });
          const { ship, crew } = await createCrewedStarship({ label: "enc-ship", withCaptain: true });
          let combat;
          try {
            combat = await Combat.create({});
            await combat.createEmbeddedDocuments("Combatant", [{ actorId: pc.id }]);
            await settle();

            const check = canAddActorTypeToCombat(combat, "starship");
            assert.isFalse(check.ok);
            assert.equal(check.reason, "starshipIntoNonStarship");

            const before = combat.combatants.size;
            const created = await combat.createEmbeddedDocuments("Combatant", [{ actorId: ship.id }]);
            await settle();
            assert.equal(created.length, 0);
            assert.equal(combat.combatants.size, before);
          } finally {
            await deleteTestCombat(combat);
            await deleteTestActor(ship);
            await deleteTestActor(crew);
            await deleteTestActor(pc);
          }
        });

        it("rejects adding a character into a faction combat", async function () {
          const { canAddActorTypeToCombat } = await wwnImport(
            "/systems/wwn/module/combat/encounter-kind.mjs",
          );
          const faction = await createTestActor("faction", "enc-faction");
          const pc = await createTestActor("character", "enc-pc2", {}, { wwnSkipSeeding: true });
          let combat;
          try {
            combat = await Combat.create({});
            await combat.createEmbeddedDocuments("Combatant", [{ actorId: faction.id }]);
            await settle();

            const check = canAddActorTypeToCombat(combat, "character");
            assert.isFalse(check.ok);
            assert.equal(check.reason, "personalIntoSpecial");

            const created = await combat.createEmbeddedDocuments("Combatant", [{ actorId: pc.id }]);
            await settle();
            assert.equal(created.length, 0);
          } finally {
            await deleteTestCombat(combat);
            await deleteTestActor(faction);
            await deleteTestActor(pc);
          }
        });

        it("allows a second starship in a starship combat", async function () {
          const a = await createCrewedStarship({ label: "enc-ship-a", withCaptain: false });
          const b = await createCrewedStarship({ label: "enc-ship-b", withCaptain: false });
          let combat;
          try {
            combat = await Combat.create({});
            await combat.createEmbeddedDocuments("Combatant", [
              { actorId: a.ship.id },
              { actorId: b.ship.id },
            ]);
            await settle();
            assert.equal(combat.combatants.size, 2);
          } finally {
            await deleteTestCombat(combat);
            await deleteTestActor(a.ship);
            await deleteTestActor(b.ship);
          }
        });
      });
    },
    { displayName: "WWN: Combat encounters" },
  );
}
