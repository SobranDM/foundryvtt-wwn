/**
 * Shared focus automation seeds (bonus skills/dice + easy AEs).
 * Used by migration and pack wiring.
 */

/** @type {Record<string, { skills?: string[], pick?: number, bonusDice?: number, skillBonus?: string }>} */
export const FOCUS_BONUS_SKILL_SEEDS = {
  Alert: { skills: ["notice"], pick: 1 },
  "Ace Driver": { skills: ["drive"], pick: 1 },
  "All Natural": { skills: [], pick: 1 },
  Armsmaster: { skills: ["stab"], pick: 1 },
  Armsman: { skills: ["stab"], pick: 1 },
  Artisan: { skills: ["craft"], pick: 1 },
  Assassin: { skills: ["sneak"], pick: 1 },
  Authority: { skills: ["lead"], pick: 1 },
  "Apex Predator": { skills: ["survive", "shoot"], pick: 2 },
  "Close Combatant": { skills: ["stab", "punch", "shoot"], pick: 1 },
  Connected: { skills: ["connect"], pick: 1 },
  Cultured: { skills: ["connect"], pick: 1 },
  Cyberdoc: { skills: ["fix", "heal"], pick: 2 },
  Deadeye: { skills: ["shoot"], pick: 1 },
  Dealmaker: { skills: ["trade"], pick: 1 },
  Diplomat: { skills: ["talk"], pick: 1 },
  "Diplomatic Grace": { skills: ["convince"], pick: 1 },
  "Drone Pilot": { skills: ["drive"], pick: 1 },
  "Expert Programmer": { skills: ["program"], pick: 1 },
  "Gifted Chirurgeon": { skills: ["heal"], pick: 1, bonusDice: 1, skillBonus: "heal" },
  "Gray Man": { skills: ["sneak"], pick: 1 },
  Gunslinger: { skills: ["shoot"], pick: 1 },
  Hacker: { skills: ["program"], pick: 1, bonusDice: 1, skillBonus: "program" },
  Healer: { skills: ["heal"], pick: 1, bonusDice: 1, skillBonus: "heal" },
  Henchkeeper: { skills: ["lead"], pick: 1 },
  Impostor: { skills: ["perform", "sneak"], pick: 1 },
  "Iron Stomach": { skills: ["survive"], pick: 1 },
  "Many Faces": { skills: ["sneak"], pick: 1 },
  Pathfinder: { skills: ["survive"], pick: 1 },
  Poisoner: { skills: ["heal"], pick: 1 },
  Polymath: { skills: [], pick: 1 },
  "Pop Idol": { skills: ["perform"], pick: 1 },
  "Psychic Training": { skills: [], pick: 1 },
  Rider: { skills: ["ride"], pick: 1 },
  Roamer: { skills: ["survive", "drive"], pick: 2 },
  "Road Warrior": { skills: ["drive"], pick: 1 },
  "Robot Whisperer": { skills: ["fix", "program"], pick: 1 },
  "Safe Haven": { skills: ["sneak"], pick: 1 },
  "Savage Fray": { skills: ["stab"], pick: 1 },
  Scrapsmith: { skills: ["fix"], pick: 1 },
  "Shocking Assault": { skills: ["stab", "punch"], pick: 1 },
  "Skilled Combat Rider": { skills: ["drive", "ride"], pick: 1 },
  Slippery: { skills: ["punch", "exert"], pick: 1 },
  Sniper: { skills: ["shoot"], pick: 1, bonusDice: 1, skillBonus: "shoot" },
  "Sniper's Eye": { skills: ["shoot"], pick: 1, bonusDice: 1, skillBonus: "shoot" },
  "Spark of Brilliance": { skills: [], pick: 1 },
  Specialist: { skills: [], pick: 1, bonusDice: 1, skillBonus: "" },
  "Star Captain": { skills: ["lead"], pick: 1 },
  Starfarer: { skills: ["pilot"], pick: 1 },
  "Strong Back": { skills: ["exert"], pick: 1 },
  Survivalist: { skills: ["survive"], pick: 1 },
  Tinker: { skills: ["fix"], pick: 1 },
  Trapmaster: { skills: ["notice"], pick: 1 },
  "Unarmed Combatant": { skills: ["punch"], pick: 1 },
  "Unnumbered Friends": { skills: ["connect"], pick: 1 },
  "Valiant Defender": { skills: ["stab", "punch"], pick: 1 },
  Wanderer: { skills: ["survive"], pick: 1 },
  "Whirlwind Assault": { skills: ["stab", "punch"], pick: 1 },

  "Origin Focus: Anak, Great": { skills: ["stab", "punch"], pick: 2 },
  "Origin Focus: Anak, Lesser": { skills: ["stab", "sneak"], pick: 2 },
  "Origin Focus: Chattel Blighted": { skills: [], pick: 1 },
  "Origin Focus: Drudge": { skills: ["exert"], pick: 1 },
  "Origin Focus: Dwarf": { skills: ["craft"], pick: 1 },
  "Origin Focus: Dwarf, Gyre": { skills: ["craft"], pick: 1 },
  "Origin Focus: Elf, Civilized": { skills: ["know", "magic"], pick: 2 },
  "Origin Focus: Elf, Forest": { skills: ["shoot", "survive"], pick: 2 },
  "Origin Focus: Elf, Gyre": { skills: [], pick: 1 },
  "Origin Focus: Elf, Half-Elf": { skills: [], pick: 1 },
  "Origin Focus: Functionary Blighted": { skills: [], pick: 1 },
  "Origin Focus: Gnome": { skills: ["sneak"], pick: 1 },
  "Origin Focus: Goblin, Savage": { skills: ["sneak", "survive"], pick: 2 },
  "Origin Focus: Goblin, Tinker": { skills: ["craft"], pick: 1 },
  "Origin Focus: Halfling": { skills: ["sneak"], pick: 1 },
  "Origin Focus: Halfman": { skills: ["survive"], pick: 1 },
  "Origin Focus: Houri": { skills: ["convince", "perform"], pick: 2 },
  "Origin Focus: Laborer Blighted": { skills: ["exert"], pick: 1 },
  "Origin Focus: Lizardman": { skills: ["stab", "survive"], pick: 2 },
  "Origin Focus: Orc": { skills: ["stab", "punch"], pick: 1 },
  "Origin Focus: Warlike Blighted": { skills: ["stab", "punch"], pick: 2 },
};

/**
 * Fill empty bonus-skill / dice fields from the seed table.
 * @param {{ bonusSkills: string[], bonusSkillsPick: number, bonusDice: number|null, skillBonus: string }} system
 * @param {string} focusName
 */
export function applyFocusBonusSkillSeed(system, focusName) {
  const spec = FOCUS_BONUS_SKILL_SEEDS[focusName];
  if (!spec) return;

  if (!system.bonusSkills.length && Array.isArray(spec.skills) && spec.skills.length) {
    system.bonusSkills = [...spec.skills];
  }
  if (!(Number(system.bonusSkillsPick) > 0) && spec.pick != null) {
    system.bonusSkillsPick = spec.pick;
  }
  if ((system.bonusDice == null || system.bonusDice === "") && spec.bonusDice != null) {
    system.bonusDice = spec.bonusDice;
  }
  if (!String(system.skillBonus ?? "").trim() && spec.skillBonus) {
    system.skillBonus = spec.skillBonus;
  }
}

function attr(key, value) {
  return { key: `system.abilities.${key}.baseMod`, type: "add", value, phase: "initial" };
}

/**
 * Seed easy AEs missing from a migrated focus.
 * @param {string} focusName
 * @param {(changes: object[], opts?: object) => void} seed
 */
export function seedFocusAutomationEffects(focusName, seed) {
  const choice = (prefix, pairs) => {
    for (const [key, label, value] of pairs) {
      seed([attr(key, value)], {
        effectName: `${prefix} (${label})`,
        skipFocusLevelSync: true,
        disabled: true,
      });
    }
  };

  switch (focusName) {
    case "Origin Focus: Anak, Great":
      seed([attr("str", 1), attr("con", 1), attr("dex", -1), attr("cha", -1)], {
        effectName: "Anak, Great (Level 1)",
        focusLevel: 1,
      });
      break;
    case "Origin Focus: Anak, Lesser":
      seed([attr("dex", 1), attr("con", -1)], { effectName: "Anak, Lesser (Level 1)", focusLevel: 1 });
      break;
    case "Origin Focus: Drudge":
      seed(
        [
          attr("str", 1),
          attr("con", 1),
          attr("int", -1),
          attr("cha", -1),
          { key: "system.saves.mental.mod", type: "add", value: 2, phase: "initial" },
        ],
        { effectName: "Drudge (Level 1)", focusLevel: 1 },
      );
      break;
    case "Origin Focus: Dwarf":
      seed([attr("con", 1)], { effectName: "Dwarf (Level 1)", focusLevel: 1 });
      choice("Dwarf", [
        ["dex", "Dexterity −1", -1],
        ["cha", "Charisma −1", -1],
      ]);
      break;
    case "Origin Focus: Dwarf, Gyre":
      seed([{ key: "system.hitDice.perLevelMod", type: "add", value: 1, phase: "final" }], {
        effectName: "Dwarf, Gyre (Level 1)",
        focusLevel: 1,
      });
      break;
    case "Origin Focus: Elf, Civilized":
      seed([attr("con", -1)], { effectName: "Elf, Civilized (Level 1)", focusLevel: 1 });
      choice("Elf, Civilized", [
        ["dex", "Dexterity +1", 1],
        ["int", "Intelligence +1", 1],
      ]);
      break;
    case "Origin Focus: Elf, Forest":
      seed([attr("dex", 1), attr("con", -1)], { effectName: "Elf, Forest (Level 1)", focusLevel: 1 });
      break;
    case "Origin Focus: Goblin, Savage":
      seed([attr("dex", 1), attr("int", -1)], { effectName: "Goblin, Savage (Level 1)", focusLevel: 1 });
      break;
    case "Origin Focus: Goblin, Tinker":
      seed([attr("wis", -1)], { effectName: "Goblin, Tinker (Level 1)", focusLevel: 1 });
      choice("Goblin, Tinker", [
        ["dex", "Dexterity +1", 1],
        ["int", "Intelligence +1", 1],
      ]);
      break;
    case "Origin Focus: Halfman":
      seed(
        [attr("con", 1), { key: "system.saves.mental.mod", type: "add", value: 2, phase: "initial" }],
        { effectName: "Halfman (Level 1)", focusLevel: 1 },
      );
      break;
    case "Origin Focus: Houri":
      seed(
        [attr("cha", 1), { key: "system.saves.mental.mod", type: "add", value: 2, phase: "initial" }],
        { effectName: "Houri (Level 1)", focusLevel: 1 },
      );
      break;
    case "Origin Focus: Laborer Blighted":
      seed(
        [
          attr("str", 1),
          attr("con", 1),
          attr("int", -1),
          attr("wis", -1),
          attr("cha", -1),
          { key: "system.saves.mental.mod", type: "add", value: 2, phase: "initial" },
        ],
        { effectName: "Laborer Blighted (Level 1)", focusLevel: 1 },
      );
      break;
    case "Origin Focus: Lizardman":
      seed([{ key: "system.combat.innateAc.min", type: "upgrade", value: 13, phase: "final" }], {
        effectName: "Lizardman (Level 1)",
        focusLevel: 1,
      });
      choice("Lizardman +1", [
        ["str", "Strength +1", 1],
        ["cha", "Charisma +1", 1],
      ]);
      choice("Lizardman −1", [
        ["dex", "Dexterity −1", -1],
        ["cha", "Charisma −1", -1],
      ]);
      break;
    case "Origin Focus: Orc":
      seed([attr("int", -1)], { effectName: "Orc (Level 1)", focusLevel: 1 });
      choice("Orc", [
        ["str", "Strength +1", 1],
        ["con", "Constitution +1", 1],
      ]);
      break;
    case "Origin Focus: Warlike Blighted":
      seed([{ key: "system.combat.allAttack", type: "add", value: 1, phase: "final" }], {
        effectName: "Warlike Blighted (Level 1)",
        focusLevel: 1,
      });
      choice("Warlike Blighted Mental −1", [
        ["int", "Intelligence −1", -1],
        ["wis", "Wisdom −1", -1],
        ["cha", "Charisma −1", -1],
      ]);
      choice("Warlike Blighted Physical +1", [
        ["str", "Strength +1", 1],
        ["dex", "Dexterity +1", 1],
        ["con", "Constitution +1", 1],
      ]);
      break;
    case "Origin Focus: Chattel Blighted":
      seed([{ key: "system.combat.allAttack", type: "add", value: -2, phase: "final" }], {
        effectName: "Chattel Blighted (Level 1)",
        focusLevel: 1,
      });
      choice("Chattel Blighted", [
        ["con", "Constitution +1", 1],
        ["cha", "Charisma +1", 1],
      ]);
      break;
    case "Origin Focus: Penal Blighted":
      seed([{ key: "system.saves.base.mod", type: "add", value: -2, phase: "initial" }], {
        effectName: "Penal Blighted (Level 1)",
        focusLevel: 1,
      });
      choice("Penal Blighted", [
        ["str", "Strength −2", -2],
        ["dex", "Dexterity −2", -2],
        ["con", "Constitution −2", -2],
        ["int", "Intelligence −2", -2],
        ["wis", "Wisdom −2", -2],
        ["cha", "Charisma −2", -2],
      ]);
      break;
    case "Origin Focus: Halfling":
      choice("Halfling", [
        ["con", "Constitution +1", 1],
        ["dex", "Dexterity +1", 1],
      ]);
      break;
    case "Origin Focus: Gnome":
      choice("Gnome", [
        ["str", "Strength −1", -1],
        ["wis", "Wisdom −1", -1],
      ]);
      break;
    case "Origin Focus: Automaton":
      choice("Automaton", [
        ["str", "Strength −1", -1],
        ["dex", "Dexterity −1", -1],
        ["con", "Constitution −1", -1],
        ["int", "Intelligence −1", -1],
        ["wis", "Wisdom −1", -1],
        ["cha", "Charisma −1", -1],
      ]);
      break;
    case "Origin Focus: Undead":
      choice("Undead", [
        ["str", "Strength −1", -1],
        ["dex", "Dexterity −1", -1],
        ["con", "Constitution −1", -1],
        ["int", "Intelligence −1", -1],
        ["wis", "Wisdom −1", -1],
        ["cha", "Charisma −1", -1],
      ]);
      break;
    case "Origin Focus: Functionary Blighted":
      choice("Functionary Blighted", [
        ["str", "Strength −1", -1],
        ["dex", "Dexterity −1", -1],
        ["con", "Constitution −1", -1],
        ["int", "Intelligence −1", -1],
        ["wis", "Wisdom −1", -1],
        ["cha", "Charisma −1", -1],
      ]);
      break;
    case "Xenoblooded":
      seed([attr("str", 1), attr("dex", -1)], {
        effectName: "Xenoblooded (Str +1 / Dex −1)",
        skipFocusLevelSync: true,
        disabled: true,
      });
      seed([attr("dex", 1), attr("str", -1)], {
        effectName: "Xenoblooded (Dex +1 / Str −1)",
        skipFocusLevelSync: true,
        disabled: true,
      });
      break;
    case "Gifted Chirurgeon":
    case "Sniper's Eye":
    case "Specialist":
      // dice/skills only
      break;
    default:
      break;
  }
}
