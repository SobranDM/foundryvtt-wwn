/**
 * Generate SWN classes and AWN/CWN Edges (+ companion powers) into Abilities packs.
 *
 * Run: node ./build/generate-cross-line-class-edges.mjs
 *
 * Preserves existing classEdge/companion `_id`s by name within each pack.
 * Deletes only classEdge items and Edge/Class Features powers it manages;
 * leaves Skills, Foci, Mutations, Psychic Techniques untouched.
 */
import fs from "node:fs";
import path from "node:path";
import {
  makeFolder,
  writeSourceDoc,
  buildFoldersById,
  readSourceDocs,
  randomId,
  isFolderDoc,
} from "./pack-folder-paths.mjs";

const CLASS_IMG = "systems/wwn/assets/icons/items/class-ability.png";
const ABILITY_IMG = "systems/wwn/assets/icons/items/ability.png";

const PSYCHIC_SKILLS = [
  "biopsionics",
  "metapsionics",
  "precognition",
  "telekinesis",
  "telepathy",
  "teleportation",
];
const COMBAT_SKILLS = ["stab", "punch", "shoot"];
const PSYCHIC_EFFORT = "max(1, 1 + @highestPsychic + max(@wis, @con))";

/** @param {string} key @param {string} type @param {string|number|boolean} value @param {string} phase */
function ch(key, type, value, phase) {
  return { key, type, value: String(value), phase };
}

/**
 * @param {string} parentId
 * @param {string} effectId
 * @param {string} name
 * @param {object[]} changes
 */
function makeEffect(parentId, effectId, name, changes) {
  return {
    _id: effectId,
    type: "base",
    name,
    img: "icons/svg/aura.svg",
    transfer: true,
    disabled: false,
    statuses: [],
    flags: {},
    system: { changes },
    _key: `!items.effects!${parentId}.${effectId}`,
  };
}

/** @param {...string} paras */
function desc(...paras) {
  return paras.filter(Boolean).map((p) => `<p>${p}</p>`).join("");
}

function emptyGrants() {
  return {
    poolGrant: { name: "", formula: "", value: 0, progression: [] },
    slotGrant: { enabled: false, value: 0, progression: [], leveledProgression: [] },
    preparedGrant: { progression: [] },
  };
}

/**
 * @param {string} name
 * @param {object} opts
 */
function classEdge(name, opts = {}) {
  return {
    kind: "classEdge",
    name,
    description: opts.description ?? "",
    edgeType: opts.edgeType ?? "class",
    attackProgression: opts.attackProgression ?? "none",
    skillPointsPerLevel: opts.skillPointsPerLevel ?? 3,
    hdGrant: opts.hdGrant ?? { die: "", perLevelMod: 0 },
    bonusSkills: opts.bonusSkills ?? [],
    bonusSkillsPick: opts.bonusSkillsPick ?? 0,
    bonusSkillsMode: opts.bonusSkillsMode ?? "",
    attributeGrant: opts.attributeGrant ?? { mode: "", exclude: [], chosen: "" },
    companions: opts.companions ?? [],
    poolGrant: opts.poolGrant ?? emptyGrants().poolGrant,
    effects: opts.effects ?? [],
    folderPath: opts.folderPath ?? [],
  };
}

/**
 * @param {string} name
 * @param {object} opts
 */
function featurePower(name, opts = {}) {
  return {
    kind: "power",
    name,
    description: opts.description ?? "",
    internalResource: opts.internalResource ?? { value: 1, max: 1 },
    internalResourceLength: opts.internalResourceLength ?? "scene",
    folderPath: opts.folderPath ?? ["Class Features"],
  };
}

// ---------------------------------------------------------------------------
// SWN
// ---------------------------------------------------------------------------

const swnItems = [
  classEdge("Full Expert", {
    folderPath: ["Classes", "Full"],
    edgeType: "class",
    attackProgression: "expert",
    skillPointsPerLevel: 4,
    hdGrant: { die: "d6", perLevelMod: 0 },
    companions: ["Expert Skill Reroll"],
    description: desc(
      "Your hero is exceptionally good at a useful skill. Doctors, cat burglars, starship pilots, grifters, technicians, or any other concept that focuses on expertise in a non-combat skill should pick the Expert class. Experts are the best at such skills and gain more of them than other classes do.",
      "Just as a Warrior can be relied upon to make a shot when the chips are down, an Expert has a knack for succeeding at the moments of greatest importance. Once per scene, an Expert can reroll a failed skill check, taking the new result if it&rsquo;s better. This benefit can be applied to any skill check, even those that the Expert isn&rsquo;t specially focused in.",
      "Aside from the free focus level that all PCs get at the start of the game, an Expert can choose an additional level in a non-combat focus related to their background. When you advance an experience level, you gain a bonus skill point that can be spent on any non-combat, non-psychic skill.",
      "Hit points are 1d6 per level plus Constitution modifier. Attack bonus is half level, rounded down.",
    ),
  }),
  classEdge("Full Psychic", {
    folderPath: ["Classes", "Full"],
    edgeType: "class",
    attackProgression: "expert",
    skillPointsPerLevel: 3,
    hdGrant: { die: "d6", perLevelMod: 0 },
    bonusSkills: [...PSYCHIC_SKILLS],
    bonusSkillsPick: 2,
    poolGrant: {
      name: "Psychic Effort",
      formula: PSYCHIC_EFFORT,
      value: 0,
      progression: [],
    },
    description: desc(
      "Your hero has received training in controlling their natural Metadimensional Extroversion Syndrome, and can wield the psychic powers that come from that strange affliction. Psychics are capable of learning psychic disciplines and their associated techniques.",
      "When you pick this class, choose any two psychic skills as bonus skills. You can pick the same one twice to obtain level-1 proficiency in it and a free level-1 technique from that discipline.",
      "You have an Effort score used to fuel psychic abilities. Maximum Effort equals 1 plus your highest psychic skill plus the better of your Wisdom or Constitution modifiers, to a minimum of 1.",
      "Hit points are 1d6 per level plus Constitution modifier. Attack bonus is half level, rounded down.",
    ),
  }),
  classEdge("Full Warrior", {
    folderPath: ["Classes", "Full"],
    edgeType: "class",
    attackProgression: "warrior",
    skillPointsPerLevel: 3,
    hdGrant: { die: "d6", perLevelMod: 2 },
    companions: ["Veteran's Luck"],
    description: desc(
      "Whether a hiveworld thug, barbarian lostworlder, gengineered combat hominid, or a natural-born killer, your hero has a real talent for inflicting mayhem. Warriors gain a free level in a combat-related focus associated with their background.",
      "Warriors are lucky in combat. Once per scene, as an Instant ability, you can either negate a successful attack roll against you or turn a missed attack roll you made into a successful hit. You gain two extra maximum hit points at each character level.",
      "Unlike Worlds Without Number Warriors, Stars Without Number Warriors do not receive Killing Blow.",
      "Hit points are 1d6+2 per level plus Constitution modifier. Attack bonus equals character level.",
    ),
  }),
  classEdge("Partial Expert", {
    folderPath: ["Classes", "Partial"],
    edgeType: "class",
    attackProgression: "none",
    skillPointsPerLevel: 4,
    hdGrant: { die: "d6", perLevelMod: 0 },
    description: desc(
      "As part of an Adventurer, you gain a free level in a non-combat focus related to your background. Gain an extra skill point every time you gain a character level which can be spent on any non-psychic, non-combat skill. Partial Experts do not receive the once-per-scene skill reroll.",
      "Pair with another Partial class via Adventurer. Base Adventurer attack bonus is half level unless Partial Warrior is also taken.",
    ),
  }),
  classEdge("Partial Psychic", {
    folderPath: ["Classes", "Partial"],
    edgeType: "class",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    hdGrant: { die: "d6", perLevelMod: 0 },
    bonusSkills: [...PSYCHIC_SKILLS],
    bonusSkillsPick: 1,
    poolGrant: {
      name: "Psychic Effort",
      formula: PSYCHIC_EFFORT,
      value: 0,
      progression: [],
    },
    description: desc(
      "You are a restricted psychic. Pick one psychic discipline as a bonus skill at level-0. You can improve this skill with foci or skill points, but you cannot learn or improve any other psychic skill. Maximum Effort equals 1 plus this psychic skill&rsquo;s level plus the best of Wisdom or Constitution, minimum 1.",
      "Pair with another Partial class via Adventurer.",
    ),
  }),
  classEdge("Partial Warrior", {
    folderPath: ["Classes", "Partial"],
    edgeType: "class",
    attackProgression: "partialWarrior",
    skillPointsPerLevel: 3,
    hdGrant: { die: "d6", perLevelMod: 2 },
    description: desc(
      "You gain a free level in a combat focus related to your background. Gain +1 to your attack bonus at first and fifth levels (encoded as Partial Warrior progression). Gain 2 extra maximum hit points each level.",
      "Pair with another Partial class via Adventurer.",
    ),
  }),
  featurePower("Expert Skill Reroll", {
    folderPath: ["Classes", "Class Features"],
    description: desc(
      "Once per scene, as an Instant action, reroll a failed skill check of any kind. Take the new result if it is better.",
    ),
  }),
  featurePower("Veteran's Luck", {
    folderPath: ["Classes", "Class Features"],
    description: desc(
      "Once per scene, as an Instant action, turn a missed attack you made into a hit, or a hit against you into a miss. Cannot be used against environmental damage or hits on a vehicle you occupy.",
    ),
  }),
];

// ---------------------------------------------------------------------------
// Shared Edge helpers
// ---------------------------------------------------------------------------

function killingBlowEffects(seed) {
  return (parentId) => [
    makeEffect(parentId, randomId(`${seed}-kb`), "Killing Blow", [
      ch("system.combat.allDamage", "add", "@halfLevel", "final"),
      ch("system.combat.allShock", "add", "@halfLevel", "final"),
      ch("system.trauma.dieMod", "add", 1, "initial"),
    ]),
  ];
}

function hardToKillEffects(seed) {
  return (parentId) => [
    makeEffect(parentId, randomId(`${seed}-htk`), "Hard To Kill", [
      ch("system.trauma.targetMod", "add", 1, "initial"),
    ]),
  ];
}

function onTargetEdge(folderPath, line) {
  return classEdge("On Target", {
    folderPath,
    edgeType: "edge",
    attackProgression: "warrior",
    skillPointsPerLevel: 3,
    bonusSkills: [...COMBAT_SKILLS],
    bonusSkillsPick: 1,
    description: desc(
      "Gain a combat skill as a bonus skill. Your basic attack bonus is equal to your character level, instead of the usual half level, rounded down.",
      line === "cwn"
        ? "Operators without this Edge use half-level attack bonus."
        : "Survivors without this Edge use half-level attack bonus.",
    ),
  });
}

function hardToKillEdge(folderPath, line) {
  return classEdge("Hard To Kill", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    hdGrant: { die: "d6", perLevelMod: 2 },
    effects: hardToKillEffects(`htk-${line}`),
    description: desc(
      "Instead of rolling 1d6 per level for your hit points, you roll 1d6+2. If using Traumatic Hit rules, your base Trauma Target increases by +1 (from 6 to 7).",
    ),
  });
}

function killingBlowEdge(folderPath, line) {
  return classEdge("Killing Blow", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    bonusSkills: [...COMBAT_SKILLS],
    bonusSkillsPick: 1,
    effects: killingBlowEffects(`kb-${line}`),
    description: desc(
      "Gain a combat skill as a bonus skill. Whenever you inflict hit point damage, whether by weapon, special ability, or any other source, the damage is increased by 1 point per two character levels, rounded up. If using Traumatic Hit rules, any Trauma Die you roll gains a +1 bonus.",
    ),
  });
}

function educatedEdge(folderPath) {
  return classEdge("Educated", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 4,
    bonusSkills: [],
    bonusSkillsPick: 1,
    bonusSkillsMode: "any",
    description: desc(
      "You may pick a bonus skill of your choice. Whenever you gain skill points from character level advancement, you get a bonus skill point.",
    ),
  });
}

function focusedEdge(folderPath) {
  return classEdge("Focused", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    description: desc(
      "You begin play with an extra Focus pick. You may choose this Edge more than once. Add the extra Focus manually from the Abilities pack.",
    ),
  });
}

function prodigyEdge(folderPath) {
  return classEdge("Prodigy", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    attributeGrant: { mode: "prodigy", exclude: ["con"], chosen: "" },
    description: desc(
      "Pick an attribute other than Constitution; its score becomes 18 and it grants a +3 modifier instead of +2. Characters benefiting from the Underdog Rule can&rsquo;t take this Edge.",
    ),
  });
}

function ghostEdge(folderPath) {
  return classEdge("Ghost", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    bonusSkills: ["sneak"],
    bonusSkillsPick: 1,
    companions: ["Ghost Scene Reroll", "Ghost Unseen Move"],
    description: desc(
      "You are uncannily elusive. Gain Sneak as a bonus skill and the Fighting Withdrawal combat action is an On Turn action for you. Once per scene, reroll a failed Sneak check related to sneaking or going unseen. Once per game day, as a Move action, move up to 10 meters without anyone around you seeing you move.",
    ),
  });
}

function masterfulExpertiseEdge(folderPath) {
  return classEdge("Masterful Expertise", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    companions: ["Masterful Expertise"],
    description: desc(
      "Once per scene, as an Instant action, reroll a failed check for a non-combat skill.",
    ),
  });
}

function veteransLuckEdge(folderPath) {
  return classEdge("Veteran's Luck", {
    folderPath,
    edgeType: "edge",
    attackProgression: "none",
    skillPointsPerLevel: 3,
    companions: ["Veteran's Luck"],
    description: desc(
      "Once per scene, as an Instant action, trigger this ability to gain one of two effects: an attack roll that just hit you is instead treated as a miss, or an attack roll you just made that missed is instead treated as a hit. This ability can be applied to vehicle weapons you use, but it cannot protect against environmental damage, vehicle crashes, falls, or other harm that doesn&rsquo;t involve an attack roll.",
    ),
  });
}

function sharedFeaturePowers(folderPath) {
  return [
    featurePower("Masterful Expertise", {
      folderPath,
      description: desc(
        "Once per scene, as an Instant action, reroll a failed non-combat skill check.",
      ),
    }),
    featurePower("Veteran's Luck", {
      folderPath,
      description: desc(
        "Once per scene, as an Instant action, turn a missed attack you made into a hit, or a hit against you into a miss.",
      ),
    }),
    featurePower("Ghost Scene Reroll", {
      folderPath,
      description: desc(
        "Once per scene, reroll a failed Sneak check related to sneaking or going unseen.",
      ),
    }),
    featurePower("Ghost Unseen Move", {
      folderPath,
      internalResourceLength: "day",
      description: desc(
        "Once per game day, as a Move action, move up to 10 meters without anyone around you seeing you move. If you use this movement to get behind cover, you might seem to vanish outright to onlookers.",
      ),
    }),
  ];
}

// ---------------------------------------------------------------------------
// AWN
// ---------------------------------------------------------------------------

const awnUniversal = ["Edges", "Universal"];
const awnMutant = ["Edges", "Mutant Wasteland"];
const awnDeadlands = ["Edges", "Deadlands"];
const awnFall = ["Edges", "After the Fall"];
const awnFeatures = ["Edges", "Edge Features"];

const awnItems = [
  classEdge("Beacon of Hope", {
    folderPath: awnUniversal,
    edgeType: "edge",
    bonusSkills: ["lead"],
    bonusSkillsPick: 1,
    companions: ["Beacon of Hope"],
    effects: (parentId) => [
      makeEffect(parentId, randomId("awn-boh-cha"), "Beacon of Hope", [
        ch("system.abilities.cha.mod", "add", 1, "final"),
      ]),
    ],
    description: desc(
      "Something about you inspires others, convincing them that a better future can exist. Gain Lead as a bonus skill and +1 bonus to your Charisma attribute modifier, up to a +2 maximum. Your personal followers gain a +1 to their Morale score. Once per game session, tell an NPC something that speaks to their hopes; they will believe you unless it&rsquo;s physically impossible, proven false, or would put them in unacceptable personal danger.",
    ),
  }),
  classEdge("Comrade", {
    folderPath: awnUniversal,
    edgeType: "edge",
    companions: ["Comrade Ally Reroll"],
    description: desc(
      "You are a pillar of your group, a source of strength and encouragement. Once per day per PC ally or good NPC friend, as an Instant action, allow them to reroll a roll they just made of any kind. Your or another&rsquo;s Comrade Edge can&rsquo;t help you, however.",
    ),
  }),
  educatedEdge(awnUniversal),
  focusedEdge(awnUniversal),
  ghostEdge(awnUniversal),
  hardToKillEdge(awnUniversal, "awn"),
  killingBlowEdge(awnUniversal, "awn"),
  masterfulExpertiseEdge(awnUniversal),
  onTargetEdge(awnUniversal, "awn"),
  prodigyEdge(awnUniversal),
  classEdge("Survivor's Fortune", {
    folderPath: awnUniversal,
    edgeType: "edge",
    companions: ["Survivor's Fortune"],
    description: desc(
      "Once per game session as an Instant action, when something bad happens to you such as an injury, a failed save, or a botched skill check, test your luck and roll 1d6. On a 1, the bad event is unaffected. On a 2&ndash;5, you somehow avert the consequences by blind chance. On a 6, it actually lands on an enemy or rival of the GM&rsquo;s choice, if that&rsquo;s possible. Only events that happened in this same round can be averted.",
    ),
  }),
  veteransLuckEdge(awnUniversal),
  classEdge("Hardened Genetics", {
    folderPath: awnMutant,
    edgeType: "edge",
    attributeGrant: { mode: "modPlus1Cap2", exclude: [], chosen: "" },
    description: desc(
      "You cannot be mutated by radiation or other mutagenics and gain a +4 bonus on radiation saving throws. You cannot choose or gain the Mutant Edge. Pick an attribute of your choice; its modifier increases by +1, to a maximum of +2.",
    ),
  }),
  classEdge("Mutant", {
    folderPath: awnMutant,
    edgeType: "edge",
    attributeGrant: { mode: "modMinus1", exclude: [], chosen: "" },
    description: desc(
      "You gain 2 mutation points to spend as described in the Mutations section after you pick your Edges. If a negative mutation spoils an Edge, you may pick a different Edge. After you&rsquo;ve spent the points, pick one attribute of your choice that has a modifier of &minus;1 or better; it suffers a &minus;1 penalty to its attribute modifier.",
    ),
  }),
  classEdge("Mutation Acceleration", {
    folderPath: awnMutant,
    edgeType: "edge",
    description: desc(
      "You must have the Mutant Edge to pick or acquire this Edge. You gain 2 additional mutation points to spend.",
    ),
  }),
  classEdge("Systemic Immunity", {
    folderPath: awnDeadlands,
    edgeType: "edge",
    companions: [],
    effects: (parentId) => [
      makeEffect(parentId, randomId("awn-si-con"), "Systemic Immunity", [
        ch("system.abilities.con.mod", "add", 1, "final"),
      ]),
    ],
    description: desc(
      "You gain both levels of the Natural Immunity Focus and are immune to zombie infection or the other major pathogenic threat of the campaign. Your Constitution modifier increases by +1, to a maximum of +2.",
    ),
  }),
  // companions via CLASS_EDGE_COMPANIONS map for Systemic Immunity
  classEdge("They're Here", {
    folderPath: awnDeadlands,
    edgeType: "edge",
    bonusSkills: ["notice"],
    bonusSkillsPick: 1,
    effects: (parentId) => [
      makeEffect(parentId, randomId("awn-th-wis"), "They're Here", [
        ch("system.abilities.wis.mod", "add", 1, "final"),
        ch("system.combat.immuneToSurprise", "override", "true", "initial"),
      ]),
    ],
    description: desc(
      "You have an intuitive danger sense that alerts you before a zombie attack or impending catastrophe. Gain Notice as a bonus skill and a +1 bonus to your Wisdom modifier, to a maximum of +2. You cannot be surprised, and you have an instinctive sense of whether or not there are zombies, raiders, or other enemies in your general surroundings.",
    ),
  }),
  classEdge("Cold Blood", {
    folderPath: awnFall,
    edgeType: "edge",
    description: desc(
      "You&rsquo;ve acclimated to the horror of your new existence. You no longer gain Stress as described in the rules. If this Edge is taken after first level, you lose any psychic scars you may have developed. This Edge isn&rsquo;t relevant in campaigns that don&rsquo;t use the Stress rules.",
    ),
  }),
  classEdge("Faceless", {
    folderPath: awnFall,
    edgeType: "edge",
    companions: [],
    effects: (parentId) => [
      makeEffect(parentId, randomId("awn-faceless-cha"), "Faceless", [
        ch("system.abilities.cha.mod", "override", 0, "final"),
      ]),
    ],
    description: desc(
      "You appear to be a totally unremarkable, nonthreatening non-entity amid the general chaos. Your Charisma modifier becomes +0 regardless of attribute scores or adjustments. You gain both levels of the Gray Man Focus, and once per day can reroll a failed Sneak check as an Instant action.",
    ),
  }),
  classEdge("Forged By Fire", {
    folderPath: awnFall,
    edgeType: "edge",
    description: desc(
      "This Edge can only be taken during character creation by a PC meant to start as a perfectly ordinary member of their society. You don&rsquo;t get beginning Edges; instead, when you reach 2nd, 3rd, and 4th level you can pick an Edge. You still gain the bonus Edge at level five, for four Edges in total, and you start play with the same free Focus all PCs receive.",
    ),
  }),
  ...sharedFeaturePowers(awnFeatures),
  featurePower("Beacon of Hope", {
    folderPath: awnFeatures,
    internalResourceLength: "day",
    description: desc(
      "Once per game session, tell an NPC something that speaks to their hopes; they will believe you unless it&rsquo;s physically impossible, proven false, or would put them in unacceptable personal danger. (Tracked as a day use for sheet refresh.)",
    ),
  }),
  featurePower("Comrade Ally Reroll", {
    folderPath: awnFeatures,
    internalResourceLength: "day",
    internalResource: { value: 4, max: 4 },
    description: desc(
      "Once per day per PC ally or good NPC friend, as an Instant action, allow them to reroll a roll they just made of any kind. Cannot be used on yourself.",
    ),
  }),
  featurePower("Survivor's Fortune", {
    folderPath: awnFeatures,
    internalResourceLength: "day",
    description: desc(
      "Once per game session as an Instant action, when something bad happens to you, roll 1d6: 1 unaffected, 2&ndash;5 avert by chance, 6 redirects to an enemy if possible. (Tracked as a day use for sheet refresh.)",
    ),
  }),
  featurePower("Faceless Sneak Reroll", {
    folderPath: awnFeatures,
    internalResourceLength: "day",
    description: desc(
      "Once per day, as an Instant action, reroll a failed Sneak check.",
    ),
  }),
];

// Wire Systemic Immunity / Faceless companions via system.companions on those edges
for (const item of awnItems) {
  if (item.name === "Systemic Immunity") {
    item.companions = ["Natural Immunity"];
    // ownedLevel 2 via CLASS_EDGE_COMPANIONS map — also set flag for generator note
  }
  if (item.name === "Faceless") {
    item.companions = ["Gray Man", "Faceless Sneak Reroll"];
  }
}

// ---------------------------------------------------------------------------
// CWN
// ---------------------------------------------------------------------------

const cwnEdges = ["Edges"];
const cwnFeatures = ["Edges", "Edge Features"];

const cwnItems = [
  educatedEdge(cwnEdges),
  classEdge("Face", {
    folderPath: cwnEdges,
    edgeType: "edge",
    bonusSkills: ["connect"],
    bonusSkillsPick: 1,
    companions: ["Face Temporary Contact"],
    description: desc(
      "Gain Connect as a bonus skill. Once per game week, whenever it&rsquo;s convenient, gain one temporary Acquaintance Contact of your choice. You lose touch with this Contact after you use this Edge again, but you can use this Edge to connect with them again later.",
    ),
  }),
  focusedEdge(cwnEdges),
  ghostEdge(cwnEdges),
  classEdge("Hacker", {
    folderPath: cwnEdges,
    edgeType: "edge",
    bonusSkills: ["program"],
    bonusSkillsPick: 1,
    description: desc(
      "Gain Program as a bonus skill. You may begin play with an installed Cranial Jack cybersystem, a scrap deck, and eight program elements of your choice among available Verbs and Subjects. Each round, you gain a bonus Main Action that can only be used to perform hacking or cyberspace-related mental actions (not drone piloting or vehicle driving).",
    ),
  }),
  hardToKillEdge(cwnEdges, "cwn"),
  killingBlowEdge(cwnEdges, "cwn"),
  masterfulExpertiseEdge(cwnEdges),
  onTargetEdge(cwnEdges, "cwn"),
  prodigyEdge(cwnEdges),
  classEdge("Operator's Fortune", {
    folderPath: cwnEdges,
    edgeType: "edge",
    companions: ["Operator's Fortune"],
    description: desc(
      "Once per game session as an Instant action, when something bad happens to you such as an injury, a failed save, or a botched skill check, test your luck and roll 1d6. On a 1, the bad event is unaffected. On a 2&ndash;5, you somehow avert the consequences by blind chance. On a 6, it actually lands on an enemy or rival of the GM&rsquo;s choice, if that&rsquo;s possible.",
    ),
  }),
  veteransLuckEdge(cwnEdges),
  classEdge("Voice of the People", {
    folderPath: cwnEdges,
    edgeType: "edge",
    companions: ["Pop Idol"],
    description: desc(
      "You are a rocker, graffiti artist, poet, demagogue, or other rabble-rouser with a considerable reputation. You gain both levels of the Pop Idol Focus and an additional Friend Contact related to your art.",
    ),
  }),
  classEdge("Wired", {
    folderPath: cwnEdges,
    edgeType: "edge",
    description: desc(
      "You may begin play with up to $200,000 worth of new or secondhand cyber. If secondhand, you roll once per system for its defect. You don&rsquo;t need to pay for installation and its maintenance is covered for the next two months. You can redeem this Edge later by paying double the cost of the cyber you selected and trade it for a different Edge with the GM&rsquo;s approval.",
    ),
  }),
  ...sharedFeaturePowers(cwnFeatures),
  featurePower("Face Temporary Contact", {
    folderPath: cwnFeatures,
    internalResourceLength: "day",
    description: desc(
      "Once per game week, gain one temporary Acquaintance Contact of your choice. (Tracked as a day use for sheet refresh.)",
    ),
  }),
  featurePower("Operator's Fortune", {
    folderPath: cwnFeatures,
    internalResourceLength: "day",
    description: desc(
      "Once per game session as an Instant action, when something bad happens to you, roll 1d6: 1 unaffected, 2&ndash;5 avert by chance, 6 redirects to an enemy if possible. (Tracked as a day use for sheet refresh.)",
    ),
  }),
];

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/** @param {string} dir @param {string[]} [acc] */
function walkJsonFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, acc);
    else if (entry.name.endsWith(".json") && !entry.name.startsWith("_")) acc.push(full);
  }
  return acc;
}

/**
 * @param {object} spec
 * @param {string} folderId
 * @param {string|undefined} existingId
 * @param {string} idSeed
 */
function buildClassEdgeDoc(spec, folderId, existingId, idSeed) {
  const _id = existingId || randomId(idSeed);
  const effectFactory = typeof spec.effects === "function" ? spec.effects : () => spec.effects ?? [];
  const effects = effectFactory(_id);
  return {
    name: spec.name,
    type: "classEdge",
    img: CLASS_IMG,
    effects,
    flags: {},
    system: {
      description: spec.description,
      edgeType: spec.edgeType,
      attackProgression: spec.attackProgression,
      skillPointsPerLevel: spec.skillPointsPerLevel,
      ...emptyGrants(),
      poolGrant: { ...emptyGrants().poolGrant, ...spec.poolGrant },
      hdGrant: spec.hdGrant,
      bonusSkills: [...(spec.bonusSkills ?? [])],
      bonusSkillsPick: spec.bonusSkillsPick ?? 0,
      bonusSkillsChosen: [],
      bonusSkillsMode: spec.bonusSkillsMode ?? "",
      attributeGrant: {
        mode: spec.attributeGrant?.mode ?? "",
        exclude: [...(spec.attributeGrant?.exclude ?? [])],
        chosen: spec.attributeGrant?.chosen ?? "",
      },
      companions: [...(spec.companions ?? [])],
    },
    _id,
    folder: folderId,
    sort: 0,
    ownership: { default: 0 },
    _key: `!items!${_id}`,
  };
}

/**
 * @param {object} spec
 * @param {string} folderId
 * @param {string|undefined} existingId
 * @param {string} idSeed
 */
function buildPowerDoc(spec, folderId, existingId, idSeed) {
  const _id = existingId || randomId(idSeed);
  return {
    name: spec.name,
    type: "power",
    img: ABILITY_IMG,
    effects: [],
    flags: {},
    system: {
      description: spec.description,
      subType: "ability",
      customTypeName: "",
      source: "",
      resourceName: "",
      commitmentOptions: [{ cost: 0, length: "none", note: "" }],
      poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
      internalResource: spec.internalResource ?? { value: 1, max: 1 },
      internalResourceLength: spec.internalResourceLength ?? "scene",
      isActive: false,
      effectApplication: "self",
      level: 1,
      prepared: false,
      permanentStrain: 0,
      userStrain: "",
      targetStrain: "",
      installed: false,
      alienationCost: 0,
      activation: {
        roll: "",
        rollType: "result",
        rollTarget: 0,
        save: "",
        range: "",
        duration: "",
      },
      damageRoll: "",
      healing: false,
      bonusSkills: [],
      bonusSkillsPick: 0,
      bonusSkillsChosen: [],
      bonusSkillsMode: "",
    },
    _id,
    folder: folderId,
    sort: 0,
    ownership: { default: 0 },
    _key: `!items!${_id}`,
  };
}

/**
 * Ensure folder path exists; return leaf folder id.
 * @param {string[]} segments
 * @param {Map<string, object>} foldersById
 * @param {object[]} foldersOut
 * @param {string} seedPrefix
 */
function ensureFolderPath(segments, foldersById, foldersOut, seedPrefix) {
  let parentId = null;
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    const existing = [...foldersById.values()].find(
      (f) => f.name === name && (f.folder ?? null) === parentId,
    );
    if (existing) {
      parentId = existing._id;
      continue;
    }
    const folder = makeFolder(name, "Item", parentId, `${seedPrefix}-folder-${segments.slice(0, i + 1).join("/")}`);
    foldersById.set(folder._id, folder);
    foldersOut.push(folder);
    parentId = folder._id;
  }
  return parentId;
}

/**
 * @param {string} pack
 * @param {string} seedPrefix
 * @param {object[]} items
 * @param {Set<string>} managedPowerNames  companion powers this generator owns
 */
function generateForPack(pack, seedPrefix, items, managedPowerNames) {
  const dir = path.join("packs", "source", pack);
  const allDocs = [...readSourceDocs(dir)];

  const existingClassEdgeId = new Map();
  const existingPowerId = new Map();
  for (const doc of allDocs) {
    if (doc.type === "classEdge") existingClassEdgeId.set(doc.name, doc._id);
    if (doc.type === "power" && managedPowerNames.has(doc.name)) {
      existingPowerId.set(doc.name, doc._id);
    }
  }

  // Delete managed classEdges and companion powers (not foci/skills/mutations/psychic).
  for (const file of walkJsonFiles(dir)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw.type === "classEdge") fs.unlinkSync(file);
    else if (raw.type === "power" && managedPowerNames.has(raw.name)) fs.unlinkSync(file);
  }

  // Drop empty classEdge/edge feature folders we may recreate; keep other folders.
  const foldersById = buildFoldersById(allDocs);
  const foldersOut = [...foldersById.values()];

  const written = [];
  for (const spec of items) {
    const folderId = ensureFolderPath(spec.folderPath, foldersById, foldersOut, seedPrefix);
    const idSeed = `${seedPrefix}-${spec.kind}-${spec.name}`;
    if (spec.kind === "classEdge") {
      const doc = buildClassEdgeDoc(spec, folderId, existingClassEdgeId.get(spec.name), idSeed);
      written.push(doc);
    } else {
      const doc = buildPowerDoc(spec, folderId, existingPowerId.get(spec.name), idSeed);
      written.push(doc);
    }
  }

  // Write folders then items
  const finalFolders = buildFoldersById(foldersOut);
  for (const folder of foldersOut) {
    writeSourceDoc(dir, folder, finalFolders);
  }
  for (const doc of written) {
    writeSourceDoc(dir, doc, finalFolders);
  }

  console.log(
    `${pack}: wrote ${written.filter((d) => d.type === "classEdge").length} classEdges, `
      + `${written.filter((d) => d.type === "power").length} feature powers`,
  );
}

const swnPowerNames = new Set(
  swnItems.filter((i) => i.kind === "power").map((i) => i.name),
);
const awnPowerNames = new Set(
  awnItems.filter((i) => i.kind === "power").map((i) => i.name),
);
const cwnPowerNames = new Set(
  cwnItems.filter((i) => i.kind === "power").map((i) => i.name),
);

// Faceless / Systemic Immunity use map companions with ownedLevel — set system.companions empty
// and rely on CLASS_EDGE_COMPANIONS; clear the incorrect string companions for focus ownedLevel.
for (const item of awnItems) {
  if (item.name === "Systemic Immunity" || item.name === "Faceless") {
    item.companions = [];
  }
}
for (const item of cwnItems) {
  if (item.name === "Voice of the People") {
    item.companions = [];
  }
}

generateForPack("abilities-swn", "swn", swnItems, swnPowerNames);
generateForPack("abilities-awn", "awn", awnItems, awnPowerNames);
generateForPack("abilities-cwn", "cwn", cwnItems, cwnPowerNames);
