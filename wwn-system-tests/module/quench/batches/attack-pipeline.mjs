import {
  PIN_D20_HIGH,
  PIN_D20_LOW,
  createArmedCharacter,
  createTargetMonster,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withFakeTargets,
  withPinnedDice,
  withSetting,
  wwnImport,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.attack.pipeline",
    (context) => {
      const { describe, it, assert } = context;

      describe("Attack pipeline", function () {
        useQuenchTimeout(this);

        it("records applyRows on a pinned hit", async function () {
          const { actor, weapon } = await createArmedCharacter({ label: "atk-hit" });
          const target = await createTargetMonster({ label: "atk-hit-tgt", hp: 20, ac: 5 });
          try {
            const msg = await withSetting("useTrauma", false, () =>
              withFakeTargets([{ actor: target }], () =>
                withPinnedDice(PIN_D20_HIGH, () =>
                  game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
                ),
              ),
            );
            assert.exists(msg);
            const rows = msg.getFlag("wwn", "applyRows") ?? [];
            assert.isAbove(rows.length, 0);
            assert.exists(rows.find((r) => r.id === "damage"));
          } finally {
            await deleteTestActor(actor);
            await deleteTestActor(target);
          }
        });

        it("applies shock row on a melee miss when shock AC allows", async function () {
          const { actor, weapon } = await createArmedCharacter({
            label: "atk-shock",
            weaponSystem: {
              damage: "1d4",
              shock: { damage: "2", ac: 15 },
              melee: true,
              missile: false,
            },
          });
          const target = await createTargetMonster({ label: "atk-shock-tgt", hp: 20, ac: 12 });
          try {
            const msg = await withFakeTargets([{ actor: target }], () =>
              withPinnedDice(PIN_D20_LOW, () =>
                game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
              ),
            );
            assert.exists(msg);
            const rows = msg.getFlag("wwn", "applyRows") ?? [];
            const shock = rows.find((r) => r.id === "shock");
            assert.exists(shock, "expected shock apply row on miss");
            assert.isAtLeast(Number(shock.value), 1);
          } finally {
            await deleteTestActor(actor);
            await deleteTestActor(target);
          }
        });

        it("blocks primitive weapons via TL gate against immune targets", async function () {
          const { resolveWeaponTlGate } = await wwnImport("/systems/wwn/module/helpers/weapon-tl.mjs");
          const { actor, weapon } = await createArmedCharacter({
            label: "atk-tl",
            weaponSystem: { tl: 2 },
          });
          const target = await createTargetMonster({ label: "atk-tl-tgt", ac: 12 });
          try {
            await target.createEmbeddedDocuments("Item", [
              {
                name: "Quench Powered Plate",
                type: "armor",
                system: {
                  equipped: true,
                  stowed: false,
                  type: "heavy",
                  powered: true,
                  ac: 18,
                  tl: 4,
                  weight: 2,
                },
              },
            ]);
            await settle();
            target.prepareData();
            const gate = resolveWeaponTlGate(actor, target, weapon, "melee");
            assert.isTrue(gate.blocked);

            const msg = await withFakeTargets([{ actor: target }], () =>
              withPinnedDice(PIN_D20_HIGH, () =>
                game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
              ),
            );
            assert.exists(msg);
            const rows = msg.getFlag("wwn", "applyRows") ?? [];
            assert.isUndefined(
              rows.find((r) => r.id === "damage"),
              "TL-blocked attacks should not produce damage rows",
            );
          } finally {
            await deleteTestActor(actor);
            await deleteTestActor(target);
          }
        });

        it("ignores armor pieces for AP-tagged weapons", async function () {
          const { resolveTargetAcForAttack } = await wwnImport(
            "/systems/wwn/module/helpers/attack-ac.mjs",
          );
          const { actor, weapon } = await createArmedCharacter({
            label: "atk-ap",
            weaponSystem: { tags: ["AP"], melee: true, missile: false },
          });
          const target = await createTargetMonster({ label: "atk-ap-tgt", ac: 10 });
          try {
            await target.createEmbeddedDocuments("Item", [
              {
                name: "Quench Plate",
                type: "armor",
                system: {
                  equipped: true,
                  stowed: false,
                  type: "heavy",
                  ac: 16,
                  tl: 0,
                  weight: 2,
                },
              },
            ]);
            await settle();
            target.prepareData();

            await withSetting("separateRangedAC", false, async () => {
              const resolved = resolveTargetAcForAttack(actor, target, weapon, "melee");
              assert.isAbove(resolved.ignored.length, 0);
              assert.equal(resolved.ignored[0].reason, "ap");
            });
          } finally {
            await deleteTestActor(actor);
            await deleteTestActor(target);
          }
        });
      });
    },
    { displayName: "WWN: Attack pipeline" },
  );
}
