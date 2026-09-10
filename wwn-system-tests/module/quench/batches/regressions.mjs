import {
  createTestActor,
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
    "wwn.regressions",
    (context) => {
      const { describe, it, assert } = context;

      describe("Recent bug regressions", function () {
        useQuenchTimeout(this);

        it("attacking a faction target does not throw after ammo spend", async function () {
          const attacker = await createTestActor("character", "reg-atk");
          const faction = await createTestActor("faction", "reg-faction");
          try {
            const [weapon] = await attacker.createEmbeddedDocuments("Item", [
              {
                name: "Quench Spear",
                type: "weapon",
                system: {
                  damage: "1d6",
                  melee: true,
                  ammoMode: "none",
                  score: "str",
                },
              },
            ]);
            await settle();
            await withFakeTargets([{ actor: faction }], async () => {
              const msg = await withPinnedDice(0.5, () =>
                game.wwn.WwnDice.rollAttack(attacker, weapon, { skipDialog: true }),
              );
              assert.exists(msg);
            });
          } finally {
            await deleteTestActor(attacker);
            await deleteTestActor(faction);
          }
        });

        it("Godbound conversion includes parenthetical dice terms", async function () {
          const { WwnDamageRoll } = await wwnImport("/systems/wwn/module/dice/rolls.mjs");
          await withSetting("godboundDamage", true, async () => {
            const roll = await new WwnDamageRoll("(1d6) + 2", {}, { kind: "damage" }).evaluate();
            // Pin is not set; just ensure nested dice contribute (total > flat-only conversion of 2).
            const converted = roll.godboundTotal;
            assert.isAbove(converted.breakdown.length, 0);
            assert.isTrue(
              converted.breakdown.some((line) => line.includes("→")),
              "expected die or flat conversion lines",
            );
            // Flat 2 → 1; any die result ≥2 also converts; total must include nested die walk.
            assert.isAtLeast(converted.total, 1);
          });
        });

        it("focus skill dice bonus stacks on skillDice tier (not hardcoded 2)", async function () {
          const { skillDiceCount } = await wwnImport("/systems/wwn/module/dice/roll-parts.mjs");
          const { getFocusSkillDiceBonus } = await wwnImport(
            "/systems/wwn/module/helpers/focus-skill-dice.mjs",
          );
          const actor = await createTestActor("character", "reg-skilldice");
          try {
            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Specialist",
                type: "focus",
                system: { ownedLevel: 1, skillBonus: "know", bonusDice: 1 },
              },
              {
                name: "Know",
                type: "skill",
                system: { slug: "know", skillDice: "3d6kh2", ownedLevel: 1 },
              },
            ]);
            await settle();
            const { extraDice } = getFocusSkillDiceBonus(actor, "know");
            assert.equal(extraDice, 1);
            assert.equal(skillDiceCount("3d6kh2") + extraDice, 4);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("combat.abMod never leaks a stale persisted value into the derived attack bonus", async function () {
          const actor = await createTestActor("character", "reg-abmod-stale");
          try {
            await actor.update({ "system.combat.abMod": 7 });
            await settle();
            actor.prepareData();
            assert.equal(
              actor._source.system.combat.abMod,
              7,
              "schema field still persists as written"
            );
            assert.equal(
              actor.system.combat.abMod,
              0,
              "prepareBaseData must zero abMod regardless of persisted source"
            );
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("a real AE targeting combat.abMod still applies on top of the zeroed baseline", async function () {
          const actor = await createTestActor("character", "reg-abmod-ae");
          try {
            await settle();
            await actor.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Quench AB +3",
                changes: [
                  {
                    key: "system.combat.abMod",
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    value: "3",
                    priority: 20,
                    phase: "initial",
                  },
                ],
                transfer: false,
                disabled: false,
              },
            ]);
            await settle();
            actor.prepareData();
            assert.equal(actor.system.combat.abMod, 3);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("abilities.*.baseMod never leaks a stale persisted value into the derived ability mod", async function () {
          const actor = await createTestActor("character", "reg-basemod-stale");
          try {
            await actor.update({ "system.abilities.str.value": 10, "system.abilities.str.baseMod": 5 });
            await settle();
            actor.prepareData();
            assert.equal(
              actor._source.system.abilities.str.baseMod,
              5,
              "schema field still persists as written"
            );
            assert.equal(
              actor.system.abilities.str.baseMod,
              0,
              "prepareBaseData must zero baseMod regardless of persisted source"
            );
            assert.equal(
              actor.system.abilities.str.mod,
              0,
              "str 10 -> table mod 0; a leaked +5 would read as 5"
            );
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("migrateActorDocument sweeps a stray persisted combat.abMod into a visible 'Migrated: Attack Bonus' effect, without misfiring on unrelated partial updates", async function () {
          const { migrateActorDocument } = await wwnImport("/systems/wwn/module/migration/migrate.mjs");
          const actor = await createTestActor("character", "reg-abmod-sweep");
          try {
            // Simulate leftover legacy/misfire data sitting in the DB (there is
            // no sanctioned way to write this today; a real GM/AE flow can
            // only ever leave it at 0 -- we're simulating history, not a
            // currently-reachable path).
            await actor.update(
              { "system.combat.abMod": 6 },
              { diff: false, recursive: false, enforceTypes: false },
            );
            await settle();
            assert.equal(actor._source.system.combat.abMod, 6, "stray value persisted as written");

            // An ordinary, unrelated partial update -- exactly the shape that
            // caused the original 2026-07-21..2026-08-15 repeated-migrate
            // misfire bug -- must not disturb the stray value or create an
            // effect outside the explicit migration pass.
            await actor.update({ "system.hp.value": actor.system.hp.value });
            await settle();
            assert.equal(
              actor._source.system.combat.abMod,
              6,
              "an unrelated partial update must not touch the stray residual",
            );
            assert.equal(
              actor.effects.filter((e) => e.name === "Migrated: Attack Bonus").length,
              0,
              "no effect should be created outside the explicit migration pass",
            );

            // The explicit, gated migration pass converts it into a visible,
            // GM-editable effect instead of a raw persisted number.
            await migrateActorDocument(actor);
            await settle();
            assert.equal(actor._source.system.combat.abMod, 0, "persisted abMod must be zeroed by the sweep");
            const effects = actor.effects.filter((e) => e.name === "Migrated: Attack Bonus");
            assert.equal(effects.length, 1, "expected exactly one Migrated: Attack Bonus effect");
            assert.deepEqual(
              effects[0].changes.map((c) => ({ key: c.key, type: c.type, value: c.value })),
              [{ key: "system.combat.abMod", type: "add", value: 6 }],
            );
            actor.prepareData();
            assert.equal(
              actor.system.combat.abMod,
              6,
              "the visible effect must still apply on top of the zeroed baseline",
            );

            // Idempotent: re-running the sweep on an already-clean actor must
            // not duplicate the effect.
            await migrateActorDocument(actor);
            await settle();
            assert.equal(
              actor.effects.filter((e) => e.name === "Migrated: Attack Bonus").length,
              1,
              "re-running the sweep must not duplicate the effect",
            );
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("seeds starter currency synchronously as part of actor creation, with no duplicates", async function () {
          // No wwnSkipSeeding here: this is exactly what the _preCreate
          // seeding fix covers. No settle()/extra wait either -- the fix
          // moved seeding into _preCreate so starter items are part of the
          // atomic Actor.create() payload; if seeding still happened via a
          // later createEmbeddedDocuments call from _onCreate, this
          // snapshot (taken immediately after create() resolves) would be
          // empty.
          const actor = await createTestActor("character", "reg-seed-currency");
          try {
            const currencyItems = actor.items.filter((i) => i.type === "currency");
            assert.isAbove(
              currencyItems.length,
              0,
              "starter currency should exist immediately after create() resolves"
            );
            const names = currencyItems.map((i) => i.name);
            assert.equal(
              new Set(names).size,
              names.length,
              "no duplicate starter currency items (regression for the multi-client seeding race)"
            );
            // The items are merged into the creation payload via updateSource
            // inside _preCreate, which bypasses Item#_preCreate's per-type
            // default-icon fallback -- so #seedNewPcItems must set img itself
            // or every seeded currency item silently falls back to the
            // generic default item icon instead of a coin icon.
            const defaultItemIcon = CONFIG.WWN?.defaultIcons?.item;
            for (const item of currencyItems) {
              assert.exists(item.img, `${item.name} should have an img set`);
              assert.notEqual(
                item.img,
                defaultItemIcon,
                `${item.name} should not fall back to the generic default item icon`
              );
              assert.equal(
                item.img,
                CONFIG.WWN?.defaultIcons?.currency,
                `${item.name} should use the configured currency icon`
              );
            }
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("a charged item with charges.max but no current value shows only in Consumables, not Misc", async function () {
          const actor = await createTestActor("character", "reg-charged-item", {}, { wwnSkipSeeding: true });
          try {
            const [item] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Charge Pack",
                type: "item",
                // value: 0 is the key repro case -- the pre-fix Misc filter
                // only checked charges.value (not charges.max), so an item
                // with max but no current value slipped through and
                // rendered in both Consumables and Misc.
                system: { charges: { value: 0, max: 3 } },
              },
            ]);
            await settle();
            await actor.sheet.render(true);
            try {
              await settle();
              const root = actor.sheet.element;
              const inConsumables = root.querySelector(
                `[data-section-id="inventory.consumables"] [data-item-id="${item.id}"]`
              );
              const inMisc = root.querySelector(
                `[data-section-id="inventory.misc"] [data-item-id="${item.id}"]`
              );
              assert.exists(inConsumables, "charged item should render in Consumables");
              assert.notExists(inMisc, "charged item must not also render in Misc");
            } finally {
              await actor.sheet.close();
            }
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("a charged treasure item renders in Treasure, not Consumables", async function () {
          const actor = await createTestActor("character", "reg-charged-treasure", {}, { wwnSkipSeeding: true });
          try {
            const [item] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Charged Relic",
                type: "item",
                system: { charges: { value: 1, max: 2 }, treasure: true },
              },
            ]);
            await settle();
            await actor.sheet.render(true);
            try {
              await settle();
              const root = actor.sheet.element;
              const inConsumables = root.querySelector(
                `[data-section-id="inventory.consumables"] [data-item-id="${item.id}"]`
              );
              const inTreasure = root.querySelector(
                `[data-section-id="inventory.treasure"] [data-item-id="${item.id}"]`
              );
              assert.notExists(inConsumables, "charged treasure item must not render in Consumables");
              assert.exists(inTreasure, "charged treasure item should still render in Treasure");
            } finally {
              await actor.sheet.close();
            }
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("granting a transfer effect that raises innateAc.min updates AC without a manual prepareData() call", async function () {
          const actor = await createTestActor("character", "reg-refresh-ac", {}, { wwnSkipSeeding: true });
          try {
            await withSetting("separateRangedAC", false, async () => {
              await settle();
              const [item] = await actor.createEmbeddedDocuments("Item", [
                { name: "Quench Innate Item", type: "item" },
              ]);
              await item.createEmbeddedDocuments("ActiveEffect", [
                {
                  name: "Quench Innate AC Grant",
                  transfer: true,
                  disabled: false,
                  changes: [
                    {
                      key: "system.combat.innateAc.min",
                      mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE,
                      value: "15",
                      priority: 20,
                      phase: "initial",
                    },
                  ],
                },
              ]);
              await settle();
              // Deliberately no actor.prepareData() call here: the bug this
              // guards against is that granting a transfer effect on an
              // embedded item could leave cross-field derived data (like
              // innateAc.min-based AC) stale without an explicit refresh --
              // see helpers/actor-refresh.mjs. Calling prepareData() by
              // hand would mask exactly the thing being tested.
              assert.isAtLeast(actor.system.combat.ac.melee.value, 15);
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("a scene-commitment self-cast power's non-transfer effect updates innateAc.min-based AC without a manual prepareData() call", async function () {
          // Companion regression to the transfer-effect case above, for the
          // OTHER path that can set a final-phase field like innateAc.min:
          // a power with effectApplication:"self" and a paid scene/day
          // commitment applies its effects directly to the actor via
          // applyPowerEffectsToActor (transfer: false, effect.parent is the
          // actor itself, not an item) -- the generic createActiveEffect
          // hook in wwn.mjs only refreshes derived data when `effect.transfer`
          // is true, so this path used to go stale until something else
          // happened to trigger a refresh. power-effects.mjs now refreshes
          // explicitly at the applyPowerEffectsToActor/expireScopedPowerEffects
          // call sites themselves.
          const actor = await createTestActor("character", "reg-refresh-self-cast", {}, { wwnSkipSeeding: true });
          try {
            await withSetting("separateRangedAC", false, async () => {
              await actor.createEmbeddedDocuments("Item", [
                {
                  name: "Quench Effort Edge (self-cast AC)",
                  type: "classEdge",
                  system: {
                    edgeType: "class",
                    poolGrant: { name: "Effort", formula: "3", value: 3 },
                    companions: [],
                  },
                },
                {
                  name: "Quench Self-Cast Innate AC Art",
                  type: "power",
                  system: {
                    subType: "art",
                    resourceName: "Effort",
                    commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
                    effectApplication: "self",
                    userStrain: "",
                  },
                },
              ]);
              await settle();
              const power = actor.items.find((i) => i.type === "power");
              await power.createEmbeddedDocuments("ActiveEffect", [
                {
                  name: "Quench Self-Cast Innate AC",
                  transfer: false,
                  disabled: false,
                  changes: [
                    {
                      key: "system.combat.innateAc.min",
                      mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE,
                      value: "15",
                      priority: 20,
                      phase: "initial",
                    },
                  ],
                },
              ]);
              await settle();

              await power.usePower({ skipDialog: true });
              await settle();
              // Deliberately no actor.prepareData() call here -- same
              // reasoning as the transfer-effect test above, but this time
              // the effect that was just created lives directly on the
              // actor (non-transfer), which is the path that was NOT
              // covered by the generic ActiveEffect hooks.
              assert.isAtLeast(
                actor.system.combat.ac.melee.value,
                15,
                "self-cast scene effect's innateAc.min must be reflected in AC immediately",
              );

              await game.wwn.refreshPowers(actor, "scene");
              await settle();
              assert.isBelow(
                actor.system.combat.ac.melee.value,
                15,
                "expiring the scene effect must also refresh AC back down without a manual prepareData() call",
              );
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("two foci granting the same skill do not fight over a single 'who granted this' slot (2026-09 Talk/Stab runaway-rank bug)", async function () {
          // Original incident: Etienne's Talk skill (Diplomat + Specialist
          // both granting "talk") reached rank 8 on a level-2 character, and
          // Decimus's Stab (Warlike Blighted + Armsmaster both granting
          // "stab") reached rank 27 -- both from a per-login resync that used
          // to walk every actor and re-check each focus's "already granted"
          // flag. That flag lived on the *skill* as a single id
          // (flags.wwn.focusBonusFrom); with two foci targeting one skill,
          // each grant overwrote the other's stamp, so the guard never held
          // and both re-granted every single pass, forever. The fix moved
          // "already granted" onto each *granting* focus instead
          // (flags.wwn.bonusSkillsGranted) -- this reproduces the collision
          // shape and asserts repeated passes are pure no-ops.
          const { syncActorFocusBonusSkills } = await wwnImport(
            "/systems/wwn/module/helpers/focus-bonus-skills.mjs",
          );
          const actor = await createTestActor("character", "reg-focus-collision", {}, { wwnSkipSeeding: true });
          try {
            // Level 2 forces the +3 skill-points path (shouldUseFocusBonusPoints),
            // matching the original incident -- rank-mode grants are already
            // self-limiting (untrained -1 -> 0 only) and would mask growth.
            await actor.update({ "system.details.level": 2 });
            await settle();

            const created = await actor.createEmbeddedDocuments(
              "Item",
              [
                {
                  name: "Talk",
                  type: "skill",
                  system: { slug: "talk", ownedLevel: -1, pointsInvested: 0, score: "cha" },
                },
                {
                  // Stands in for "Diplomat": a single declared skill always
                  // resolves without a player choice.
                  name: "Quench Diplomat-alike",
                  type: "focus",
                  system: { ownedLevel: 1, bonusSkills: ["talk"], bonusSkillsPick: 1, bonusSkillsChosen: [] },
                },
                {
                  // Stands in for "Specialist": an already-made open choice.
                  name: "Quench Specialist-alike",
                  type: "focus",
                  system: { ownedLevel: 1, bonusSkills: [], bonusSkillsPick: 1, bonusSkillsChosen: ["talk"] },
                },
              ],
              { wwnMigrating: true },
            );
            const skill = created.find((i) => i.type === "skill");
            const [focusA, focusB] = created.filter((i) => i.type === "focus");

            // First pass: both foci grant once each (a real, one-time grant
            // per source is correct -- WWN intends both to contribute).
            await syncActorFocusBonusSkills(actor);
            await settle();
            const afterFirstPass = actor.items.get(skill.id).system.ownedLevel;
            assert.isAbove(afterFirstPass, -1, "both foci should have granted once");

            // Simulate five more resync passes (what used to happen on every
            // login). None of them may add a single additional point or rank.
            for (let i = 0; i < 5; i++) {
              await syncActorFocusBonusSkills(actor);
              await settle();
            }

            assert.equal(
              actor.items.get(skill.id).system.ownedLevel,
              afterFirstPass,
              "five more sync passes must not add a single additional point/rank",
            );
            assert.deepEqual(
              actor.items.get(focusA.id).getFlag("wwn", "bonusSkillsGranted"),
              ["talk"],
              "each focus tracks its own grant independently -- no shared slot to collide over",
            );
            assert.deepEqual(actor.items.get(focusB.id).getFlag("wwn", "bonusSkillsGranted"), ["talk"]);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("a focus's self-triggered bonusSkillsChosen write does not re-enter its own grant via the updateItem hook", async function () {
          // syncFocusBonusSkills writes its own choice back with
          // `{ wwnBonusSkillSync: true }` specifically so the updateItem
          // hook (which watches system.bonusSkillsChosen) does not re-enter
          // syncFocusBonusSkills concurrently -- Hooks.callAll does not
          // await async listeners, so an unmarked write races the original
          // call's own grant loop and can double-grant. This tests the
          // suppression directly (no dialog needed): the marked write must
          // be a no-op for the hook, while an ordinary, unmarked write to
          // the same field (e.g. a GM editing the choice by hand) must still
          // grant normally.
          const actor = await createTestActor("character", "reg-focus-reentry", {}, { wwnSkipSeeding: true });
          try {
            await actor.update({ "system.details.level": 1 });
            await settle();
            await withSetting("bonusSkillsGrantPointsAtFirstLevel", false, async () => {
              const created = await actor.createEmbeddedDocuments(
                "Item",
                [
                  {
                    name: "Stab",
                    type: "skill",
                    system: { slug: "stab", ownedLevel: -1, pointsInvested: 0, score: "str" },
                  },
                  {
                    name: "Quench Reentry Focus",
                    type: "focus",
                    // Needs a choice: pick=1 of two declared skills, none
                    // chosen yet -- this is the exact shape that reaches the
                    // internal `focus.update({ bonusSkillsChosen }, { wwnBonusSkillSync: true })`
                    // write inside syncFocusBonusSkills's prompt branch.
                    system: {
                      ownedLevel: 1,
                      bonusSkills: ["stab", "punch"],
                      bonusSkillsPick: 1,
                      bonusSkillsChosen: [],
                    },
                  },
                ],
                { wwnMigrating: true },
              );
              const skill = created.find((i) => i.type === "skill");
              const focus = created.find((i) => i.type === "focus");

              // Marked write: mirrors syncFocusBonusSkills's own internal
              // persistence of a resolved choice. The hook must skip it.
              await focus.update({ "system.bonusSkillsChosen": ["stab"] }, { wwnBonusSkillSync: true });
              await settle();
              assert.equal(
                actor.items.get(skill.id).system.ownedLevel,
                -1,
                "a wwnBonusSkillSync-marked write must not trigger a grant via the hook",
              );
              assert.notInclude(
                actor.items.get(focus.id).getFlag("wwn", "bonusSkillsGranted") ?? [],
                "stab",
                "no grant was recorded either -- the suppression is real, not a lucky no-op",
              );

              // Clear back to no choice, then re-choose stab WITHOUT the
              // marker -- an ordinary edit (e.g. a GM changing the choice
              // from the item sheet) on the very same field must still grant
              // normally. Reusing "stab" (rather than introducing "punch")
              // keeps this a clean two-step diff: [] -> ["stab"] is a real,
              // hook-visible change either way.
              await focus.update({ "system.bonusSkillsChosen": [] }, { wwnBonusSkillSync: true });
              await settle();
              await focus.update({ "system.bonusSkillsChosen": ["stab"] });
              await settle();
              assert.equal(
                actor.items.get(skill.id).system.ownedLevel,
                0,
                "an unmarked bonusSkillsChosen write must still grant normally",
              );
              assert.deepEqual(actor.items.get(focus.id).getFlag("wwn", "bonusSkillsGranted"), ["stab"]);
            });
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Regressions" },
  );
}
