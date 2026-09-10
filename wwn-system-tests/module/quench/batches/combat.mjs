import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withSetting,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.combat",
    (context) => {
      const { describe, it, assert } = context;

      describe("Combat lifecycle", function () {
        useQuenchTimeout(this);

        it("smartRerollInitiative with excludePCGroups does not throw without star siblings", async function () {
          const pc = await createTestActor("character", "combat-pc");
          const npc = await createTestActor("monster", "combat-npc");
          let combat = null;
          try {
            await withSetting("initiative", "group", async () => {
              combat = await Combat.create({ scene: null });
              await combat.createEmbeddedDocuments("Combatant", [
                { actorId: pc.id },
                { actorId: npc.id },
              ]);
              await settle();
              // May create CombatantGroups via system hooks; either way must not throw.
              await combat.smartRerollInitiative({
                excludeAlreadyRolled: true,
                excludePCGroups: true,
              });
              assert.ok(true);
            });
          } finally {
            if (combat?.id) await combat.delete();
            await deleteTestActor(pc);
            await deleteTestActor(npc);
          }
        });

        it("end-round weapon counter reset uses actor items (linked-token safe)", async function () {
          const npc = await createTestActor("monster", "counter-npc");
          let combat = null;
          try {
            const [weapon] = await npc.createEmbeddedDocuments("Item", [
              {
                name: "Quench Claw",
                type: "weapon",
                system: { counter: { value: 0, max: 3 }, damage: "1d4", melee: true },
              },
            ]);
            combat = await Combat.create({ scene: null });
            await combat.createEmbeddedDocuments("Combatant", [{ actorId: npc.id }]);
            await settle();
            await combat._onEndRound({ round: 1 });
            await settle();
            const refreshed = npc.items.get(weapon.id);
            assert.equal(refreshed.system.counter.value, refreshed.system.counter.max);
          } finally {
            if (combat?.id) await combat.delete();
            await deleteTestActor(npc);
          }
        });
      });
    },
    { displayName: "WWN: Combat" },
  );
}
