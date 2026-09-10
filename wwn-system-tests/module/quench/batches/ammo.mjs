import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withPinnedDice,
  wwnImport,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.ammo",
    (context) => {
      const { describe, it, assert } = context;

      describe("Attack ammo spend", function () {
        useQuenchTimeout(this);

        it("decrements magazine charges on attack", async function () {
          const actor = await createTestActor("character", "ammo-pc", {}, { wwnSkipSeeding: true });
          try {
            const [weapon] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Pistol",
                type: "weapon",
                system: {
                  damage: "1d6",
                  melee: false,
                  missile: true,
                  ammoMode: "magazine",
                  charges: { value: 5, max: 10 },
                  score: "dex",
                },
              },
            ]);
            await settle();
            await withPinnedDice(0.5, () =>
              game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
            );
            const refreshed = actor.items.get(weapon.id);
            assert.equal(refreshed.system.charges.value, 4);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("reloadWeapon restores magazine from linked ammo", async function () {
          const { reloadWeapon } = await wwnImport("/systems/wwn/module/helpers/ammo.mjs");
          const actor = await createTestActor("character", "ammo-reload", {}, { wwnSkipSeeding: true });
          try {
            const [ammo] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Cells",
                type: "ammo",
                system: { quantity: 3 },
              },
            ]);
            const [weapon] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Mag Rifle",
                type: "weapon",
                system: {
                  damage: "1d8",
                  melee: false,
                  missile: true,
                  ammoMode: "magazine",
                  ammoId: ammo.id,
                  charges: { value: 0, max: 10 },
                  score: "dex",
                },
              },
            ]);
            await settle();
            const ok = await reloadWeapon(weapon);
            assert.isTrue(ok);
            assert.equal(actor.items.get(weapon.id).system.charges.value, 10);
            assert.equal(actor.items.get(ammo.id).system.quantity, 2);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("spendAttackAmmo fails when the magazine is empty", async function () {
          const { spendAttackAmmo } = await wwnImport("/systems/wwn/module/helpers/ammo.mjs");
          const actor = await createTestActor("character", "ammo-empty", {}, { wwnSkipSeeding: true });
          try {
            const [weapon] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Empty Mag",
                type: "weapon",
                system: {
                  damage: "1d6",
                  melee: false,
                  missile: true,
                  ammoMode: "magazine",
                  charges: { value: 0, max: 6 },
                  score: "dex",
                },
              },
            ]);
            await settle();
            const ok = await spendAttackAmmo(weapon);
            assert.isFalse(ok);
            assert.equal(actor.items.get(weapon.id).system.charges.value, 0);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("expendOnUse gear decrements quantity via expendGear", async function () {
          const { expendGear } = await wwnImport("/systems/wwn/module/helpers/ammo.mjs");
          const actor = await createTestActor("character", "ammo-expend", {}, { wwnSkipSeeding: true });
          try {
            const [gear] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Potion",
                type: "item",
                system: {
                  quantity: 3,
                  expendOnUse: true,
                  weight: 0,
                },
              },
            ]);
            await settle();
            const ok = await expendGear(gear);
            assert.isTrue(ok);
            assert.equal(actor.items.get(gear.id).system.quantity, 2);
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Ammo" },
  );
}
