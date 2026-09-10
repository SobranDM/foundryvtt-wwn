import {
  PIN_D20_HIGH,
  PIN_D20_LOW,
  createTargetMonster,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  withFakeTargets,
  withPinnedDice,
  withSetting,
  wwnImport,
} from "../helpers.mjs";
import {
  createBow,
  createFociTestPc,
  createLightSpear,
  createShockSword,
  createUnarmedAttack,
  embedPackItem,
  hasPartValue,
  setFocusOwnedLevel,
  skipIfNoAbilitiesPack,
} from "../foci-helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.foci.combat",
    (context) => {
      const { describe, it, assert } = context;

      describe("WWN foci combat AEs (pack items)", function () {
        useQuenchTimeout(this, 60000);

        beforeEach(function () {
          skipIfNoAbilitiesPack(this);
        });

        it("enables Armsmaster L1 AE and L2 only after ownedLevel 2", async function () {
          const actor = await createFociTestPc({ label: "arms-lvl" });
          try {
            const focus = await embedPackItem(actor, "Armsmaster");
            const l1 = focus.effects.find((e) => e.name.includes("Level 1"));
            const l2 = focus.effects.find((e) => e.name.includes("Level 2"));
            assert.isFalse(l1.disabled);
            assert.isTrue(l2.disabled);
            await setFocusOwnedLevel(focus, 2);
            assert.isFalse(focus.effects.find((e) => e.name.includes("Level 1")).disabled);
            assert.isFalse(focus.effects.find((e) => e.name.includes("Level 2")).disabled);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Close Combatant 1 suppresses shock on miss and hit floor", async function () {
          const attacker = await createFociTestPc({ label: "cc-atk" });
          const defender = await createFociTestPc({ label: "cc-def" });
          try {
            await embedPackItem(defender, "Close Combatant");
            defender.prepareData();
            assert.isTrue(!!defender.system.combat.immuneToShock);
            const weapon = await createShockSword(attacker);

            const miss = await withFakeTargets([{ actor: defender }], () =>
              withPinnedDice(PIN_D20_LOW, () =>
                game.wwn.WwnDice.rollAttack(attacker, weapon, { skipDialog: true }),
              ),
            );
            const missRows = miss.getFlag("wwn", "applyRows") ?? [];
            assert.isUndefined(missRows.find((r) => r.id === "shock"), "no shock on immune target");

            const hit = await withFakeTargets([{ actor: defender }], () =>
              withPinnedDice(PIN_D20_HIGH, () =>
                game.wwn.WwnDice.rollAttack(attacker, weapon, { skipDialog: true }),
              ),
            );
            const hitRows = hit.getFlag("wwn", "applyRows") ?? [];
            const dmg = hitRows.find((r) => r.id === "damage");
            assert.exists(dmg);
            assert.isNotTrue(dmg.shockFloored);
          } finally {
            await deleteTestActor(attacker);
            await deleteTestActor(defender);
          }
        });

        it("Close Combatant 1 still ignores shock while wearing heavy armor", async function () {
          const attacker = await createFociTestPc({ label: "cc-arm-atk" });
          const defender = await createFociTestPc({ label: "cc-arm-def" });
          try {
            await embedPackItem(defender, "Close Combatant");
            await defender.createEmbeddedDocuments("Item", [
              {
                name: "Quench Plate",
                type: "armor",
                system: { equipped: true, stowed: false, type: "heavy", ac: 16, weight: 2 },
              },
            ]);
            await settle();
            const weapon = await createShockSword(attacker);
            const miss = await withFakeTargets([{ actor: defender }], () =>
              withPinnedDice(PIN_D20_LOW, () =>
                game.wwn.WwnDice.rollAttack(attacker, weapon, { skipDialog: true }),
              ),
            );
            assert.isUndefined((miss.getFlag("wwn", "applyRows") ?? []).find((r) => r.id === "shock"));
          } finally {
            await deleteTestActor(attacker);
            await deleteTestActor(defender);
          }
        });

        it("Close Combatant 2 treats high AC as 10 for shock on miss", async function () {
          const actor = await createFociTestPc({ label: "cc2" });
          try {
            const focus = await embedPackItem(actor, "Close Combatant");
            await setFocusOwnedLevel(focus, 2);
            const weapon = await createShockSword(actor);
            const target = await createTargetMonster({ label: "high-ac", hp: 20, ac: 18 });
            try {
              const check = game.wwn.WwnDice.shockAppliesOnMiss(actor, target, weapon, "melee");
              assert.isTrue(check.applies);
            } finally {
              await deleteTestActor(target);
            }
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Armsmaster adds Stab to melee and thrown, not unarmed", async function () {
          const actor = await createFociTestPc({ label: "arms-1" });
          try {
            await embedPackItem(actor, "Armsmaster");
            actor.prepareData();
            const meleeLabel = game.i18n.localize("WWN.Effects.DamageMelee");
            const shockLabel = game.i18n.localize("WWN.Effects.ShockMelee");
            const sword = await createShockSword(actor);
            const spear = await createLightSpear(actor);
            const punch = await createUnarmedAttack(actor);

            const melee = game.wwn.WwnDice.assembleAttack(actor, sword, { attackKind: "melee" });
            assert.isTrue(hasPartValue(melee.damage, 1));
            assert.isTrue(hasPartValue(melee.shock, 1));
            assert.isTrue(melee.damage.parts.some((p) => p.label === meleeLabel));
            assert.isTrue(melee.shock.parts.some((p) => p.label === shockLabel));

            const thrown = game.wwn.WwnDice.assembleAttack(actor, spear, { attackKind: "ranged" });
            assert.isTrue(hasPartValue(thrown.damage, 1));
            assert.isTrue(hasPartValue(thrown.shock, 1));

            const unarmed = game.wwn.WwnDice.assembleAttack(actor, punch, { attackKind: "melee" });
            assert.isFalse(hasPartValue(unarmed.damage, 1));
            assert.equal(unarmed.shock, null);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Armsmaster omits Stab parts at Stab-0", async function () {
          const actor = await createFociTestPc({ label: "arms-0", skills: { stab: 0, shoot: 1, punch: 1 } });
          try {
            await embedPackItem(actor, "Armsmaster");
            actor.prepareData();
            const sword = await createShockSword(actor);
            const melee = game.wwn.WwnDice.assembleAttack(actor, sword, { attackKind: "melee" });
            const meleeLabel = game.i18n.localize("WWN.Effects.DamageMelee");
            assert.isFalse(melee.damage.parts.some((p) => p.label === meleeLabel));
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Armsmaster 2 adds meleeAttack on melee and thrown", async function () {
          const actor = await createFociTestPc({ label: "arms-2" });
          try {
            const focus = await embedPackItem(actor, "Armsmaster");
            await setFocusOwnedLevel(focus, 2);
            const sword = await createShockSword(actor);
            const spear = await createLightSpear(actor);
            const meleeLabel = game.i18n.localize("WWN.Effects.AttackMelee");
            const melee = game.wwn.WwnDice.assembleAttack(actor, sword, { attackKind: "melee" });
            const thrown = game.wwn.WwnDice.assembleAttack(actor, spear, { attackKind: "ranged" });
            assert.isTrue(melee.attack.parts.some((p) => p.label === meleeLabel && p.value === 1));
            assert.isTrue(thrown.attack.parts.some((p) => p.label === meleeLabel && p.value === 1));
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Deadeye adds Shoot to bows only; spear throw uses Stab not Shoot", async function () {
          const actor = await createFociTestPc({ label: "deadeye" });
          try {
            await embedPackItem(actor, "Deadeye");
            await embedPackItem(actor, "Armsmaster");
            actor.prepareData();
            const bow = await createBow(actor);
            const spear = await createLightSpear(actor);
            const rangedLabel = game.i18n.localize("WWN.Effects.DamageRanged");
            const meleeLabel = game.i18n.localize("WWN.Effects.DamageMelee");

            const shot = game.wwn.WwnDice.assembleAttack(actor, bow, { attackKind: "ranged" });
            assert.isTrue(shot.damage.parts.some((p) => p.label === rangedLabel));

            const thrown = game.wwn.WwnDice.assembleAttack(actor, spear, { attackKind: "ranged" });
            assert.isTrue(thrown.damage.parts.some((p) => p.label === meleeLabel));
            assert.isFalse(thrown.damage.parts.some((p) => p.label === rangedLabel));

            const spearMelee = game.wwn.WwnDice.assembleAttack(actor, spear, { attackKind: "melee" });
            assert.isFalse(spearMelee.damage.parts.some((p) => p.label === rangedLabel));
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Shocking Assault 2 adds +2 melee shock and synthesizes unarmed shock", async function () {
          const actor = await createFociTestPc({ label: "sa2" });
          try {
            const focus = await embedPackItem(actor, "Shocking Assault");
            await setFocusOwnedLevel(focus, 2);
            const sword = await createShockSword(actor);
            const punch = await createUnarmedAttack(actor);
            const shockLabel = game.i18n.localize("WWN.Effects.ShockMelee");
            const melee = game.wwn.WwnDice.assembleAttack(actor, sword, { attackKind: "melee" });
            assert.isTrue(melee.shock.parts.some((p) => p.label === shockLabel && p.value === 2));
            const unarmed = game.wwn.WwnDice.assembleAttack(actor, punch, { attackKind: "melee" });
            assert.exists(unarmed.shock);
            assert.isTrue(hasPartValue(unarmed.shock, 2));
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Shocking Assault shock is still blocked by Close Combatant", async function () {
          const attacker = await createFociTestPc({ label: "sa-atk" });
          const defender = await createFociTestPc({ label: "sa-def" });
          try {
            const sa = await embedPackItem(attacker, "Shocking Assault");
            await setFocusOwnedLevel(sa, 2);
            await embedPackItem(defender, "Close Combatant");
            const weapon = await createShockSword(attacker);
            const miss = await withFakeTargets([{ actor: defender }], () =>
              withPinnedDice(PIN_D20_LOW, () =>
                game.wwn.WwnDice.rollAttack(attacker, weapon, { skipDialog: true }),
              ),
            );
            assert.isUndefined((miss.getFlag("wwn", "applyRows") ?? []).find((r) => r.id === "shock"));
          } finally {
            await deleteTestActor(attacker);
            await deleteTestActor(defender);
          }
        });

        it("Alert 1 sets 2d8kh, group +1, immuneToSurprise; two PCs both have +1", async function () {
          const a = await createFociTestPc({ label: "alert-a" });
          const b = await createFociTestPc({ label: "alert-b" });
          try {
            await embedPackItem(a, "Alert");
            await embedPackItem(b, "Alert");
            a.prepareData();
            b.prepareData();
            assert.equal(a.system.combat.initiative.individual.roll, "2d8kh");
            assert.equal(a.system.combat.initiative.group.mod, 1);
            assert.isTrue(!!a.system.combat.immuneToSurprise);
            assert.equal(b.system.combat.initiative.group.mod, 1);
          } finally {
            await deleteTestActor(a);
            await deleteTestActor(b);
          }
        });

        it("Alert 2 adds +100 individual init and leaves L1 enabled", async function () {
          const actor = await createFociTestPc({ label: "alert-2" });
          try {
            const focus = await embedPackItem(actor, "Alert");
            await setFocusOwnedLevel(focus, 2);
            assert.isFalse(focus.effects.find((e) => e.name.includes("Level 1")).disabled);
            assert.isAtLeast(actor.system.combat.initiative.individual.mod, 100);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Die Hard 1 sets per-level HP mod and auto-stabilizes at 0", async function () {
          const actor = await createFociTestPc({ label: "diehard", level: 3 });
          try {
            await embedPackItem(actor, "Die Hard");
            actor.prepareData();
            assert.equal(actor.system.hitDice.perLevelMod, 2);
            assert.isTrue(!!actor.system.combat.autoStabilize);
            const focus = actor.items.find((i) => i.name === "Die Hard");
            assert.equal(focus.system.internalResource.max, 1);
            assert.equal(focus.system.resourceLength, "day");
            await actor.update({ "system.hp.value": 3, "system.hp.max": 10 });
            await actor.applyDamage(10);
            await settle();
            assert.equal(actor.system.hp.value, 0);
            assert.isTrue(!!actor.getFlag("wwn", "stabilized"));
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Impervious Defense floors unarmored AC and ignores body armor", async function () {
          const { deriveAC } = await wwnImport("/systems/wwn/module/derivations/ac.mjs");
          const actor = await createFociTestPc({ label: "imp", level: 1, skills: {} });
          try {
            await withSetting("separateRangedAC", false, async () => {
              await embedPackItem(actor, "Impervious Defense");
              actor.prepareData();
              deriveAC(actor);
              assert.isAtLeast(actor.system.combat.innateAc.min, 15);
              assert.isAtLeast(actor.system.combat.ac.melee.value, 15);
              const focus = actor.items.find((i) => i.name === "Impervious Defense");
              assert.equal(focus.system.internalResource.max, 1);

              await actor.update({ "system.details.level": 3 });
              await settle();
              actor.prepareData();
              deriveAC(actor);
              assert.isAtLeast(actor.system.combat.innateAc.min, 17);

              await actor.createEmbeddedDocuments("Item", [
                {
                  name: "Quench Mail",
                  type: "armor",
                  system: { equipped: true, stowed: false, type: "medium", ac: 13, weight: 1 },
                },
              ]);
              await settle();
              actor.prepareData();
              deriveAC(actor);
              assert.equal(actor.system.combat.ac.melee.value, 13);
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Polymath raises non-combat skill floor and leaves combat skills at -1", async function () {
          const actor = await createFociTestPc({
            label: "poly",
            skills: { know: -1, stab: -1, shoot: -1, punch: -1 },
          });
          try {
            const focus = await embedPackItem(actor, "Polymath");
            actor.prepareData();
            assert.equal(actor.system.skills.floor, 0);
            const know = actor.items.find((i) => i.name === "Know");
            const stab = actor.items.find((i) => i.name === "Stab");
            assert.equal(game.wwn.WwnDice.effectiveSkillLevel(actor, know), 0);
            assert.equal(game.wwn.WwnDice.effectiveSkillLevel(actor, stab), -1);
            await setFocusOwnedLevel(focus, 2);
            actor.prepareData();
            assert.equal(actor.system.skills.floor, 1);
            assert.equal(game.wwn.WwnDice.effectiveSkillLevel(actor, know), 1);
            assert.equal(game.wwn.WwnDice.effectiveSkillLevel(actor, stab), -1);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Unarmed Combatant L2 sets punchMissDamage 1d6", async function () {
          const actor = await createFociTestPc({ label: "uc" });
          try {
            const focus = await embedPackItem(actor, "Unarmed Combatant");
            actor.prepareData();
            assert.notOk(actor.system.combat.punchMissDamage);
            await setFocusOwnedLevel(focus, 2);
            assert.equal(String(actor.system.combat.punchMissDamage), "1d6");
            const punch = await createUnarmedAttack(actor);
            const target = await createTargetMonster({ label: "uc-tgt", hp: 20, ac: 18 });
            try {
              const msg = await withFakeTargets([{ actor: target }], () =>
                withPinnedDice(PIN_D20_LOW, () =>
                  game.wwn.WwnDice.rollAttack(actor, punch, { skipDialog: true }),
                ),
              );
              const rows = msg.getFlag("wwn", "applyRows") ?? [];
              assert.exists(rows.find((r) => r.id === "miss-damage"), "expected miss-damage apply row");
            } finally {
              await deleteTestActor(target);
            }
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Foci combat AEs" },
  );
}
