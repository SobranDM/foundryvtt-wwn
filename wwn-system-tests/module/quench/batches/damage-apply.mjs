import {
  createArmedCharacter,
  createTargetMonster,
  deleteTestActor,
  settle,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.damage.apply",
    (context) => {
      const { describe, it, assert } = context;

      describe("Actor.applyDamage", function () {
        useQuenchTimeout(this);

        it("reduces damage by equipped armor soak", async function () {
          const { actor } = await createArmedCharacter({
            label: "soak-pc",
            armorSystem: { soak: 2, equipped: true, stowed: false },
          });
          try {
            actor.prepareData();
            assert.equal(actor.system.combat.soak, 2);
            const before = actor.system.hp.value;
            await actor.applyDamage(5);
            await settle();
            assert.equal(actor.system.hp.value, before - 3);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("heals when amount is negative", async function () {
          const monster = await createTargetMonster({ label: "heal-npc", hp: 10 });
          try {
            await monster.update({ "system.hp.value": 4 });
            await settle();
            await monster.applyDamage(-3);
            await settle();
            assert.equal(monster.system.hp.value, 7);
          } finally {
            await deleteTestActor(monster);
          }
        });

        it("applies damage multiplier", async function () {
          const monster = await createTargetMonster({ label: "mult-npc", hp: 20 });
          try {
            const before = monster.system.hp.value;
            await monster.applyDamage(4, 2);
            await settle();
            assert.equal(monster.system.hp.value, before - 8);
          } finally {
            await deleteTestActor(monster);
          }
        });

        it("cancels when wwn.preApplyDamage returns false", async function () {
          const monster = await createTargetMonster({ label: "cancel-npc", hp: 15 });
          try {
            const before = monster.system.hp.value;
            const hookId = Hooks.on("wwn.preApplyDamage", () => false);
            try {
              await monster.applyDamage(5);
              await settle();
            } finally {
              Hooks.off("wwn.preApplyDamage", hookId);
            }
            assert.equal(monster.system.hp.value, before);
          } finally {
            await deleteTestActor(monster);
          }
        });

        it("auto-stabilizes at 0 HP when combat.autoStabilize AE is set", async function () {
          const { actor } = await createArmedCharacter({
            label: "stabilize-pc",
            actorSystem: { hp: { value: 3, max: 10 } },
          });
          try {
            await actor.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Quench Die Hard",
                changes: [
                  {
                    key: "system.combat.autoStabilize",
                    mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
                    value: "true",
                    priority: 20,
                    phase: "final",
                  },
                ],
                transfer: false,
                disabled: false,
              },
            ]);
            await settle();
            actor.prepareData();
            assert.isTrue(!!actor.system.combat.autoStabilize);

            await actor.applyDamage(10);
            await settle();
            assert.equal(actor.system.hp.value, 0);
            assert.isTrue(!!actor.getFlag("wwn", "stabilized"));
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Damage apply" },
  );
}
