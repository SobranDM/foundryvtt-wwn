import {
  PIN_D20_HIGH,
  applyChatCardAction,
  createArmedCharacter,
  createTargetMonster,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withFakeTargets,
  withPinnedDice,
  withSetting,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.chat.apply",
    (context) => {
      const { describe, it, assert } = context;

      describe("Chat card apply actions", function () {
        useQuenchTimeout(this);

        it("applyRow changes fake-target HP", async function () {
          const { actor, weapon } = await createArmedCharacter({ label: "chat-apply" });
          const target = await createTargetMonster({ label: "chat-tgt", hp: 20, ac: 5 });
          try {
            const msg = await withSetting("useTrauma", false, () =>
              withFakeTargets([{ actor: target }], () =>
                withPinnedDice(PIN_D20_HIGH, () =>
                  game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
                ),
              ),
            );
            const rows = msg.getFlag("wwn", "applyRows") ?? [];
            const damage = rows.find((r) => r.id === "damage") ?? rows[0];
            assert.exists(damage, "expected an apply row");

            const before = target.system.hp.value;
            await withFakeTargets([{ actor: target }], async () => {
              await applyChatCardAction(msg, { action: "applyRow", rowId: damage.id });
            });
            assert.isBelow(target.system.hp.value, before);
          } finally {
            await deleteTestActor(actor);
            await deleteTestActor(target);
          }
        });

        it("honors multiplier and heal toggle on applyRow", async function () {
          const { actor, weapon } = await createArmedCharacter({ label: "chat-mult" });
          const target = await createTargetMonster({ label: "chat-mult-tgt", hp: 30, ac: 5 });
          try {
            const msg = await withSetting("useTrauma", false, () =>
              withFakeTargets([{ actor: target }], () =>
                withPinnedDice(PIN_D20_HIGH, () =>
                  game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
                ),
              ),
            );
            const rows = msg.getFlag("wwn", "applyRows") ?? [];
            const damage = rows.find((r) => r.id === "damage") ?? rows[0];
            assert.exists(damage);
            const rowValue = Number(damage.value) || 1;

            await target.update({ "system.hp.value": 10 });
            await settle();

            await withFakeTargets([{ actor: target }], async () => {
              await applyChatCardAction(msg, {
                action: "applyRow",
                rowId: damage.id,
                multiplier: 2,
                heal: true,
              });
            });
            // Heal with ×2: HP increases by rowValue * 2
            assert.equal(target.system.hp.value, Math.min(30, 10 + rowValue * 2));
          } finally {
            await deleteTestActor(actor);
            await deleteTestActor(target);
          }
        });

        it("does not change HP when no targets are selected", async function () {
          const { actor, weapon } = await createArmedCharacter({ label: "chat-none" });
          const target = await createTargetMonster({ label: "chat-none-tgt", hp: 20, ac: 5 });
          try {
            const msg = await withSetting("useTrauma", false, () =>
              withFakeTargets([{ actor: target }], () =>
                withPinnedDice(PIN_D20_HIGH, () =>
                  game.wwn.WwnDice.rollAttack(actor, weapon, { skipDialog: true }),
                ),
              ),
            );
            const rows = msg.getFlag("wwn", "applyRows") ?? [];
            const damage = rows.find((r) => r.id === "damage") ?? rows[0];
            assert.exists(damage);

            const before = target.system.hp.value;
            // Empty targets — ChatListener warns and returns
            await withFakeTargets([], async () => {
              await applyChatCardAction(msg, { action: "applyRow", rowId: damage.id });
            });
            assert.equal(target.system.hp.value, before);
          } finally {
            await deleteTestActor(actor);
            await deleteTestActor(target);
          }
        });
      });
    },
    { displayName: "WWN: Chat apply" },
  );
}
