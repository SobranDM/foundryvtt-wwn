/**
 * Mutation seed data for Ashes Without Number (AWN).
 *
 * Source: reference/temp/AWN-Mutations.txt (OCR text extracted from the AWN PDF,
 * "Mutations" chapter). Mechanical text is copied/lightly cleaned from the book;
 * automation (Active Effects, resources, bonus skills) is filled in wherever a
 * clean 1:1 mapping to an existing AE target (see module/config/ae-targets.mjs)
 * or resource pattern exists. Everything else is narrative-only (empty `effects`).
 *
 * Run/import this from a future pack generator the same way
 * build/generate-swn-awn-foci.mjs consumes its own seed arrays.
 */
import { randomId } from "./pack-folder-paths.mjs";

export const MUTATION_IMG = "systems/wwn/assets/icons/items/focus.png";

/** @typedef {{
 *   id: string,           // stable 16-char Foundry id from deterministic seed: randomId("awn-mut-"+name)
 *   name: string,
 *   polarity: "positive"|"negative",
 *   category: "structure"|"sense"|"hybrid"|"cognition"|"pseudoPsychic"|"exotic"|null, // null for negatives
 *   d10?: number,         // 1-10 within category for positives
 *   tableRange?: [number, number], // inclusive d100 for negatives
 *   description: string,  // HTML <p>...</p>
 *   userStrain?: string,  // "", "1", "0,1", "2", etc.
 *   internalResource?: { value: number, max: number },
 *   internalResourceLength?: "scene"|"day",
 *   bonusSkills?: string[],
 *   bonusSkillsPick?: number,
 *   bonusSkillsMode?: ""|"any",
 *   activation?: { roll?: string, save?: string, range?: string, duration?: string },
 *   damageRoll?: string,
 *   healing?: boolean,
 *   effects?: Array<{
 *     name: string,
 *     disabled?: boolean,
 *     changes: Array<{ key: string, type: string, value: string|number, phase: string }>
 *   }>
 * }} MutationSeed */

// ---------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------

/** @param {string} key @param {string} type @param {string|number} value @param {string} phase */
function ch(key, type, value, phase) {
  return { key, type, value, phase };
}

/** @param {string} name @param {object[]} changes @param {{disabled?: boolean}} [opts] */
function effect(name, changes, { disabled = false } = {}) {
  return { name, disabled, changes };
}

const ABILITY_LABELS = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

/**
 * Build a set of mutually-exclusive, disabled-by-default choice effects for an
 * ability score modifier (the player enables the one they picked).
 * @param {string} mutationName
 * @param {string[]} keys  e.g. ["int", "wis", "cha"]
 * @param {number} amount  e.g. 1 or -1
 */
function abilityChoiceEffects(mutationName, keys, amount) {
  return keys.map((key) =>
    effect(`${mutationName} (${ABILITY_LABELS[key]})`, [ch(`system.abilities.${key}.baseMod`, "add", amount, "initial")], {
      disabled: true,
    }),
  );
}

/** Deterministic id, disambiguated by polarity so "Hemovore" (pos) and "Hemovore" (neg) never collide. */
function mutationId(polarity, name) {
  return randomId(`awn-mut-${polarity}-${name}`);
}

/**
 * @param {string} name
 * @param {"structure"|"sense"|"hybrid"|"cognition"|"pseudoPsychic"|"exotic"} category
 * @param {number} d10
 * @param {string} description
 * @param {object} [opts]
 * @returns {MutationSeed}
 */
function positive(name, category, d10, description, opts = {}) {
  /** @type {MutationSeed} */
  const mutation = {
    id: mutationId("pos", name),
    name,
    polarity: "positive",
    category,
    d10,
    description,
    userStrain: opts.userStrain ?? "",
    bonusSkills: opts.bonusSkills ?? [],
    bonusSkillsPick: opts.bonusSkillsPick ?? 0,
    bonusSkillsMode: opts.bonusSkillsMode ?? "",
    effects: opts.effects ?? [],
  };
  if (opts.internalResource) mutation.internalResource = opts.internalResource;
  if (opts.internalResourceLength) mutation.internalResourceLength = opts.internalResourceLength;
  if (opts.activation) mutation.activation = opts.activation;
  if (opts.damageRoll) mutation.damageRoll = opts.damageRoll;
  if (opts.healing) mutation.healing = opts.healing;
  return mutation;
}

/**
 * @param {string} name
 * @param {[number, number]} tableRange
 * @param {string} description
 * @param {object} [opts]
 * @returns {MutationSeed}
 */
function negative(name, tableRange, description, opts = {}) {
  /** @type {MutationSeed} */
  const mutation = {
    id: mutationId("neg", name),
    name,
    polarity: "negative",
    category: null,
    tableRange,
    description,
    userStrain: opts.userStrain ?? "",
    bonusSkills: opts.bonusSkills ?? [],
    bonusSkillsPick: opts.bonusSkillsPick ?? 0,
    bonusSkillsMode: opts.bonusSkillsMode ?? "",
    effects: opts.effects ?? [],
  };
  if (opts.internalResource) mutation.internalResource = opts.internalResource;
  if (opts.internalResourceLength) mutation.internalResourceLength = opts.internalResourceLength;
  if (opts.activation) mutation.activation = opts.activation;
  if (opts.damageRoll) mutation.damageRoll = opts.damageRoll;
  if (opts.healing) mutation.healing = opts.healing;
  return mutation;
}

/** Auto-incrementing d10 index within a single category. */
function categoryBuilder(category) {
  let n = 0;
  return (name, description, opts) => {
    n += 1;
    return positive(name, category, n, description, opts);
  };
}

// ---------------------------------------------------------------------------
// Positive mutations — Structure (d10 1-10)
// ---------------------------------------------------------------------------

const structure = categoryBuilder("structure");

const structureMutations = [
  structure(
    "Augmented Muscle",
    "<p>Your Strength ability score is treated as four points greater for Encumbrance purposes and you gain a +1 bonus to your Strength modifier, to a maximum of +2.</p>",
    { effects: [effect("Augmented Muscle", [ch("system.abilities.str.baseMod", "add", 1, "initial")])] },
  ),
  structure(
    "Explosive Exertion",
    "<p>As an On Turn action, gain a tremendous boost of strength. Your next roll this round treats your Strength modifier as +2, or +3 if it&rsquo;s already +2. For the rest of this round, you can lift, break, or carry anything an ogre-sized humanoid could, smashing through ordinary doors and non-reinforced walls. After the first use of this mutation in a scene, additional uses add 1 System Strain.</p>",
    { userStrain: "0,1", activation: { roll: "On Turn action", duration: "1 round" } },
  ),
  structure(
    "Hypercontortion",
    "<p>Your musculature and skeletal system are both abnormally flexible. You can fit yourself through any hole big enough to admit your head and gain a +2 bonus to all grapple-related skill checks and +1 to all motion-related Perform checks. Attempting to escape from a grapple is an On Turn action for you once per round.</p>",
  ),
  structure(
    "Improved Joints",
    "<p>You add 5 meters to your base Move rate and you gain a +1 bonus to your Dexterity modifier, to a maximum of +2.</p>",
    {
      effects: [
        effect("Improved Joints", [
          ch("system.movement.bonus", "add", 5, "initial"),
          ch("system.abilities.dex.baseMod", "add", 1, "initial"),
        ]),
      ],
    },
  ),
  structure(
    "Leaper",
    "<p>Subtract 20 meters from any falling damage taken. As a Move action, jump to any location within 20 meters. You cannot jump two rounds in a row. This jump does not count as a Fighting Withdrawal for purposes of escaping melee engagements.</p>",
    { activation: { roll: "Move action", range: "20m" } },
  ),
  structure(
    "Redundant Organs",
    "<p>Once per week, as an On Turn action, get up after being Mortally Wounded by physical injury and regain 25% of your maximum hit points, rounded up. This mutation cannot save you from unavoidably certain death. If using Trauma rules, your Trauma Target increases by +1.</p>",
    {
      healing: true,
      activation: { roll: "On Turn action" },
      effects: [effect("Redundant Organs", [ch("system.trauma.targetMod", "add", 1, "initial")])],
    },
  ),
  structure(
    "Regenerator",
    "<p>You automatically stabilize if Mortally Wounded and regenerate 2 hit points of damage every hour. If mutilated, you can regrow missing limbs or organs in one week, assuming you can survive their absence that long. You cannot recover from effects that instantly kill you.</p>",
    {
      healing: true,
      effects: [effect("Regenerator", [ch("system.combat.autoStabilize", "override", "true", "final")])],
    },
  ),
  structure(
    "Reinforced Tissues",
    "<p>Your flesh is abnormally dense. You treat your Constitution as 18 for attribute modifier purposes when rolling hit points and you gain a +2 bonus to your Armor Class that stacks with any armor or other AC benefit you may have. As a consequence of your density, you cannot swim and roll all fall damage twice, taking the worst result.</p>",
    { effects: [effect("Reinforced Tissues", [ch("system.combat.ac.mod", "add", 2, "initial")])] },
  ),
  structure(
    "Sealed Systems",
    "<p>You do not need to breathe and are immune to toxic gases, extremes of high and low atmospheric pressure or natural temperature, aerosol-transmitted diseases, and anything else a modern hazmat suit would resist. You can rest comfortably in any non-damaging environment.</p>",
  ),
  structure(
    "Stamina Reserves",
    "<p>You do not sleep, and can maintain a modest level of exertion indefinitely. You can recover daily System Strain as normal with four hours of comfortable, well-fed rest, during which you can perform light activity. You have +2 on all skill checks involving continuous exertion.</p>",
  ),
];

// ---------------------------------------------------------------------------
// Positive mutations — Sense (d10 1-10)
// ---------------------------------------------------------------------------

const sense = categoryBuilder("sense");

const senseMutations = [
  sense(
    "Accelerated Perception",
    "<p>You process your sensory input at an inhumanly fast rate. You cannot be surprised or suffer Execution Attacks, and your Snap Attacks do not suffer the usual -4 penalty to hit. Once per day, accept one System Strain to take your next Main Action immediately as an Instant response to someone else&rsquo;s action. Your action resolves before theirs.</p>",
    {
      userStrain: "1",
      internalResource: { value: 0, max: 1 },
      internalResourceLength: "day",
      activation: { roll: "Instant action" },
      effects: [effect("Accelerated Perception", [ch("system.combat.immuneToSurprise", "override", "true", "initial")])],
    },
  ),
  sense(
    "Acute Hearing",
    "<p>Your hearing is acute enough to give you a clear picture of your surroundings within 10 meters, including positioning accurate enough to allow attacks. You can identify people by their breathing and heartbeat. By focusing on a location within 100 meters, you can listen as if you were standing there, if no obstacles intervene.</p>",
  ),
  sense(
    "Acute Olfaction",
    "<p>You have a clear olfactory picture of your surroundings within 10 meters, including positioning accurate enough to allow attacks. You can identify any person you&rsquo;ve met by smell, as well as objects they&rsquo;ve handled within the past day. You can faultlessly track any trail left within an hour unless it has been carefully erased; in that and other cases you simply get a +4 bonus on all Wis/Survive or similar tracking skill checks.</p>",
  ),
  sense(
    "Echolocation",
    "<p>You emit inaudible sonic pings that give you a clear image of the surroundings in front of you out to a thirty meter distance. The resolution is fine enough to distinguish people and small details, but cannot make out details smaller than one centimeter in size.</p>",
  ),
  sense(
    "Empathic Sensitivity",
    "<p>You intuitively notice subtle physiological signifiers when speaking to another creature, identifying its current emotional state as a Main Action. Gain a +1 to all social skill checks. You can communicate with other intelligent creatures even in the absence of a shared language, though only via basic ideas and concepts.</p>",
    { activation: { roll: "Main Action" } },
  ),
  sense(
    "Night Vision",
    "<p>Your visual senses function perfectly even in the complete absence of light. Due to your visual sensitivity to the high-energy particles involved, you can also see dangerous zones of radiation.</p>",
    {
      effects: [
        effect("Night Vision", [
          ch("token.sight.enabled", "override", "true", "final"),
          ch("token.sight.range", "add", 60, "final"),
        ]),
      ],
    },
  ),
  sense(
    "Panoptic Vision",
    "<p>Your visual senses function in a 360-degree circle and maintain awareness even while you are asleep or unconscious. You cannot be surprised or suffer Execution Attacks and you can awake from normal sleep instantly to respond to something you see.</p>",
    {
      effects: [effect("Panoptic Vision", [ch("system.combat.immuneToSurprise", "override", "true", "initial")])],
    },
  ),
  sense(
    "Tactile Analysis",
    "<p>Your sense of touch is hyper-acute, granting you a +2 bonus on all skill checks related to manual dexterity such as crafting, trauma care, lockpicking, playing musical instruments, or the like. Your awareness of air pressure and minute drafts gives you a sensory picture of your visually-unobstructed surroundings within 10 meters, including positioning accurate enough to allow attacks.</p>",
  ),
  sense(
    "Telescopic Sight",
    "<p>Any visible point within one kilometer can be observed as if you were standing adjacent. You suffer no penalties for using a ranged weapon at long range.</p>",
  ),
  sense(
    "Thermal Vision",
    "<p>You can see heat gradients, allowing you a somewhat blurry vision that functions even in perfect darkness or clouds of dust. This thermal vision is precise enough to distinguish individuals, but cannot make out fine details. As a Main Action, you can emit ocular heat rays that do 2d6 damage plus your character level to a target within 30 meters, with an Evasion save to negate it. Each use of this ability after the first in a scene adds one System Strain.</p>",
    {
      userStrain: "0,1",
      damageRoll: "2d6 + @lvl",
      activation: { roll: "Main Action", save: "Evasion", range: "30m" },
    },
  ),
];

// ---------------------------------------------------------------------------
// Positive mutations — Hybrid (d10 1-10)
// ---------------------------------------------------------------------------

const hybrid = categoryBuilder("hybrid");

const hybridMutations = [
  hybrid(
    "Aquatic Adaptation",
    "<p>You can breathe and function normally underwater, ignoring normal extremes of temperature and pressure and seeing clearly underwater out to 30 meters even in the absence of light. Your Move rate increases by 5 meters per Move action when swimming.</p>",
  ),
  hybrid(
    "Arboreal Aptitude",
    "<p>You are an unnaturally nimble climber, able to scale all but perfectly smooth surfaces as if they were flat ground. You can hang from vertical or overhead surfaces so long as one hand has purchase. All falling damage you take is halved, rounded down.</p>",
  ),
  hybrid(
    "Centauroid",
    "<p>You have a quadrupedal lower body, though you are not necessarily much larger than a normal human. Your base Move rate increases by 10 meters per Move action and you gain a +2 skill check bonus to resist grapples by human-sized foes. You can only wear armor specially crafted for you.</p>",
    { effects: [effect("Centauroid", [ch("system.movement.bonus", "add", 10, "initial")])] },
  ),
  hybrid(
    "Crushing Jaws",
    "<p>Your jaws or mandibles are meant for crushing hard or fibrous substances. Your bite attacks use Punch and do 1d12 damage with no Shock, using the better of Strength or Dexterity to modify the attack. If using Traumatic Hit rules, your bite has a 1d8/x2 Trauma Rating. As with other Punch attacks, you may add your skill level to the damage roll. You can chew through up to twenty centimeters of hard wood or similar substances with one minute of gnawing.</p>",
    { damageRoll: "1d12" },
  ),
  hybrid(
    "Digitigrade Legs",
    "<p>Your animalistic legs grant you unusual speed. Your base Move rate increases by 5 meters per Move action and you can jump up to 10 meters horizontally or half vertically as a Move action.</p>",
    { effects: [effect("Digitigrade Legs", [ch("system.movement.bonus", "add", 5, "initial")])] },
  ),
  hybrid(
    "Functional Wings",
    "<p>You have wings of some kind, though it&rsquo;s difficult for them to lift you. You can fly at twice your standard Move rate, but it takes a Main Action to do so instead of a Move action. You cannot hover, so you must fly each round or land. You cannot fly when encumbered beyond your usual Strength maximum, and you cannot wear high-tech sealed-suit armor not built for a winged user. You can fly for up to ten minutes at a time before needing to spend an equal amount of time resting.</p>",
    { activation: { roll: "Main Action" } },
  ),
  hybrid(
    "Prehensile Limb",
    "<p>You have one or more tails, tentacles, or other extremities that can manipulate objects with your normal strength and manual dexterity. Once per scene, as an On Turn action, accept one System Strain to have a prehensile limb do something that wouldn&rsquo;t take more than a Main Action to perform, such as make an attack or manipulate a device.</p>",
    {
      userStrain: "1",
      internalResource: { value: 0, max: 1 },
      internalResourceLength: "scene",
      activation: { roll: "On Turn action" },
    },
  ),
  hybrid(
    "Savage Claws",
    "<p>You have murderously effective body weaponry of some kind, and your Punch attacks do 1d6 plus your character level in damage, have a Shock rating of half your level rounded up against AC 15, and may use either Dexterity or Strength as the modifying attribute. If using Traumatic Hit rules, they have a 1d6/x3 rating. As with other Punch attacks, you may add your skill level to the damage die, but not the Shock.</p>",
    { damageRoll: "1d6 + @lvl" },
  ),
  hybrid(
    "Thick Hide",
    "<p>Whether from dense skin, scales, thick fur, chitin, or some other body covering, your base Armor Class is equal to 15 plus half your level, rounded down. Armor worse than this does not help you, but you gain benefits from shields normally. Any Shock you suffer is lowered by 1 point, to a potential minimum of zero.</p>",
    {
      effects: [effect("Thick Hide", [ch("system.combat.innateAc.min", "upgrade", "@halfLevel + 15", "final")])],
    },
  ),
  hybrid(
    "Venom Glands",
    "<p>You may exude venom as an On Turn action at the cost of one System Strain. If imbibed or applied by a bladed weapon attack or body weaponry, it does 1d8 damage plus the user&rsquo;s level to subjects susceptible to poison for the rest of the scene. The user may make the toxin non-lethal simply by lessening the dosage. Envenoming a weapon with this toxin takes a Main Action and the toxin spoils after a scene, though it can last through multiple hits. A given victim can be harmed by this poison only once per scene.</p>",
    { userStrain: "1", damageRoll: "1d8 + @lvl", activation: { roll: "On Turn action" } },
  ),
];

// ---------------------------------------------------------------------------
// Positive mutations — Cognition (d10 1-10)
// ---------------------------------------------------------------------------

const cognition = categoryBuilder("cognition");

const cognitionMutations = [
  cognition(
    "Augmented Cognition",
    "<p>Your brain is simply superior to that of a baseline human. Your Intelligence, Wisdom, or Charisma modifier increases by +1, chosen as you wish, to a maximum of +2.</p>",
    { effects: abilityChoiceEffects("Augmented Cognition", ["int", "wis", "cha"], 1) },
  ),
  cognition(
    "Ballistic Calculator",
    "<p>You have an intuitive grasp of distances, vectors, and other ballistic calculations. Gain Shoot as a bonus skill and ignore any penalty for shooting at long range. Once per scene, accept one System Strain as an Instant action to reroll a missed ranged attack.</p>",
    {
      bonusSkills: ["shoot"],
      bonusSkillsPick: 1,
      userStrain: "1",
      internalResource: { value: 0, max: 1 },
      internalResourceLength: "scene",
      activation: { roll: "Instant action" },
    },
  ),
  cognition(
    "Eidetic Memory",
    "<p>You can remember every sensory detail you experienced in the past 48 hours, and never forget matters of importance to you. Gain one bonus skill of your choice and gain one additional skill point when advancing a level.</p>",
    { bonusSkillsMode: "any", bonusSkillsPick: 1, bonusSkills: [] },
  ),
  cognition(
    "Internal Map",
    "<p>You are always aware of your location and facing in relation to a point known to you. You cannot become lost or Go Astray and can navigate known spaces normally even in perfect darkness.</p>",
  ),
  cognition(
    "Intuitive Leap",
    "<p>You are capable of drawing remarkable insights from seemingly trivial observations. Your Wisdom modifier increases by +1 to a maximum of +2 and you gain Notice as a bonus skill. Once per game session, you may accept one System Strain as a Main Action and ask the GM a question. The GM then gives a one-sentence answer as if the PC were Sherlock Holmes or some other hyper-capable literary detective, along with a brief description of how the PC&rsquo;s inhuman abilities of deduction produced the result.</p>",
    {
      bonusSkills: ["notice"],
      bonusSkillsPick: 1,
      userStrain: "1",
      internalResource: { value: 0, max: 1 },
      internalResourceLength: "day",
      activation: { roll: "Main Action" },
      effects: [effect("Intuitive Leap", [ch("system.abilities.wis.baseMod", "add", 1, "initial")])],
    },
  ),
  cognition(
    "Memory Eater",
    "<p>By consuming the brain tissue of an intelligent creature no more than one hour dead, you can share fragments of its memory. After eating part of a subject&rsquo;s brain, you can ask it one question and gain a one or two-sentence answer from their memories. This ability works only once on any given brain. Your Intelligence modifier increases by +1 for 24 hours after eating an intelligent creature&rsquo;s brain, up to a maximum of +3, and brain-eating feeds you for one day.</p>",
  ),
  cognition(
    "Mental Bifurcation",
    "<p>You can maintain two separate trains of thought at once. You cannot be surprised or suffer Execution Attacks and one half of your mind can sleep while the other remains awake, though you must rest quietly to recover as normal. Once per round, as an Instant action when you fail a Mental save, you may accept one System Strain to reroll the save.</p>",
    {
      userStrain: "1",
      activation: { roll: "Instant action", save: "Mental" },
      effects: [effect("Mental Bifurcation", [ch("system.combat.immuneToSurprise", "override", "true", "initial")])],
    },
  ),
  cognition(
    "Mind Over Body",
    "<p>Your mind has an abnormal degree of control over your physical processes, driving them to exceed their normal level. You may substitute either your Intelligence or Wisdom modifiers for your Strength or Constitution modifiers when the latter are called for, even for your hit point rolls each level. You can intellectually ignore pain and other physical sensations, though you still suffer the mechanical penalties, and you automatically stabilize when Mortally Wounded.</p>",
    { effects: [effect("Mind Over Body", [ch("system.combat.autoStabilize", "override", "true", "final")])] },
  ),
  cognition(
    "Omniglot",
    "<p>You have a natural ability to communicate with other intelligent creatures in a way they will find comprehensible. Your Charisma modifier increases by +1. You can speak to any intelligent creature as if you spoke their native language. You can learn to speak, read, and write any language with a day of practice with a native speaker.</p>",
    { effects: [effect("Omniglot", [ch("system.abilities.cha.baseMod", "add", 1, "initial")])] },
  ),
  cognition(
    "Predictive Analysis",
    "<p>You have the ability to predict what others around you are about to do. Your Intelligence or Wisdom modifier increases by +1. Once per game session, accept one System Strain as an Instant action after someone else acts; events rewind to the beginning of your last turn, as what played out was simply what you predicted would happen. By predicting it, you changed it, and you may now act differently. This rewind ability only works in response to a creature&rsquo;s actions, and cannot be used to undo natural events or accidents.</p>",
    {
      userStrain: "1",
      internalResource: { value: 0, max: 1 },
      internalResourceLength: "day",
      activation: { roll: "Instant action" },
      effects: abilityChoiceEffects("Predictive Analysis", ["int", "wis"], 1),
    },
  ),
];

// ---------------------------------------------------------------------------
// Positive mutations — Pseudo-Psychic (d10 1-10)
// ---------------------------------------------------------------------------

const pseudoPsychic = categoryBuilder("pseudoPsychic");

const pseudoPsychicMutations = [
  pseudoPsychic(
    "Force Field",
    "<p>As a Main Action, you can generate a force field around yourself that absorbs up to 10 points of damage plus your character level before failing. The field vanishes at the end of your next round unless you spend a Move action sustaining it each round or accept 1 System Strain to maintain it to the end of the scene. Damage done to the shield regenerates at the end of each scene. If the shield is destroyed entirely, any overflow damage is done to you and you cannot re-summon it that scene.</p>",
    { activation: { roll: "Main Action", duration: "1 round (sustain with a Move action, or 1 Strain for the scene)" } },
  ),
  pseudoPsychic(
    "Induce Confusion",
    "<p>As a Main Action, focus on a living creature within 30 meters. Your target must make a Mental save; on a failure they suffer intense mental confusion for 1d6 rounds. While confused, a creature that does anything but remain stationary that round has a 50% chance of actually doing the opposite of what they intended to do with their Main Action: attacking the wrong target, moving in the wrong direction, using the wrong ability, or so forth. The GM decides specifics, but their confusion is never helpful to their cause. A creature can be targeted by this mutation only once per scene. Creatures with more hit dice than the user has levels get a Mental save to throw off the confusion at the end of each of their rounds. After the first time you use this mutation in a scene, additional uses add 1 System Strain.</p>",
    { userStrain: "0,1", activation: { roll: "Main Action", save: "Mental", range: "30m", duration: "1d6 rounds" } },
  ),
  pseudoPsychic(
    "Limited Precognition",
    "<p>As an Instant action, accept 1 System Strain before performing an action that would take no more than a few seconds, such as pushing a button, drinking a liquid, or opening a door. You immediately sense the next six seconds of consequences that the GM thinks most likely to happen, observing them from your own perspective. If you wish, you may trigger this precognitive ability just before an otherwise-successful ambush or Execution Attack, foiling either.</p>",
    { userStrain: "1", activation: { roll: "Instant action" } },
  ),
  pseudoPsychic(
    "Mental Domination",
    "<p>As a Main Action, focus on a living creature within 10 meters. The target must make a Mental save; if it succeeds, nothing happens, though they are aware of your attempt to control them. If it fails, roll 1d6 per character level; if the total equals or exceeds their current hit points, they become totally physically subject to your will so long as you can see them and spend a Move action each round maintaining control. Thralls cannot be made to exercise judgment or answer questions, but will perform physical actions to the best of their ability even if they are suicidal. Domination ends at the end of the scene, only one creature can be dominated at a time, and only one attempt may be made to dominate a given creature per scene. This mutation does not work on creatures with more hit dice than the user has levels. After the first time you use this mutation in a scene, additional uses add 1 System Strain.</p>",
    { userStrain: "0,1", activation: { roll: "Main Action", save: "Mental", range: "10m", duration: "scene" } },
  ),
  pseudoPsychic(
    "Mind Reader",
    "<p>As a Main Action, accept one System Strain and target a visible creature. The target gets a Mental saving throw; if they succeed, you simply get a one-sentence description of what they&rsquo;re thinking about right now. If they fail, you get that description and can ask their memories one question, getting a one or two-sentence answer if the question is one their memories could answer. A creature can be targeted by this mutation only once per day, and will not normally notice it even if they succeed in their save.</p>",
    { userStrain: "1", activation: { roll: "Main Action", save: "Mental", range: "visible" } },
  ),
  pseudoPsychic(
    "Neural Lockdown",
    "<p>As a Main Action, focus on a living creature within 10 meters. They must make a Mental save; on a success, nothing happens but they are unaware of your attempt. On a failure, roll 1d6 per character level; if your total is equal or higher than their current hit points, they become paralyzed and insensate until you release them or the scene ends. They remember absolutely nothing that happened during the scene, filling in any blanks with their own natural assumptions. This mutation can target a given creature only once per scene. After the first time you use this mutation in a scene, additional uses add 1 System Strain.</p>",
    { userStrain: "0,1", activation: { roll: "Main Action", save: "Mental", range: "10m" } },
  ),
  pseudoPsychic(
    "Panic Wave",
    "<p>As a Main Action, emit a wave of psychic terror in a 10-meter radius. Your allies can resist it, but all other living creatures must make a Morale check. A creature may choose to continue fighting even if it fails the check, but it then takes 1d6 damage per 2 character levels you possess, rounded up. If reduced to zero hit points this way, it regains one HP and flees. You may trigger this wave only once per scene. If used out of combat, this power grants a +2 bonus to any social skill checks reliant on intimidation.</p>",
    {
      internalResource: { value: 0, max: 1 },
      internalResourceLength: "scene",
      damageRoll: "@halfLeveld6",
      activation: { roll: "Main Action", range: "10m" },
    },
  ),
  pseudoPsychic(
    "Spatial Displacement",
    "<p>As a Move action, teleport up to 10 meters to a location you can see. This movement counts as a Fighting Withdrawal for purposes of avoiding melee attacks. After the first use of this mutation in a scene, additional uses add 1 System Strain.</p>",
    { userStrain: "0,1", activation: { roll: "Move action", range: "10m" } },
  ),
  pseudoPsychic(
    "Telekinetic Reach",
    "<p>As a Main Action, you can manipulate objects within 10 meters per character level as if handling them with your own two hands. You cannot lift yourself or manipulate objects being touched, worn, or driven by hostile living creatures. You can move manipulated objects at a maximum speed of 10 meters per activation.</p>",
    { activation: { roll: "Main Action", range: "10m per level" } },
  ),
  pseudoPsychic(
    "Thermokinesis",
    "<p>As a Main Action, target a living creature or flammable object within 30 meters. Objects targeted cannot be carried by a creature and large objects only have one cubic meter of their mass affected. Objects targeted by this power either freeze solid or burst into flame, and living creatures will suffer 2d10 heat or cold damage plus your character level, with a Physical saving throw for half. After the first time you use this attack in a scene, additional uses add 1 System Strain.</p>",
    {
      userStrain: "0,1",
      damageRoll: "2d10 + @lvl",
      activation: { roll: "Main Action", save: "Physical", range: "30m" },
    },
  ),
];

// ---------------------------------------------------------------------------
// Positive mutations — Exotic (d10 1-10)
// ---------------------------------------------------------------------------

const exotic = categoryBuilder("exotic");

const exoticMutations = [
  exotic(
    "Chameleon Field",
    "<p>You can change your body and clothing&rsquo;s color and texture at will. While you cannot become invisible, you gain Sneak as a bonus skill and a +1 bonus on all Sneak skill checks. When motionless, you can make an opposed Sneak versus Notice skill check to avoid notice even when an observer is directly in view of you. When more than 30 meters distant from a normally-sighted viewer, you cannot be detected visually unless you draw attention somehow.</p>",
    { bonusSkills: ["sneak"], bonusSkillsPick: 1 },
  ),
  exotic(
    "Electrical Generation",
    "<p>You can charge your unarmed or conductive metal weapon attacks with electrical energy, adding 2d6 damage plus your character level as an Instant action. After the first use of this bonus in a scene, additional uses add 1 System Strain. Optionally, you can recharge a Type A energy cell at a cost of 1 System Strain. You ignore the first 10 points of damage from any electrical harm done to you.</p>",
    { userStrain: "0,1", damageRoll: "2d6 + @lvl", activation: { roll: "Instant action" } },
  ),
  exotic(
    "Hemovore",
    "<p>You can feed on the life force of others, usually in a manner that involves blood drinking or other close physical contact. The victim must be an intelligent creature who is either helpless or cooperative. With one Main Action, you can drain 1d6 hit points and use them to heal damage you have suffered. If they cooperate, you can choose how many of their hit points to drain; if they resist, you might accidentally kill them. You cannot drain more hit points than they have. Draining a human to death will negate any need you may have for food or water for the next week.</p>",
    { healing: true, damageRoll: "1d6", activation: { roll: "Main Action" } },
  ),
  exotic(
    "Image Projection",
    "<p>As a Main Action, create a visual illusion within 30 meters that can fit in a 5-meter cube. The image can involve sound up to normal conversational volume and can move and act so long as you spend a Move action concentrating on it each round. The illusion persists for one round per character level after you stop concentrating on it. It is entirely intangible, and objects cannot be made invisible by the illusion, though they can be concealed by another image. After the first time you use this mutation in a scene, additional uses add 1 System Strain.</p>",
    { userStrain: "0,1", activation: { roll: "Main Action", range: "30m" } },
  ),
  exotic(
    "Metamorph",
    "<p>As a Main Action, alter your physical shape to any other humanoid form within 50% of your height or weight. You can mimic clothing and armor as part of this shift, but such mimicked items grant no AC or other benefits. You can perfectly impersonate another person if you&rsquo;ve spent at least ten minutes personally interacting with them or have at least ten grams of their blood, hair, or other tissues.</p>",
    { activation: { roll: "Main Action" } },
  ),
  exotic(
    "Molecular Phasing",
    "<p>As a Main Action, accept 1 System Strain and alter your molecular composition to be slightly out of tune with mundane reality. Until the start of your next turn, you can move at your normal movement rate in any direction, passing through solid objects. You cannot affect or be affected by mundane matter or energy while phased. If you re-materialize while fully or partially embedded in something else, you are ejected into the nearest space that can contain you. Both you and the object you intersected take 1d6 damage per character level you possess.</p>",
    {
      userStrain: "1",
      damageRoll: "@lvld6",
      activation: { roll: "Main Action", duration: "until the start of your next turn" },
    },
  ),
  exotic(
    "Natural Projectiles",
    "<p>You have some sort of natural projectile or energy weapon that has the same combat statistics as a rifle, can be used without penalty in melee, and never runs out of ammunition under normal combat usage. You gain the Shoot skill as a bonus skill. Your natural projectiles get a +1 damage and hit bonus at level 3, +2 at level 6, and +3 at level 9.</p>",
    { bonusSkills: ["shoot"], bonusSkillsPick: 1, damageRoll: "2d6" },
  ),
  exotic(
    "Pheromone Cloud",
    "<p>You emit subtle pheromones that tweak the reasoning of intelligent creatures around you. As an On Turn action, accept one System Strain before making a request or suggestion to someone else. They must make a Mental save; if it fails, they will agree unless the request would bring them harm or be very contrary to their nature. A creature can be targeted by this mutation only once per scene.</p>",
    { userStrain: "1", activation: { roll: "On Turn action", save: "Mental" } },
  ),
  exotic(
    "Photon Manipulation",
    "<p>You can instinctively modulate the light level around you. You can create visible light within a 10-meter radius or shroud up to a 2-meter radius in inky darkness that resists all illumination. While shrouded, you gain an Armor Class bonus of +2 due to your obfuscation. You can see normally regardless of the light level around you. When you or an ally within 10 meters are hit by a laser weapon, accept one System Strain as an Instant action to negate the damage.</p>",
    { userStrain: "1", activation: { roll: "Instant action", range: "10m" } },
  ),
  exotic(
    "Sound Generation",
    "<p>You can produce any sound you wish up to the volume of a shout originating from a visible point within 30 meters. As a Main Action, you can focus on a target within 30 meters and make a sonic attack that inflicts 2d6 plus your level in non-lethal damage to any non-deaf creature. After the first use of this sonic attack in a scene, additional uses add 1 System Strain.</p>",
    { userStrain: "0,1", damageRoll: "2d6 + @lvl", activation: { roll: "Main Action", range: "30m" } },
  ),
];

export const POSITIVE_MUTATIONS = [
  ...structureMutations,
  ...senseMutations,
  ...hybridMutations,
  ...cognitionMutations,
  ...pseudoPsychicMutations,
  ...exoticMutations,
];

// ---------------------------------------------------------------------------
// Negative mutations (d100)
// ---------------------------------------------------------------------------

export const NEGATIVE_MUTATIONS = [
  negative(
    "Animalistic Mentality",
    [1, 2],
    "<p>You have psychological traits of some kind that make it difficult to deal with normal humans, including other mutants. Your Charisma modifier suffers a -1 penalty.</p>",
    { effects: [effect("Animalistic Mentality", [ch("system.abilities.cha.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Anosmia",
    [3, 4],
    "<p>You have no sense of smell or taste. Your Wisdom modifier takes a -1 penalty and you fail all skill checks reliant on either sense. You cannot identify poisoned or contaminated food or water unless it is visually obvious.</p>",
    { effects: [effect("Anosmia", [ch("system.abilities.wis.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Awkward Mouth",
    [5, 6],
    "<p>Your mouthparts are altered in ways that make it impossible to speak. Your allies understand your vocalizations and sign language, but you can only communicate by gestures with unfamiliar strangers. You cannot gain the Talk or Lead skills, but you gain the Crushing Jaws positive mutation for free.</p>",
  ),
  negative(
    "Bestial Hunger",
    [7, 8],
    "<p>You need to consume twice as much food and water as a normal human being in order to avoid privation. You cannot gain mutations that lower your food or water intake requirements.</p>",
  ),
  negative(
    "Bleeder",
    [9, 10],
    "<p>You die at the end of your third round after becoming Mortally Wounded, instead of after the sixth. Devices, abilities, and powers that would automatically stabilize you when you are Mortally Wounded simply do not work for you.</p>",
  ),
  negative(
    "Blindness",
    [11, 12],
    "<p>You are completely blind. After rolling all negative mutations, pick one free non-visual Sensory positive mutation of your choice that you presumably use to compensate. You cannot gain a Sensory mutation that improves your vision.</p>",
    { effects: [effect("Blindness", [ch("token.sight.enabled", "override", "false", "final")])] },
  ),
  negative(
    "Chronic Seizures",
    [13, 14],
    "<p>Whenever you roll a natural 1 on a hit roll or a natural 2 on a skill check, you must make a Physical save or suffer a seizure of some kind, dropping anything you&rsquo;re holding and becoming unable to act for the rest of the scene. You can temporarily resist the seizure by accepting 1 System Strain for each round you delay it. You can&rsquo;t suffer a seizure more than once per week.</p>",
  ),
  negative(
    "Clumsy Paws",
    [15, 16],
    "<p>Your hands or hand-equivalents are clumsy compared to human digits. You cannot manipulate any object more delicate than an oversized gun trigger.</p>",
  ),
  negative(
    "Constant Secretions",
    [17, 18],
    "<p>You exude secretions of some kind that triple your required daily water intake and double the Readied Encumbrance of any armor. You roll all skill checks to resist or escape grapples twice and take the better.</p>",
  ),
  negative(
    "Deafness",
    [19, 20],
    "<p>You are deaf, but can lip-read well enough to understand most others. You cannot gain a mutation that improves your hearing.</p>",
  ),
  negative(
    "Deficient Polycephaly",
    [21, 22],
    "<p>You have an additional head and brain, placed where you wish. Unfortunately, it is an idiot, and the stress of containing its impulses and thoughts applies a -1 modifier penalty to either your Intelligence or Wisdom, at your choice. If you roll a natural 2 on a social skill check, it will say the worst possible thing.</p>",
    { effects: abilityChoiceEffects("Deficient Polycephaly", ["int", "wis"], -1) },
  ),
  negative(
    "Distorted Speech",
    [23, 24],
    "<p>You are unable to communicate clearly, whether due to a speech impediment, cognitive impairment, or an uncontrollable verbal tic. Your friends have learned to understand you, but you can&rsquo;t communicate more than basic ideas to others. You cannot gain the Talk or Lead skills.</p>",
  ),
  negative(
    "Distracted Mind",
    [25, 26],
    "<p>You have difficulty maintaining a single line of thought. You suffer a -1 skill check penalty on any activity that takes more than five minutes to complete.</p>",
  ),
  negative(
    "Energy Sink",
    [27, 28],
    "<p>You passively absorb the energy of energy cells and powered devices on your person. Each day, any energy cells or powered devices you carry have a 1 in 6 chance of having been drained when you first try to use them at a critical moment. You ignore the first 10 points of electrical damage you take each round.</p>",
  ),
  negative(
    "Feeble Joints",
    [29, 30],
    "<p>Your musculature is poorly anchored. Your Strength modifier suffers a -1 penalty and you are entirely incapable of jumping.</p>",
    { effects: [effect("Feeble Joints", [ch("system.abilities.str.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Feral Mind",
    [31, 32],
    "<p>You have a hard time dealing with abstract ideas. Your Intelligence modifier suffers a -1 penalty.</p>",
    { effects: [effect("Feral Mind", [ch("system.abilities.int.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Fragile System",
    [33, 34],
    "<p>You are exceptionally susceptible to environmental toxins. You take a -2 penalty to all saving throws versus poisons and diseases and your maximum System Strain is decreased by 2, to a minimum of 3.</p>",
    { effects: [effect("Fragile System", [ch("system.strain.max", "add", -2, "final")])] },
  ),
  negative(
    "Glowbug",
    [35, 36],
    "<p>Some significant part of you glows constantly, illuminating out to 10 meters and concealable only under whole-body wraps. The drain on your system applies a -1 Constitution modifier penalty. You automatically fail any Sneak checks involving unobtrusiveness, whether veiled or not.</p>",
    { effects: [effect("Glowbug", [ch("system.abilities.con.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Hemovore",
    [37, 38],
    "<p>You must drink several liters of mammalian blood each week in addition to normal food or you begin to starve. A sheep-sized mammal is enough to feed you, or thirty or so humans taking turns to donate.</p>",
  ),
  negative(
    "Insensate Flesh",
    [39, 40],
    "<p>You have an extremely muted sense of touch, including sensing heat or pressure. You suffer a -1 penalty to your hit point roll each level, to a minimum of 1 point, as you are less capable of noticing injuries and aggravate them easily.</p>",
    { effects: [effect("Insensate Flesh", [ch("system.hitDice.perLevelMod", "add", -1, "final")])] },
  ),
  negative(
    "Light Sensitivity",
    [41, 42],
    "<p>You can see normally in low-light conditions, but daylight is blinding to you without goggles or other protective gear, and you suffer 1 System Strain in sunburn for each hour of sun exposure without an enveloping cloak. Laser weapons roll damage twice against you, taking the higher result.</p>",
  ),
  negative(
    "Loose Limbs",
    [43, 44],
    "<p>Your limbs break off and regrow. You suffer a -1 Dexterity modifier and when Mortally Wounded or you intentionally break it off, you lose a randomly-chosen arm or leg. It regrows in 1d4 weeks.</p>",
    { effects: [effect("Loose Limbs", [ch("system.abilities.dex.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Low Resistances",
    [45, 46],
    "<p>The first time you make a Physical, Mental, or Evasion save in a day, roll it twice and take the worst result.</p>",
  ),
  negative(
    "Memory Damage",
    [47, 48],
    "<p>You&rsquo;re prone to losing chunks of memory not relevant to your current interests or activities. Your Intelligence modifier takes a -1 penalty and you cannot develop the Know skill.</p>",
    { effects: [effect("Memory Damage", [ch("system.abilities.int.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Miasmic Stench",
    [49, 50],
    "<p>You exude a stench that defies all conventional perfumes and fragrances, though your allies might eventually become numb to it. You fail any Sneak checks against creatures capable of smelling things and take a -1 penalty on all social skill checks. Insects and predatory animals will not recognize you as edible, though they may attack if you threaten them.</p>",
  ),
  negative(
    "Misshapen",
    [51, 52],
    "<p>Strangenesses of proportion and jointing make it impossible to wear armor or clothing that has not been tailored to you.</p>",
  ),
  negative(
    "Musclebound",
    [53, 54],
    "<p>Your physiology complicates movement. Your Dexterity modifier is reduced by 1.</p>",
    { effects: [effect("Musclebound", [ch("system.abilities.dex.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Narrow Focus",
    [55, 56],
    "<p>You have difficulty paying attention to your surroundings. Your Wisdom modifier suffers a -1 penalty and you cannot develop the Notice skill.</p>",
    { effects: [effect("Narrow Focus", [ch("system.abilities.wis.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Overtaxed Physique",
    [57, 58],
    "<p>Your mutations are more than your body can handle safely. Your maximum System Strain is lowered by 3 points, to a minimum of 3.</p>",
    { effects: [effect("Overtaxed Physique", [ch("system.strain.max", "add", -3, "final")])] },
  ),
  negative(
    "Place Blindness",
    [59, 60],
    "<p>You have profoundly poor navigational skills. While you can find your way around familiar places you&rsquo;ve lived in for at least a week, you will invariably become lost when traveling outside those areas unless guided.</p>",
  ),
  negative(
    "Poor Eyesight",
    [61, 62],
    "<p>Your eyes are too weak to make out anything more than 10 meters away from you. You cannot gain a positive Sensory mutation that improves your eyesight.</p>",
  ),
  negative(
    "Primitive Cognition",
    [63, 64],
    "<p>When you advance a character level, you gain one fewer skill point.</p>",
  ),
  negative(
    "Sensitive Skin",
    [65, 66],
    "<p>Your external integument can&rsquo;t handle heavy pressure or chafing. You can&rsquo;t wear armor of more than 1 Encumbrance and you gain 1 System Strain each day you wear any armor at all.</p>",
  ),
  negative(
    "Short Lifespan",
    [67, 68],
    "<p>Once you reach adulthood, your physical aging processes accelerate, though you do not become decrepit until your final year of life. At age 18 and each birthday afterwards, roll 1d100 and add your age. If the total is over 100, you&rsquo;re going to die in 1d4 years.</p>",
  ),
  negative(
    "Sleep Dependence",
    [69, 70],
    "<p>Adequate sleep is critical for you. If you don&rsquo;t get a good night&rsquo;s sleep for some reason, you gain 2 System Strain.</p>",
  ),
  negative(
    "Slow Development",
    [71, 72],
    "<p>You have great difficulty matching the skills of others. Pick a favorite skill; all others have a maximum skill level 1 less than usual for your level, to a minimum of level-0.</p>",
  ),
  negative(
    "Spindly",
    [73, 74],
    "<p>Your body is not built for raw power. Your Strength modifier is reduced by 1 and you cannot gain the Exert skill.</p>",
    { effects: [effect("Spindly", [ch("system.abilities.str.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Vexation Field",
    [75, 76],
    "<p>Subsonic or electro-neural emissions subconsciously irritate everyone around you. Friends and allies can ignore it. You suffer a -1 Charisma modifier penalty and cannot gain the Lead or Connect skills.</p>",
    { effects: [effect("Vexation Field", [ch("system.abilities.cha.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Voracious",
    [77, 78],
    "<p>If you don&rsquo;t consume at least two food rations a day, you are so distracted by hunger that you must make a Mental save to resist spending at least one round eating anything edible you encounter, including enemy bodies.</p>",
  ),
  negative(
    "Weak Heart",
    [79, 80],
    "<p>Sharp exertion quickly exhausts you. Your Constitution modifier suffers a -1 penalty, and all Exert skill checks are rolled twice and the worst taken.</p>",
    { effects: [effect("Weak Heart", [ch("system.abilities.con.baseMod", "add", -1, "initial")])] },
  ),
  negative(
    "Attribute Deficiency",
    [81, 90],
    "<p>Your lowest attribute suffers a -1 modifier penalty. If the lowest is tied, pick one. Reroll this mutation if its modifier is already at -2.</p>",
    { effects: abilityChoiceEffects("Attribute Deficiency", ["str", "dex", "con", "int", "wis", "cha"], -1) },
  ),
  negative(
    "Lightly Touched",
    [91, 100],
    "<p>Roll another negative mutation. It manifests so lightly, however, that it has no meaningful effect on you and applies no penalties.</p>",
  ),
];

// ---------------------------------------------------------------------------
// Stigma tables
// ---------------------------------------------------------------------------

/** @param {[number, number]} range @param {string} text */
function r(range, text) {
  return { range, text };
}

export const STIGMA_TABLES = {
  bodyPart: {
    name: "Stigma — Body Part",
    formula: "1d6",
    results: [
      r([1, 1], "Head"),
      r([2, 2], "Arm or Arms"),
      r([3, 3], "Leg or Legs"),
      r([4, 4], "Torso"),
      r([5, 5], "Eyes, Ears, or Hands"),
      r([6, 6], "Roll again and add that extra part"),
    ],
  },
  nature: {
    name: "Stigma — Nature of the Mutation",
    formula: "1d6",
    results: [
      r([1, 1], "Odd appearance or texture"),
      r([2, 2], "Animalistic structure"),
      r([3, 3], "Abnormal size or proportion"),
      r([4, 4], "Plant-like structure"),
      r([5, 5], "Amorphous or tentacular structure"),
      r([6, 6], "Inorganic or mineralized structure"),
    ],
  },
  textures: {
    name: "Stigma — Textures",
    formula: "1d12",
    results: [
      r([1, 1], "Chitinous"),
      r([2, 2], "Feathered"),
      r([3, 3], "Fibrous"),
      r([4, 4], "Finned"),
      r([5, 5], "Furred"),
      r([6, 6], "Glassy"),
      r([7, 7], "Metallic"),
      r([8, 8], "Plated"),
      r([9, 9], "Scabrous"),
      r([10, 10], "Scaled"),
      r([11, 11], "Slimy"),
      r([12, 12], "Stony"),
    ],
  },
  appearance: {
    name: "Stigma — Appearance",
    formula: "1d12",
    results: [
      r([1, 1], "Bright Solid Hue"),
      r([2, 2], "Chromed"),
      r([3, 3], "Gemlike"),
      r([4, 4], "Gradient Hue"),
      r([5, 5], "Iridescent"),
      r([6, 6], "Luminescent"),
      r([7, 7], "Neon"),
      r([8, 8], "Opalescent"),
      r([9, 9], "Patchy Coloring"),
      r([10, 10], "Strobing Colors"),
      r([11, 11], "Transparent Skin"),
      r([12, 12], "Whorled"),
    ],
  },
  animal: {
    name: "Stigma — Animal Influence",
    formula: "1d12",
    results: [
      r([1, 1], "Beetle"),
      r([2, 2], "Bird"),
      r([3, 3], "Bovine"),
      r([4, 4], "Canine"),
      r([5, 5], "Equine"),
      r([6, 6], "Feline"),
      r([7, 7], "Fish"),
      r([8, 8], "Lizard"),
      r([9, 9], "Mollusk"),
      r([10, 10], "Snake"),
      r([11, 11], "Spider"),
      r([12, 12], "Turtle"),
    ],
  },
  plant: {
    name: "Stigma — Plant Influence",
    formula: "1d12",
    results: [
      r([1, 1], "Bark"),
      r([2, 2], "Flowers"),
      r([3, 3], "Fragrance"),
      r([4, 4], "Fronds and tendrils"),
      r([5, 5], "Fungal masses"),
      r([6, 6], "Gnarled tissues"),
      r([7, 7], "Insect infestation"),
      r([8, 8], "Leaf growth"),
      r([9, 9], "Mosses or lichens"),
      r([10, 10], "Pollen growth"),
      r([11, 11], "Sap exudation"),
      r([12, 12], "Vegetative texture"),
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function allMutations() {
  return [...POSITIVE_MUTATIONS, ...NEGATIVE_MUTATIONS];
}
