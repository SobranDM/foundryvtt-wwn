import {
  createCrewedStarship,
  deleteTestActor,
  deleteTestCombat,
  renderSheetRoundTrip,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.starship.combat",
    (context) => {
      const { describe, it, assert } = context;

      describe("Starship combat", function () {
        useQuenchTimeout(this);

        it("absorbs hull damage through combat bonus HP then hull", async function () {
          const { ship, crew } = await createCrewedStarship({ label: "ss-bonus" });
          try {
            await ship.setFlag("wwn", "combatBonusHp", 5);
            await ship.update({ "system.hp.value": ship.system.hp.max });
            await settle();
            const hullBefore = ship.system.hp.value;

            await ship.applyDamage(8);
            await settle();

            const bonus = ship.getFlag("wwn", "combatBonusHp") ?? 0;
            assert.equal(bonus, 0);
            assert.equal(ship.system.hp.value, hullBefore - 3);
          } finally {
            await deleteTestActor(ship);
            await deleteTestActor(crew);
          }
        });

        it("applies hull damage via applyStarshipHullDamage", async function () {
          const { applyStarshipHullDamage } = await wwnImport(
            "/systems/wwn/module/combat/starship/hull-damage.mjs",
          );
          const { ship, crew } = await createCrewedStarship({ label: "ss-hull" });
          try {
            await ship.unsetFlag("wwn", "combatBonusHp");
            const before = ship.system.hp.value;
            const result = await applyStarshipHullDamage(ship, 4);
            await settle();
            assert.equal(result.hullDamage, 4);
            assert.equal(ship.system.hp.value, before - 4);
          } finally {
            await deleteTestActor(ship);
            await deleteTestActor(crew);
          }
        });

        it("initializes starship combatant state when combat starts", async function () {
          const { ensureStarshipCombatState, getStarshipCombatState } = await wwnImport(
            "/systems/wwn/module/combat/starship/combatant-state.mjs",
          );
          const a = await createCrewedStarship({ label: "ss-state-a", withCaptain: false });
          const b = await createCrewedStarship({ label: "ss-state-b", withCaptain: false });
          let combat;
          try {
            combat = await Combat.create({});
            await combat.createEmbeddedDocuments("Combatant", [
              { actorId: a.ship.id },
              { actorId: b.ship.id },
            ]);
            await settle();
            const combatant = combat.combatants.find((c) => c.actorId === a.ship.id);
            await ensureStarshipCombatState(combatant);
            const state = getStarshipCombatState(combatant);
            assert.exists(state);
            assert.property(state, "cp");
          } finally {
            await deleteTestCombat(combat);
            await deleteTestActor(a.ship);
            await deleteTestActor(b.ship);
          }
        });

        it("persists captain station UUID on the starship sheet", async function () {
          const { ship, crew } = await createCrewedStarship({ label: "ss-sheet" });
          try {
            assert.equal(ship.system.stations.captain.actor, crew.uuid);
            await renderSheetRoundTrip({
              doc: ship,
              fieldPath: "system.stations.captain.actor",
              value: crew.uuid,
              assert,
            });
          } finally {
            await deleteTestActor(ship);
            await deleteTestActor(crew);
          }
        });
      });
    },
    { displayName: "WWN: Starship combat" },
  );
}
