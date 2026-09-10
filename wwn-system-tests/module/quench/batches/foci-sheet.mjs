import {
  deleteTestActor,
  settle,
  useQuenchTimeout,
  wwnImport,
  withSetting,
} from "../helpers.mjs";
import {
  createFociTestPc,
  embedPackItem,
  enableItemEffectByName,
  setFocusOwnedLevel,
  skipIfNoAbilitiesPack,
} from "../foci-helpers.mjs";

const DEVELOPED = [
  ["Developed Attribute (Strength)", "str"],
  ["Developed Attribute (Dexterity)", "dex"],
  ["Developed Attribute (Constitution)", "con"],
  ["Developed Attribute (Intelligence)", "int"],
  ["Developed Attribute (Wisdom)", "wis"],
  ["Developed Attribute (Charisma)", "cha"],
];

const SHEET_CASES = [
  { name: "Origin Focus: Anak, Great", mods: { str: 1, con: 1, dex: -1, cha: -1 } },
  { name: "Origin Focus: Anak, Lesser", mods: { dex: 1, con: -1 } },
  { name: "Origin Focus: Drudge", mods: { str: 1, con: 1, int: -1, cha: -1 }, mental: 2 },
  { name: "Origin Focus: Dwarf", enable: ["Dexterity −1"], mods: { con: 1, dex: -1 } },
  { name: "Origin Focus: Dwarf, Gyre", hdPerLevel: 1 },
  { name: "Origin Focus: Elf, Civilized", enable: ["Dexterity +1"], mods: { con: -1, dex: 1 } },
  { name: "Origin Focus: Elf, Forest", mods: { dex: 1, con: -1 } },
  { name: "Origin Focus: Goblin, Savage", mods: { dex: 1, int: -1 } },
  { name: "Origin Focus: Goblin, Tinker", enable: ["Dexterity +1"], mods: { wis: -1, dex: 1 } },
  { name: "Origin Focus: Halfman", mods: { con: 1 }, mental: 2 },
  { name: "Origin Focus: Houri", mods: { cha: 1 }, mental: 2 },
  { name: "Origin Focus: Laborer Blighted", mods: { str: 1, con: 1 } },
  { name: "Origin Focus: Orc", enable: ["Strength +1"], mods: { int: -1, str: 1 } },
  { name: "Origin Focus: Warlike Blighted", enable: ["Intelligence −1", "Strength +1"], allAttack: 1, mods: { int: -1, str: 1 } },
  { name: "Origin Focus: Chattel Blighted", enable: ["Constitution +1"], allAttack: -2, mods: { con: 1 } },
  { name: "Origin Focus: Penal Blighted", enable: ["Strength −2"], mods: { str: -2 }, saveBase: -2 },
];

const CHOICE_ONLY = [
  ["Origin Focus: Automaton", "Strength −1", { str: -1 }],
  ["Origin Focus: Undead", "Wisdom −1", { wis: -1 }],
  ["Origin Focus: Functionary Blighted", "Charisma −1", { cha: -1 }],
  ["Origin Focus: Halfling", "Dexterity +1", { dex: 1 }],
  ["Origin Focus: Gnome", "Wisdom −1", { wis: -1 }],
];

const NO_COMBAT_AE = [
  "Armored Magic",
  "Assassin",
  "Authority",
  "Connected",
  "Cultured",
  "Dealmaker",
  "Diplomatic Grace",
  "Henchkeeper",
  "Impostor",
  "Lucky",
  "Nullifier",
  "Poisoner",
  "Rider",
  "Spirit Familiar",
  "Trapmaster",
  "Unique Gift",
  "Valiant Defender",
  "Well Met",
  "Whirlwind Assault",
  "Artisan",
];

function assertMods(actor, mods, assert, label) {
  for (const [abi, delta] of Object.entries(mods ?? {})) {
    assert.equal(actor.system.abilities[abi].mod, delta, `${label} ${abi} mod`);
  }
}

export default function register(quench) {
  quench.registerBatch(
    "wwn.foci.sheet",
    (context) => {
      const { describe, it, assert } = context;

      describe("WWN foci sheet AEs and grants", function () {
        useQuenchTimeout(this, 120000);

        beforeEach(function () {
          skipIfNoAbilitiesPack(this);
        });

        for (const [name, abi] of DEVELOPED) {
          it(`${name} adds +1 ${abi} mod`, async function () {
            const actor = await createFociTestPc({ label: `dev-${abi}`, skills: {} });
            try {
              await embedPackItem(actor, name);
              actor.prepareData();
              assert.equal(actor.system.abilities[abi].mod, 1);
            } finally {
              await deleteTestActor(actor);
            }
          });
        }

        it("Xenoblooded choice AEs start disabled; enabling one applies Str+1/Dex−1", async function () {
          const actor = await createFociTestPc({ label: "xeno", skills: {} });
          try {
            const focus = await embedPackItem(actor, "Xenoblooded");
            assert.isTrue(focus.effects.every((e) => e.disabled));
            await enableItemEffectByName(focus, "Str +1");
            actor.prepareData();
            assert.equal(actor.system.abilities.str.mod, 1);
            assert.equal(actor.system.abilities.dex.mod, -1);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Elf Gyre L2 choice AE and Half-Elf optional Dex/Con AE", async function () {
          const gyre = await createFociTestPc({ label: "gyre", skills: {} });
          try {
            const focus = await embedPackItem(gyre, "Origin Focus: Elf, Gyre");
            const choices = focus.effects.filter((e) => e.getFlag("wwn", "skipFocusLevelSync"));
            assert.equal(choices.length, 3);
            assert.isTrue(choices.every((e) => e.disabled));
            await setFocusOwnedLevel(focus, 2);
            await enableItemEffectByName(focus, "Intelligence +1");
            gyre.prepareData();
            assert.equal(gyre.system.abilities.int.mod, 1);
          } finally {
            await deleteTestActor(gyre);
          }

          const half = await createFociTestPc({ label: "halfelf", skills: {} });
          try {
            const focus = await embedPackItem(half, "Origin Focus: Elf, Half-Elf");
            const choice = focus.effects.find((e) => e.getFlag("wwn", "skipFocusLevelSync"));
            assert.exists(choice);
            assert.isTrue(choice.disabled);
            await enableItemEffectByName(focus, "Dexterity +1");
            half.prepareData();
            assert.equal(half.system.abilities.dex.mod, 1);
            assert.equal(half.system.abilities.con.mod, -1);
          } finally {
            await deleteTestActor(half);
          }
        });

        it("Lizardman innate AC 13 plus one +1 and one −1 choice", async function () {
          const { deriveAC } = await wwnImport("/systems/wwn/module/derivations/ac.mjs");
          const actor = await createFociTestPc({ label: "lizard", skills: {} });
          try {
            const focus = await embedPackItem(actor, "Origin Focus: Lizardman");
            await enableItemEffectByName(focus, "Strength +1");
            await enableItemEffectByName(focus, "Dexterity −1");
            actor.prepareData();
            deriveAC(actor);
            assert.equal(actor.system.combat.innateAc.min, 12);
            assert.equal(actor.system.combat.ac.mod, 1);
            assert.equal(actor.system.abilities.str.mod, 1);
            assert.equal(actor.system.abilities.dex.mod, -1);
            assert.equal(actor.system.combat.ac.melee.value, 13 + actor.system.abilities.dex.mod);

            await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Mail",
                type: "armor",
                system: { equipped: true, stowed: false, type: "medium", ac: 14, weight: 1 },
              },
            ]);
            await settle();
            actor.prepareData();
            deriveAC(actor);
            assert.equal(
              actor.system.combat.ac.melee.value,
              14 + actor.system.abilities.dex.mod + 1,
              "armored AC includes the +1 AE and Dex, not the innate floor",
            );
          } finally {
            await deleteTestActor(actor);
          }
        });

        for (const spec of SHEET_CASES) {
          it(spec.name, async function () {
            const actor = await createFociTestPc({ label: spec.name.slice(0, 20), skills: {} });
            try {
              const focus = await embedPackItem(actor, spec.name);
              for (const fragment of spec.enable ?? []) {
                await enableItemEffectByName(focus, fragment);
              }
              actor.prepareData();
              assertMods(actor, spec.mods, assert, spec.name);
              if (spec.mental != null) {
                assert.equal(actor.system.saves.mental.mod, spec.mental, `${spec.name} mental`);
              }
              if (spec.hdPerLevel != null) {
                assert.equal(actor.system.hitDice.perLevelMod, spec.hdPerLevel);
              }
              if (spec.allAttack != null) {
                assert.equal(actor.system.combat.allAttack, spec.allAttack);
              }
              if (spec.saveBase != null) {
                assert.equal(actor.system.saves.base.mod, spec.saveBase);
              }
            } finally {
              await deleteTestActor(actor);
            }
          });
        }

        for (const [name, enable, mods] of CHOICE_ONLY) {
          it(`${name} choice AEs start disabled`, async function () {
            const actor = await createFociTestPc({ label: name.slice(0, 18), skills: {} });
            try {
              const focus = await embedPackItem(actor, name);
              const choices = focus.effects.filter((e) => e.getFlag("wwn", "skipFocusLevelSync"));
              assert.isAtLeast(choices.length, 1);
              assert.isTrue(choices.every((e) => e.disabled));
              await enableItemEffectByName(focus, enable);
              actor.prepareData();
              assertMods(actor, mods, assert, name);
            } finally {
              await deleteTestActor(actor);
            }
          });
        }

        it("grants Stab from Armsmaster and always-Notice from Elf Gyre", async function () {
          const { syncFocusBonusSkills, findSkillBySlug } = await wwnImport(
            "/systems/wwn/module/helpers/focus-bonus-skills.mjs",
          );
          const actor = await createFociTestPc({ label: "grants", skills: { stab: -1, notice: -1 } });
          try {
            await withSetting("bonusSkillsGrantPointsAtFirstLevel", false, async () => {
              const arms = await embedPackItem(actor, "Armsmaster");
              await arms.update({ "system.bonusSkillsChosen": ["stab"] });
              await syncFocusBonusSkills(arms, actor, { prompt: false });
              assert.equal(findSkillBySlug(actor, "stab").system.ownedLevel, 0);

              const gyre = await embedPackItem(actor, "Origin Focus: Elf, Gyre");
              await syncFocusBonusSkills(gyre, actor, { prompt: false });
              assert.equal(findSkillBySlug(actor, "notice").system.ownedLevel, 0);
            });
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Gifted Chirurgeon and Sniper's Eye extra skill dice; Specialist skillBonus empty", async function () {
          const { getFocusSkillDiceBonus } = await wwnImport(
            "/systems/wwn/module/helpers/focus-skill-dice.mjs",
          );
          const actor = await createFociTestPc({ label: "dice", skills: { heal: 0, shoot: 0 } });
          try {
            await embedPackItem(actor, "Gifted Chirurgeon");
            await embedPackItem(actor, "Sniper's Eye");
            const specialist = await embedPackItem(actor, "Specialist");
            assert.equal(getFocusSkillDiceBonus(actor, "heal").extraDice, 1);
            assert.equal(getFocusSkillDiceBonus(actor, "shoot").extraDice, 1);
            assert.equal(String(specialist.system.skillBonus ?? "").trim(), "");
            assert.equal(specialist.system.bonusDice, 1);
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("Wave 4 foci do not transfer combat AEs", async function () {
          const actor = await createFociTestPc({ label: "no-combat", skills: {} });
          try {
            for (const name of NO_COMBAT_AE) {
              const item = await embedPackItem(actor, name);
              actor.prepareData();
              assert.isFalse(!!actor.system.combat.immuneToShock, name);
              assert.isFalse(!!actor.system.combat.treatAllMeleeAsAcTen, name);
              assert.equal(actor.system.combat.meleeDamage, 0, name);
              assert.equal(actor.system.combat.rangeDamage, 0, name);
              assert.equal(actor.system.combat.meleeShock, 0, name);
              assert.equal(actor.system.combat.punchMissDamage || 0, 0, name);
              await item.delete();
              await settle();
            }
          } finally {
            await deleteTestActor(actor);
          }
        });
      });
    },
    { displayName: "WWN: Foci sheet AEs" },
  );
}
