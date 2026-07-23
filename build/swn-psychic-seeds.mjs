/**
 * SWN psychic technique seed data for abilities-swn pack generation.
 *
 * Source: reference/temp/SWN-Psychic-Powers.txt (SWN Revised edition psychic chapter).
 * Mechanical text is copied/lightly cleaned from the book; HTML descriptions use
 * &lt;p&gt; paragraphs and Level-N blocks for core techniques.
 *
 * Consumed by build/generate-swn-psychic.mjs.
 */
import { randomId } from "./pack-folder-paths.mjs";

export const PSYCHIC_IMG = "systems/wwn/assets/icons/items/art.png";

export const DISCIPLINES = {
  biopsionics: "Biopsionics",
  metapsionics: "Metapsionics",
  precognition: "Precognition",
  telekinesis: "Telekinesis",
  telepathy: "Telepathy",
  teleportation: "Teleportation",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} discipline
 * @param {string} name
 * @param {number} level
 * @param {string} description
 * @param {object} [opts]
 */
function tech(discipline, name, level, description, opts = {}) {
  return {
    id: randomId(`swn-psy-${discipline}-${name}`),
    name,
    discipline,
    level,
    isCore: !!opts.isCore,
    description,
    commitmentOptions: opts.commitmentOptions ?? [{ cost: 0, length: "none", note: "" }],
    userStrain: opts.userStrain ?? "",
    targetStrain: opts.targetStrain ?? "",
    activation: opts.activation,
    damageRoll: opts.damageRoll ?? "",
    healing: !!opts.healing,
  };
}

/** @param {string} [note] */
function day(note = "") {
  return [{ cost: 1, length: "day", note }];
}

/** @param {string} [note] */
function scene(note = "") {
  return [{ cost: 1, length: "scene", note }];
}

/** @param {string} [note] */
function active(note = "") {
  return [{ cost: 1, length: "active", note }];
}

/** @param {string} [note] */
function none(note = "") {
  return [{ cost: 0, length: "none", note }];
}

/**
 * Build HTML description from intro paragraph(s) and optional Level-0..4 blocks.
 * @param {string|string[]} intro
 * @param {Record<number, string>} [levels]
 */
function desc(intro, levels = {}) {
  const paras = (Array.isArray(intro) ? intro : [intro]).map((t) => `<p>${t}</p>`);
  for (const n of [0, 1, 2, 3, 4]) {
    if (levels[n]) paras.push(`<p><strong>Level-${n}:</strong> ${levels[n]}</p>`);
  }
  return paras.join("");
}

/** @param {string} text */
function p(text) {
  return `<p>${text}</p>`;
}

// ---------------------------------------------------------------------------
// Biopsionics (12)
// ---------------------------------------------------------------------------

const BIOPSIONICS = [
  tech(
    "biopsionics",
    "Psychic Succor",
    0,
    desc(
      [
        "Biopsionic powers repair, augment, debilitate, or damage living creatures. Unless otherwise specified the biopsionicist must be able to touch a target, though clothing and armor do not interfere with the use of these abilities. Touching a willing or unsuspecting target is automatic, whereas touching a resisting target requires a normal Punch hit roll with a bonus equal to the practitioner's Biopsionics skill. Such touch effects do not inflict the normal damage of a Punch attack.",
        "The adept's touch stabilizes critically-wounded organisms. More sophisticated practitioners can heal tissue injuries, though curing diseases, detoxifying poisons, and fixing congenital deformities require additional techniques. Each use of Psychic Succor adds one point of System Strain to the target, or two points if they were mortally wounded at the time.",
        "Activating Psychic Succor requires the biopsion to Commit Effort for the day. Once used, they can continue to use it for the rest of that scene without Committing Effort again.",
        "System Strain is a measure of the amount of system stress, intrusive modification, and general biological distress an organism might be suffering. Psionic healing, cybernetic implants, and powerful drugs all add to a target's System Strain. If using a power or drug on a target would make their System Strain exceed their Constitution score, the effect fails to function; their body simply cannot adapt to the changes and cannot benefit from them. System Strain decreases automatically by one point after each night of rest, provided the organism is well-fed and not compromised by sickness or privation.",
      ],
      {
        0: "The psychic's touch can automatically stabilize a mortally-wounded target as a Main Action. This power must be used on a target within six rounds of their collapse, and does not function on targets that have been decapitated or killed by Heavy weapons. It's the GM's decision as to whether a target is intact enough for this power to work.",
        1: "As level-0, and heal 1d6+1 hit points of damage. If used on a mortally-wounded target, they revive with the rolled hit points and can act normally on the next round.",
        2: "As level-1, but healing 2d6+2 hit points instead.",
        3: "As level-2, but healing 2d6+6 hit points instead.",
        4: "As level-3, but healing 3d6+8 hit points instead.",
      },
    ),
    {
      isCore: true,
      commitmentOptions: day(),
      targetStrain: "1,2",
      healing: true,
      activation: { roll: "Main Action" },
      damageRoll: "1d6+1",
    },
  ),
  tech(
    "biopsionics",
    "Mastered Succor",
    1,
    p(
      "The biopsion has developed a sophisticated mastery of their core ability, and they no longer need to Commit Effort to activate it, and may use it whenever they wish. The use of additional techniques that augment Psychic Succor might still require Effort to be Committed.",
    ),
    { commitmentOptions: none() },
  ),
  tech(
    "biopsionics",
    "Organic Purification Protocols",
    1,
    p(
      "The biopsion's Psychic Succor now cures any poisons or diseases the subject may be suffering, albeit it requires Committing Effort for the day as an additional surcharge. Biowarfare organisms, exceptionally virulent diseases, or TL5 toxins may resist this curing, requiring a Wis/Biopsionics skill check at a difficulty of at least 10. Failure means that the adept cannot cure the target's disease. This technique cannot cure congenital illnesses.",
    ),
    { commitmentOptions: day("Additional surcharge when curing poisons or diseases") },
  ),
  tech(
    "biopsionics",
    "Remote Repair",
    1,
    p(
      "Psychic Succor and other biopsionic techniques that normally require touch contact can now be applied at a distance up to 100 meters, provided the biopsion can see the target with their unaided vision. Hostile powers that normally require a hit roll will hit automatically. Each time this technique is used, Effort must be Committed for the scene.",
    ),
    { commitmentOptions: scene() },
  ),
  tech(
    "biopsionics",
    "Invincible Stand",
    2,
    p(
      "The biopsion has mastered techniques of emergency tissue reinforcement and system stabilization. As an Instant action, they can Commit Effort for the scene to keep themself or a target they can touch active even at zero hit points. This technique must be used once every round on the target or they collapse at the end of the round. If the target suffers hit point damage, the biopsion must Instantly Commit Effort for the scene or the target goes down immediately with a mortal wound. A Heavy weapon hit on a subject of this power or similar physical dismemberment will always kill a target, regardless of this technique.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Instant action" } },
  ),
  tech(
    "biopsionics",
    "Major Organ Restoration",
    2,
    p(
      "The biopsion's Psychic Succor can now cure congenital birth defects and regrow missing limbs and organs. It can even be used to stabilize targets that have been dropped by Heavy weapons, decapitated, or otherwise dramatically dismembered, provided it's used within one round per level of Biopsionic skill. The best that can be done for such badly-mangled targets is stabilization, after which they must rest for 24 hours before any further hit points can be healed by Biopsionics, stims, or natural rest.",
    ),
  ),
  tech(
    "biopsionics",
    "Tissue Integrity Field",
    2,
    p(
      "The biopsion's Psychic Succor may now also affect all allies within ten meters of the target. Allies can decline the healing if they don't require it or don't want to take the additional System Strain. Each use of this technique requires that the biopsion Commit Effort for the day in addition to the cost of the Psychic Succor.",
    ),
    { commitmentOptions: day("In addition to Psychic Succor cost") },
  ),
  tech(
    "biopsionics",
    "Accelerated Succor",
    3,
    p(
      "The biopsion's Psychic Succor now can be used as an On Turn power, albeit only once per round. By Committing an additional Effort for the day with each use, it can even be used as an Instant power, though it still can only be used once per round. Any surcharges for augmenting the succor apply normally, such as with Tissue Integrity Field.",
    ),
    {
      commitmentOptions: [
        { cost: 0, length: "none", note: "On Turn use (inherits Succor commitment)" },
        { cost: 1, length: "day", note: "Additional surcharge for Instant use" },
      ],
      activation: { roll: "On Turn action" },
    },
  ),
  tech(
    "biopsionics",
    "Metamorph",
    3,
    p(
      "The biopsion can now shape their own or another willing target's physical form as a Main Action, transforming a touched target into any humanoid form within 50% of their own mass. Claws and other body armaments can be fashioned equivalent to Light or Medium melee weapons and innate armor equivalent to AC 13. Gills and other environmental-survival alterations are also viable at the GM's discretion, but flight is a bridge too far for this power. A person can be impersonated down to the DNA level, provided a blood or hair sample is available. The use of this adds one System Strain point to the target that does not recover so long as the change is in effect. Applying Metamorph requires that the biopsion Commit Effort for as long as the change is to be maintained. If applied to a target other than the psychic, the power automatically ends if the psychic gets more than one hundred kilometers away.",
    ),
    { commitmentOptions: active(), targetStrain: "1", activation: { roll: "Main Action" } },
  ),
  tech(
    "biopsionics",
    "Teratic Overload",
    3,
    p(
      "This use of biopsionics inflicts potentially-lethal damage on a touched target as a Main Action, and requires that the biopsion Commit Effort for the scene. The target suffers 1d6 damage per level of the psychic's Biopsionics skill and must make a Physical saving throw. On a failure, the damage is tripled and the target is now affected by an obvious, lethal cancer that will kill them in 1d6 months. The cancer can be treated by a TL4 hospital or ship's sick bay if managed within a month's time. If the biopsion Commits Effort for the day instead of the scene, they can control the power sufficiently to do no hit point damage and create very subtle tumors, leaving the cancer undetectable without a TL4 medical examination. Such victims probably won't even know they've been attacked by this power. Whether a success or failure, this power cannot be used on the same target more than once per scene.",
    ),
    {
      commitmentOptions: [
        { cost: 1, length: "scene", note: "Normal lethal use" },
        { cost: 1, length: "day", note: "Subtle tumors, no hit point damage" },
      ],
      activation: { roll: "Main Action", save: "Physical" },
      damageRoll: "1d6 per Biopsionics skill level",
    },
  ),
  tech(
    "biopsionics",
    "Holistic Optimization Patterning",
    4,
    p(
      "The biopsion gains the ability to drastically augment their own or a touched ally's physical abilities as an On Turn action. This boost lasts for the rest of the scene, adds two points of System Strain to the target and gives them a +2 bonus to all Strength or Dexterity skill checks, hit rolls, and damage rolls along with 20 extra hit points. Any damage is taken off these temporary hit points first, and both the bonuses and any hit points in excess of the target's maximum are lost at the end of the scene. Each invocation of this technique requires the biopsion to Commit Effort for the day, and this power cannot be used on a given target more than once per scene.",
    ),
    { commitmentOptions: day(), targetStrain: "2", activation: { roll: "On Turn action" } },
  ),
  tech(
    "biopsionics",
    "Quintessential Reconstruction",
    4,
    p(
      "The biopsion becomes extremely difficult to kill, encoding their mind in a coherent pattern of MES energy coterminous with their realspace coordinates. If killed, the psychic will regenerate from the largest remaining fragment of their body over 24 hours. This process maximizes their System Strain for one week. If brought to zero hit points during this week, they die instantly and permanently. The psychic retains a vague awareness of their surroundings while \"dead\" and can postpone their regeneration for up to a week in order to avoid notice, but burial or entombment may result in a very short second life. Each use of this power inflicts one point of permanent attribute loss in an attribute of the biopsion's choice.",
    ),
  ),
];

// ---------------------------------------------------------------------------
// Metapsionics (13)
// ---------------------------------------------------------------------------

const METAPSIONICS = [
  tech(
    "metapsionics",
    "Psychic Refinement",
    0,
    desc(
      [
        "Metapsionics is the rarest and most esoteric of the psychic disciplines, with few psychics having the necessary temperament or interest in developing these complex abilities. A metapsion controls psychic energy itself, molding and shaping the flows of energy that spill through the brains of those marked by MES.",
        "The metapsion gains improved mastery over their own powers and an innate sensitivity to the use of psionic abilities in their presence.",
      ],
      {
        0: "The adept can visually and audibly detect the use of psychic powers. If both the source and target are visible to the metapsion, they can tell who's using the power, even if it's normally imperceptible. They gain a +2 bonus on any saving throw versus a psionic power.",
        1: "The metapsion's maximum Effort increases by an additional point.",
        2: "The adept can determine whether or not a person is a psychic or has latent psionic abilities through one round of visual inspection. Their saving throw bonus against psionic powers increases to +3.",
        3: "The metapsion's maximum Effort increases by an additional point.",
        4: "The metapsion can perform a slightly safer version of torching. Instead of rolling the torching damage die, they simply suffer 10 hit points of damage after torching is used. The damage occurs after the fueled power activates, allowing a psychic at low hit points to trigger a power before falling unconscious. This damage cannot be healed by anything but natural bed rest, though a psychic can be stabilized if this technique drops her to zero hit points.",
      },
    ),
    { isCore: true, commitmentOptions: none() },
  ),
  tech(
    "metapsionics",
    "Cloak Powers",
    1,
    p(
      "The metapsion can conceal their own psychic abilities from metapsionic senses. They must Commit Effort for as long as they wish to cloak their powers. While hidden, only a metapsion with equal or higher skill in Metapsionics can detect their abilities with their level-0 or level-2 Psychic Refinement abilities. In such cases, an opposed Wis/Metapsionics roll is made between the metapsion and the investigator. If the investigator wins, the cloak is pierced, while if the metapsion wins, the investigator's Psychic Refinement remains oblivious.",
    ),
    { commitmentOptions: active() },
  ),
  tech(
    "metapsionics",
    "Mindtracing",
    1,
    p(
      "The metapsion can trace back the use of psionic powers they've noticed in their presence. By Committing Effort for the scene as an Instant action, they can see and hear through the senses of a user of a psychic power, gaining an intuitive awareness of their location and treating them as a visible target for purposes of their own abilities. Thus, if they see someone being affected by a telepathy power with no visible source, they can use this ability to briefly share the hidden telepath's senses. If used on a target that is teleporting, they can perceive the teleporter's view of their destination. Use on a metamorphically-shaped impostor would reveal the biopsion responsible for the change, and so forth. These shared senses last for only one round and do not interfere with the adept's other actions.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Instant action" } },
  ),
  tech(
    "metapsionics",
    "Synthetic Adaptation",
    1,
    p(
      "This is a particularly esoteric technique, one that requires the adept to have at least Program-0 or Fix-0 skill in order to master. With it, however, the metapsion has learned how to synergize with the quantum intelligence of a VI or True AI in order to apply Telepathy or Biopsion powers to their inanimate corpus. Only intelligent machines can be affected, as the technique requires a sentient mind to catalyze the effect. This synergy takes much of its force from the adept. Any System Strain the powers might inflict must be paid by the adept rather than the target.",
    ),
  ),
  tech(
    "metapsionics",
    "Neural Trap",
    2,
    p(
      "The metapsion allows a hostile psychic into their mental sanctum in order to gain a later advantage. When targeted by a hostile psionic power that allows a save, the metapsion may Commit Effort as an Instant action and voluntarily fail the saving throw, accepting the effect. The next psychic power the user targets at that assailant then allows the victim no saving throw. This technique lasts until the metapsion makes their psychic attack or reclaims their Committed Effort. A hostile psychic may be affected by only one Neural Trap from a given psychic at a time.",
    ),
    { commitmentOptions: active(), activation: { roll: "Instant action" } },
  ),
  tech(
    "metapsionics",
    "Psychic Static",
    2,
    p(
      "As an Instant action, the metapsion may Commit Effort for the day to negate a perceived psychic power. The psychic responsible for the effect must Commit Effort for the day as an Instant action to resist this negation, otherwise the power ends and any action used to trigger it is wasted. The PC may then Commit Effort for the day again, with each spending and counter-spending until one runs out of Effort or chooses to stop. Psychic Static can be applied only once per round to any particular power. The target of the Psychic Static automatically knows the position of the interfering metapsion, though other onlookers do not have any obvious way of identifying the metapsion.",
    ),
    { commitmentOptions: day(), activation: { roll: "Instant action" } },
  ),
  tech(
    "metapsionics",
    "Suspended Manifestation",
    2,
    p(
      "The metapsion is capable of \"hanging\" a psychic power in their brain, forming the energy patterns and then suspending them in a self-sustaining loop until it's time to trigger their release. The psychic must Commit Effort for the day to hang a power, along with the Effort normally necessary to trigger it. None of this Effort can be recovered until the power is expended, after which it recovers at its usual speed. Activating the power is an Instant action, or an On Turn action if it allows the target a saving throw of some kind. Only one ability can be held suspended at any one time.",
    ),
    { commitmentOptions: day("Plus Effort normally required to trigger the hung power") },
  ),
  tech(
    "metapsionics",
    "Concert of Minds",
    3,
    p(
      "As an On Turn action, the metapsion may Commit Effort and form a psychic gestalt with one or more willing psychics within three meters, including up to one other psychic per Metapsion skill level. This gestalt persists as long as the Effort remains committed, regardless of the subsequent distance between psychics. On their own turn, any member of the gestalt may use any power or technique known by any other member, using the other member's skill levels as necessary and paying any Effort cost from their own pool. This gestalt shares only psychic power, not thoughts or senses. At the end of each round in which one or more members have used some other member's powers or abilities on their turn of action, the metapsion must Commit Effort for the scene or the gestalt drops and cannot be re-established for the rest of the scene.",
    ),
    {
      commitmentOptions: [
        { cost: 1, length: "active", note: "Initial gestalt formation" },
        { cost: 1, length: "scene", note: "Renew each round powers are shared" },
      ],
      activation: { roll: "On Turn action" },
    },
  ),
  tech(
    "metapsionics",
    "Psychic Tutelage",
    3,
    p(
      "An expert metapsion can modulate and temper the metadimensional energy that surges through an untrained psychic's mind. This \"safety buffer\" allows the novice to experiment with their abilities and gradually develop the control they need to channel their powers without causing permanent brain damage. Without this technique, it is virtually impossible to turn a normal with untapped potential into a trained psychic. An adept with Metapsionics-3 skill can train up to ten pupils at once. One with Metapsionics-4 can train up to one hundred. It requires only a week to train a potential in ways to avoid accidentally triggering their powers and suffering the damage that follows, but actually teaching them to use their powers effectively takes anywhere from one to four years depending on their natural aptitude and the availability of other psychics willing to assist the metapsion in the training process.",
    ),
  ),
  tech(
    "metapsionics",
    "Surge Momentum",
    3,
    p(
      "The metapsion's abilities can be reinforced with a degree of metadimensional energy that would cause substantial damage to a less adept mind. Particularly weak or unprepared minds might be completely crushed by the force of the adept's augmented will. The adept must Commit Effort for the day when using a power that normally grants its target a saving throw. The target then suffers a penalty equal to the adept's Metapsionics skill on any saving throw normally granted by the power. If the target's hit die total or character level is less than half the adept's level, rounded up, they automatically fail their saving throw.",
    ),
    { commitmentOptions: day("When using a power that grants a saving throw") },
  ),
  tech(
    "metapsionics",
    "Metadimensional Friction",
    3,
    p(
      "As a Main Action, the metapsion Commits Effort for the scene to create localized MES turbulence around a visible target psychic within 200 meters. Each time the target Commits Effort or an NPC initiates a psychic power, they suffer 1d8 damage per Metapsionics skill level of the adept. Each time the target suffers the damage they can attempt a Mental saving throw to throw off the effect. It lasts no longer than the rest of the scene at most. Only one application of this friction can affect a target at once.",
    ),
    {
      commitmentOptions: scene(),
      activation: { roll: "Main Action", save: "Mental", range: "200m" },
      damageRoll: "1d8 per Metapsionics skill level",
    },
  ),
  tech(
    "metapsionics",
    "Flawless Mastery",
    4,
    p(
      "When this technique is learned, the adept may choose one technique from any discipline they know. That technique no longer requires Effort to be Committed in any way, though other techniques that augment it may still exact a cost. Mastered Psychic Static, for example, can expend an effectively unlimited amount of effort. If the technique has a duration based on Committed Effort then it lasts until the metapsion chooses to end it or is killed. This technique may only be mastered once, though the perfected technique may be changed with a month of meditation and practice.",
    ),
  ),
  tech(
    "metapsionics",
    "Impervious Pavis of Will",
    4,
    p(
      "When this technique is learned, the metapsion must choose a discipline. They then become entirely immune to unwanted powers from that discipline; they and their abilities are simply not valid targets for purposes of that discipline's powers unless the adept chooses to be affected. By Committing Effort for the day as an Instant action, they can extend this immunity for a scene to all allies within 50 meters. This technique may be learned more than once, and any shared protection applies to all disciplines negated by the adept.",
    ),
    {
      commitmentOptions: [
        { cost: 0, length: "none", note: "Passive immunity to chosen discipline" },
        { cost: 1, length: "day", note: "Extend immunity to allies within 50m for the scene" },
      ],
      activation: { roll: "Instant action", range: "50m" },
    },
  ),
];

// ---------------------------------------------------------------------------
// Precognition (11)
// ---------------------------------------------------------------------------

const PRECOGNITION = [
  tech(
    "precognition",
    "Oracle",
    0,
    desc(
      [
        "The discipline of Precognition relates to sensing the cascade of future events and reading the achronal chaos of the metadimensional energy that ripples in the psychic's brain. Readings provided by Precognition tend to be focused on the psychic and what they find interesting or important. Matters irrelevant to the seer are unlikely to be noticed, even if they are of critical importance to those involved. More advanced techniques of Precognition can even influence the future, adjusting probabilities by changing or pruning certain metadimensional currents.",
        "The precog gains a progressively-greater intuitive understanding of their own future. Each invocation of the Oracle technique requires a Main Action and that the user Commit Effort for the day. Once triggered, the adept gets a single brief vision related to the question about the future that they're asking. This vision is always from their own personal vantage point and never reveals more than a minute of insight, though the psychic processes it almost instantly as part of the power's use.",
        "The GM should answer the question as if the PC were about to perform the act or engage in the investigation pertinent to the question. Visions should relate to actions and events, not abstract facts. Only the most important or significant information is conveyed by the technique, even if multiple events of interest might transpire during the time horizon. Oracle can only be used on a given question or topic once until the situation changes substantially or a week goes by. The maximum time horizon of the Oracle increases as the adept's Precognition skill improves.",
      ],
      {
        0: "One minute into the future.",
        1: "One day into the future.",
        2: "One week into the future.",
        3: "Three months into the future.",
        4: "One year into the future.",
      },
    ),
    { isCore: true, commitmentOptions: day(), activation: { roll: "Main Action" } },
  ),
  tech(
    "precognition",
    "Intuitive Response",
    1,
    p(
      "As an Instant action, the precog can Commit Effort for the scene just before they roll initiative. Their initiative score is treated as one better than anyone else's involved in the scene. If another participant has this power or some other ability that grants automatic initiative success, roll initiative normally to determine which of them goes first, and then the rest of the combatants act. This ability cannot be used if the precog has been surprised.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Instant action" } },
  ),
  tech(
    "precognition",
    "Sense the Need",
    1,
    p(
      "At some point in the recent past, the psychic had a vague but intense premonition that a particular object would be needed. By triggering this power as an Instant action and Committing Effort for the day, the psychic can retroactively declare that they brought along any one object that they could have reasonably acquired and carried to this point. This object must be plausible given recent events; if the psychic has just been strip-searched, very few objects could reasonably have been kept, while a psychic who's just passed through a weapons check couldn't still have a loaded laser pistol.",
    ),
    { commitmentOptions: day(), activation: { roll: "Instant action" } },
  ),
  tech(
    "precognition",
    "Terminal Reflection",
    1,
    p(
      "The psychic's Oracle power automatically triggers as an Instant action moments before some unexpected danger or ambush, giving the precog a brief vision of the impending hazard. This warning comes just in time to avoid springing a trap or to negate combat surprise for the precog and their companions. If the psychic does not immediately Commit Effort for the day, this sense goes numb and this technique cannot be used for the rest of the day.",
    ),
    { commitmentOptions: day("If not committed immediately after the vision") },
  ),
  tech(
    "precognition",
    "Alternate Outcome",
    2,
    p(
      "The precog can sense impending failure and attempt to salvage the action. As an Instant action, the precog can target a visible ally or their own self and Commit Effort for the day to allow the target to reroll a failed hit roll, saving throw, or skill check, taking the better of the two rolls. This power disrupts delicate lines of probability, however, and cannot be used on any given target more than once a day.",
    ),
    { commitmentOptions: day(), activation: { roll: "Instant action" } },
  ),
  tech(
    "precognition",
    "Destiny's Shield",
    2,
    p(
      "The precog observes an incoming injury and tries to find an alternate future in which the attack misses. As an Instant action, the precog can Commit Effort for the day to force an attacker to reroll a successful hit roll. This technique only works on attacks against the psychic's person, not against attacks aimed at a vehicle they're occupying or harm that doesn't involve an attack roll. If the rerolled attack still hits, however, the damage done is maximized. This technique can be used only once per incoming attack.",
    ),
    { commitmentOptions: day(), activation: { roll: "Instant action" } },
  ),
  tech(
    "precognition",
    "Anguished Vision",
    3,
    p(
      "The adept's precognition is sophisticated enough to clearly foresee several seconds into the future. As an Instant action, the psychic may Commit Effort for the day and declare that what they have just done or seen is a vision of the immediate future. Time rolls back to the start of the initiative count in a combat turn, or six seconds earlier if out of combat. Nothing that happened during that round has really come to pass yet. This ability is tremendously draining, and can be used only once per day.",
    ),
    { commitmentOptions: day(), activation: { roll: "Instant action" } },
  ),
  tech(
    "precognition",
    "Cursed Luck",
    3,
    p(
      "Negative probabilities are woven tightly around a visible animate target, including robots and animals but not including vehicles. Triggering this technique requires a Main Action and Committing Effort for the scene. The target must roll any attack rolls, damage rolls, skill checks, and saving throws twice and take the worst result each time. Any attempts to hit the target or damage dice rolled against it may be rolled twice and the better result taken. Intelligent targets can make a Mental saving throw at the end of each round to throw off the effect; this save is not penalized by the power.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Main Action", save: "Mental" } },
  ),
  tech(
    "precognition",
    "Forced Outcome",
    3,
    p(
      "Through careful manipulation of probability, the adept can influence random physical events in their vicinity. Triggering this technique requires a Main Action and Committing Effort for the scene. Any simple, random mechanical outcome can be completely controlled for the scene, such as a roulette wheel or the order of a deck of shuffled cards. Any other physical event in the area that seems not-entirely-implausible may be made to occur by this technique, provided it doesn't involve more than a few objects and doesn't require human involvement. The GM decides what random events are and are not adequately possible. Anything more than one unusual coincidence or chance per scene is likely impossible to produce.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Main Action" } },
  ),
  tech(
    "precognition",
    "Not My Time",
    4,
    p(
      "The precog instinctively wrenches the lines of probability away from futures in which they are about to die. This technique triggers automatically when the precog is about to die, provided they can Commit Effort for the day. On triggering, random events somehow conspire to leave the precog alive, even if outrageous coincidences and ridiculous luck are required. Provided the precog doesn't intentionally thrust herself back into danger, their life is secured for the next few minutes at least, though there's no guarantee the psychic will survive intact in mind or body. This technique can trigger no more often than once per week.",
    ),
    { commitmentOptions: day("Automatic trigger when about to die") },
  ),
  tech(
    "precognition",
    "Prophecy",
    4,
    p(
      "The power of the precog extends to dictating future events that directly involve them. As a Main Action, the precognitive PC may make one prediction involving their personal future or future condition within the next year. Provided they take reasonable measures to enable this prediction, that no direct resistance is mounted by an enemy, and that the prediction doesn't seem highly improbable to the GM, it will come to pass. The adept must Commit Effort when this power is used, and the Effort remains Committed until the prophecy comes to pass or is abandoned. This ability cannot be used more than once per month and only one prophecy may be active at a time.",
    ),
    { commitmentOptions: active("Until prophecy comes to pass or is abandoned"), activation: { roll: "Main Action" } },
  ),
];

// ---------------------------------------------------------------------------
// Telekinesis (13)
// ---------------------------------------------------------------------------

const TELEKINESIS = [
  tech(
    "telekinesis",
    "Telekinetic Manipulation",
    0,
    desc(
      [
        "Telekinetic abilities are something of a mixed blessing to those psychics who have them. While they are among the least feared and distrusted of psychic powers, they also produce effects that are not nearly so widely-demanded as biopsionic healing or metapsionic brainguarding.",
        "Telekinetic powers are strong but somewhat imprecise. The force they generate is usually invisible, though a psychic can allow a visible glow if desired, and the source of the telekinetic manipulation is not obvious to ordinary senses. Objects being held or worn by a mobile creature cannot normally be manipulated by telekinesis, nor can unwilling intelligent targets be directly manipulated. Machines, including non-sentient robots, can be affected as any other inanimate object, however. The psychic cannot use this discipline to lift their own person without special techniques.",
        "Some techniques refer to a \"physical attack\" or \"physical damage\". This means a straightforward kinetic impact: bullets, punches, collisions, falls, compressions, or the like. Energy attacks are not included.",
        "The adept may Commit Effort for the scene as a Main Action to direct telekinetic force toward an object or person within unaided visual range or with tactile contact with the psychic. This force isn't responsive enough to be effective as a weapon without further refinement of technique, and cannot cause damage to living or mobile targets. If used to crush or harm immobile unliving objects, it does 1d6 damage per skill level of the psychic per round of focus. Objects move at 20 meters per round when moved telekinetically. A telekinetic force can be maintained over multiple rounds without expending further actions, such as holding a metal platform in place under a group of allies, but the psychic cannot again activate this technique on a second object until they release the first.",
      ],
      {
        0: "The psychic can exert force as if with one hand and their own strength.",
        1: "The psychic can manipulate objects as if with both hands and can lift up to two hundred kilograms with this ability.",
        2: "The psychic can lift or manipulate up to four hundred kilograms and smash a human-sized hole in structures of light wooden construction or lighter as a Main Action.",
        3: "The psychic can manipulate up to eight hundred kilograms and can affect as many individual objects at once as they have Telekinesis skill levels.",
        4: "The psychic can manipulate up to a metric ton and can smash human-sized holes in TL4-constructed exterior walls, light stone walls, or similar barriers as a Main Action.",
      },
    ),
    { isCore: true, commitmentOptions: scene(), activation: { roll: "Main Action" } },
  ),
  tech(
    "telekinesis",
    "Kinetic Transversal",
    1,
    p(
      "The adept may Commit Effort as an On Turn action to move freely over vertical or overhanging surfaces as if they were flat ground, crossing any solid surface strong enough to bear five kilos of weight. They can also move over liquids at their full movement rate. This movement ability lasts as long as the Effort is committed.",
    ),
    { commitmentOptions: active(), activation: { roll: "On Turn action" } },
  ),
  tech(
    "telekinesis",
    "Pressure Field",
    1,
    p(
      "As an Instant action, the adept can manifest a protective force skin around their person equivalent to a vacc suit, maintaining pressure and temperature even in hard vacuum conditions. They can ignore temperatures at a range of plus or minus 100 degrees Celsius and automatically pressurize thin atmospheres for breathability, or filter particulates or airborne toxins. By Committing Effort for the scene, they can shield up to six comrades. This lasts until the user reclaims the Effort.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Instant action" } },
  ),
  tech(
    "telekinesis",
    "Telekinetic Armory",
    1,
    p(
      "The adept may Commit Effort as an On Turn action to create both weapons and armor out of telekinetic force. These weapons are treated as tech level 4 and act as a rifle or any advanced melee weapon. Attack rolls can use either Dexterity, Wisdom, or Constitution modifiers, and may use the Telekinesis skill as the combat skill. Armor may be created as part of this power, granting the psychic a base Armor Class equal to 15 plus their Telekinesis skill level. This armor does not stack with conventional armor, but Dexterity or shields modify it as usual. The gear continues to exist as long as the psychic chooses to leave the Effort committed, and they may be invisible or visible at the psychic's discretion.",
    ),
    { commitmentOptions: active(), activation: { roll: "On Turn action" } },
  ),
  tech(
    "telekinesis",
    "Impact Sump",
    2,
    p(
      "The adept may Commit Effort for the day as an Instant action to negate a single instance of physical damage. This ability is too taxing to be used more than once per day, but as an Instant action, it can be triggered even after damage is rolled.",
    ),
    { commitmentOptions: day(), activation: { roll: "Instant action" } },
  ),
  tech(
    "telekinesis",
    "Slip Field",
    2,
    p(
      "As a Main Action, the psychic Commits Effort for the scene and decreases the friction at a point in sight. Up to ten meters in diameter is affected, making it difficult for enemies to move from their current position. All chosen targets must make an Evasion saving throw or fall prone, becoming unable to stand up or move more than a meter per Move action taken. If used against a ground vehicle, the driver must make a Dex/Pilot skill check at a difficulty of 8 plus the adept's Telekinesis skill or go out of control, driving directly forward for a round and crashing into any obstacles. Targets who save are immune to this technique for the scene.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Main Action", save: "Evasion" } },
  ),
  tech(
    "telekinesis",
    "Telekinetic Expertise",
    2,
    p(
      "The adept has become familiar enough with the manipulation of telekinetic force that they may now use Telekinetic Manipulation without Committing Effort.",
    ),
  ),
  tech(
    "telekinesis",
    "Thermokinesis",
    2,
    p(
      "Telekinetic power involves kinetic energy, but a sufficiently sophisticated grip on motion can be used to agitate the molecules of an inanimate object and cause it to melt or burst into flame. Similar focus can chill or freeze such substances. Applying Thermokinesis to a target requires that the adept Commit Effort for the scene as a Main Action. Thermokinesis cannot affect objects larger than the adept could lift with their Telekinetic Manipulation. As with other telekinetic powers, this ability does not work on objects being held or used by intelligent creatures. Non-sentient robots or other objects with hit points take 1d12 damage per level of Telekinesis skill each time this technique is applied to them.",
    ),
    {
      commitmentOptions: scene(),
      activation: { roll: "Main Action" },
      damageRoll: "1d12 per Telekinesis skill level",
    },
  ),
  tech(
    "telekinesis",
    "Tangible Force Construct",
    3,
    p(
      "Once per turn, as an On Turn action, the psychic can Commit Effort for the scene to create a telekinetic force construct at a visible point, provided it can fit within a three-meter cube. The force construct can be shaped in any way the psychic wishes, and can remain fixed in its location without external supports if desired. It is as sturdy as a TL4 construction and may be visible or invisible at the adept's choice. The construct lasts until the end of the scene, until the psychic dispels it, or until it is smashed with 20 points of damage against AC 15.",
    ),
    { commitmentOptions: scene(), activation: { roll: "On Turn action" } },
  ),
  tech(
    "telekinesis",
    "Telekinetic Ram",
    3,
    p(
      "As a Main Action, the psychic can Commit Effort for the scene to target a tremendous, uncontrolled burst of force at a single target within sight. This burst requires some time to detonate, however, and will only go off at the end of the next round. Targets of this technique are aware of an oppressive, electrical tingling in the air and are apt to instinctively move; this technique is thus generally useless against any target that is not entirely immobile, as any movement of a chosen target disrupts the ram. Once the ram detonates, however, it is sufficient to destroy any immobile civilian vehicle, create a five-meter hole in anything short of hardened military fortifications, or inflict 5d12 damage on anything else as if it were struck by a Heavy weapon.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Main Action" }, damageRoll: "5d12" },
  ),
  tech(
    "telekinesis",
    "Reactive Telekinesis",
    3,
    p(
      "As an Instant action, the psychic can Commit Effort for the scene whenever an assailant misses them with a physical attack. The attack is then reflected back against the assailant, who must reroll the attack against their own person twice. If either roll hits, the assailant suffers damage from their own attack. If both rolls hit, the damage is the maximum possible.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Instant action" } },
  ),
  tech(
    "telekinesis",
    "Force Puppetry",
    4,
    p(
      "As a Main Action, the telekinetic can Commit Effort for the day to suborn a visible target's mobility, whether robotic, vehicular, or human, provided it's no larger than a ground car. A sapient victim can make a Mental saving throw to resist the psychic onslaught; on a failure, they lose control of their physical actions. If not piloted by the telekinetic, the target remains motionless or continues on its current direction of travel. If the telekinetic spends a Main Action to control them, they can be made to perform any physical action that is not directly suicidal, using the psychic's skill levels and hit bonus for any attacks or skill checks they might make. The puppetry lasts until the end of the scene, until the target leaves the psychic's sight, or until a sapient target believes that their action or inaction is about to get them killed. The psychic's control is fine enough to achieve even very delicate physical motions, but it is not good enough to control the target's speech, though it can keep them silent.",
    ),
    { commitmentOptions: day(), activation: { roll: "Main Action", save: "Mental" } },
  ),
  tech(
    "telekinesis",
    "Telekinetic Flight",
    4,
    p(
      "As an Instant action, the telekinetic can Commit Effort to begin flying, and may extend this effect to up to a half-dozen unresisting, human-sized allies within 30 meters. While flying, the psychic can move at twice their normal movement rate in any direction. They can plunge earthward at up to terminal velocity without harm, and even orbital insertions are survivable with this power if a vacc suit is available or the Pressure Field technique is used. Allies must end their turns within 30 meters of the psychic to maintain this flight but control their own motion. As an Instant, this power may be triggered in time to negate falling damage. The flight lasts for as long as the Effort remains Committed.",
    ),
    { commitmentOptions: active(), activation: { roll: "Instant action" } },
  ),
];

// ---------------------------------------------------------------------------
// Telepathy (9)
// ---------------------------------------------------------------------------

const TELEPATHY = [
  tech(
    "telepathy",
    "Telepathic Contact",
    0,
    desc(
      [
        "There is no psychic power more threatening and disturbing to normal humanity than that of telepathy. The prospect of having one's innermost thoughts and secrets pried out by imperceptible means is deeply troubling to most men and women, and telepaths are often given a wide berth by others simply for fear of what private thoughts they might sift out.",
        "Telepathy operates at a very basic level of mental contact, and is not impeded by a lack of shared languages. While the basic forms of telepathy only function on intelligent creatures, aliens or transhumans with human-like cognition can be affected. VIs, True AIs, and other non-biological intelligences are not normally subject to Telepathy techniques.",
        "Telepathy is a subtle ability, and targets of its technique will not normally be aware of it. Only those with metapsionic expertise or Telepathy-0 skill or greater can tell when they've been targeted by Telepathy. Others may suspect this influence, particularly if they're aware of the existence of psychics and have just done something utterly inexplicable to their own reasoning.",
        "The telepath can obtain a progressively-deeper understanding of a sentient target's thoughts. The target must be visible or otherwise perceptible to the telepath's unaided senses. Opening a contact requires the telepath to Commit Effort for the day as a Main Action, and the contact lasts for a scene at most unless augmented by other techniques. The depth of contact that can be made depends on the psychic's Telepathy skill. A single contact can use any or all of the effects permitted to a telepath of the user's skill level. Basic forms of contact do not allow for a saving throw, though more advanced probes allow the target to make a Mental saving throw to resist. On a successful save, no form of this technique that allows a save can be used on them for the rest of the scene.",
      ],
      {
        0: "Observe emotional states in a target. Intense emotions provide a single word or image related to the focus of the feelings.",
        1: "A shallow gestalt with the target's language centers allows the telepath to understand any form of communication made by the target. If the psychic has the requisite body parts to speak the target's language, they can communicate with it in turn.",
        2: "The psychic's awareness of the target's surface cognition is sophisticated enough to read their current thoughts, though it can't pick up memories or non-obvious connections. The target gets a Mental saving throw to resist this.",
        3: "The psychic can drill down into the target's memory to get a one or two-sentence answer to any single question they ask, or receive a single answering vision of the target's recollections. The target can attempt a Mental saving throw to resist this power, and whether or not it succeeds the contact is automatically ended. It can be re-established, but only by activating this technique again.",
        4: "The psychic instantly gets a full and nuanced awareness of everything the target can remember about a particular topic. The target can attempt a Mental saving throw to resist this power, and whether or not it succeeds the contact is automatically ended afterwards. It can be re-established, but only by activating this technique again.",
      },
    ),
    { isCore: true, commitmentOptions: day(), activation: { roll: "Main Action", save: "Mental" } },
  ),
  tech(
    "telepathy",
    "Facile Mind",
    1,
    p(
      "The telepath is practiced at opening a Telepathic Contact, and need only Commit Effort for the scene to do so, instead of Committing Effort for the day. If contacting an ally who has practiced the process with the psychic for at least a week, opening the contact normally requires no Effort at all. In both cases, if the telepath chooses to Commit Effort for the day, they can open a Telepathic Contact as an Instant action rather than a Main Action.",
    ),
    {
      commitmentOptions: [
        { cost: 1, length: "scene", note: "Open Telepathic Contact" },
        { cost: 0, length: "none", note: "Practiced ally (1+ week of training)" },
        { cost: 1, length: "day", note: "Open contact as Instant action" },
      ],
    },
  ),
  tech(
    "telepathy",
    "Transmit Thought",
    1,
    p(
      "The telepath can send thoughts and images over a Telepathic Contact, allowing two-way communication with a willing target as an Instant action when desired.",
    ),
    { activation: { roll: "Instant action" } },
  ),
  tech(
    "telepathy",
    "Far Thought",
    2,
    p(
      "Once a telepath has made a Telepathic Contact with a target, they can thereafter activate the technique whenever that target is within 100 kilometers, whether or not the psychic knows where they are. At Telepathy-3 the range increases to 1,000 kilometers, and at Telepathy-4 it extends over an entire planet and up to orbital distances. This distant connection is tenuous, however, and the psychic cannot use any technique through it that would allow the target a saving throw to resist.",
    ),
  ),
  tech(
    "telepathy",
    "Suppress Cognition",
    2,
    p(
      "Through intense focus, the telepath can make the target of a Telepathic Contact simply not think about something, whether that's the presence of the telepath, the possibility of committing violence, the absence of important documentation, or any other single potential action or one specific person. This technique requires the psychic to Commit Effort for the scene as a Main Action. The target gets a Mental saving throw to resist this power and become immune to it for the scene. If failed, the thought remains unthinkable for the rest of the scene unless the target perceives physical danger or a traumatic threat to something they prize highly. In that case, the block instantly dissolves and cannot be re-established during the scene. Once the effect ends, the target will remain oblivious to their temporary fugue unless it is brought to their attention somehow.",
    ),
    { commitmentOptions: scene(), activation: { roll: "Main Action", save: "Mental" } },
  ),
  tech(
    "telepathy",
    "Reflex Response",
    3,
    p(
      "As a Main Action, the telepath can Commit Effort for the day to force a sudden, irrational impulse into the target of a Telepathic Contact. The target may make a Mental saving throw to resist; on a failure, they will use their next available action to carry out the impulse to the best of their ability. This impulse cannot be self-injurious or harmful to a loved one, but it can be foolish, reckless, or harmful to others. The target may not understand why they have done the action, but will usually attempt to rationalize it as their choice.",
    ),
    { commitmentOptions: day(), activation: { roll: "Main Action", save: "Mental" } },
  ),
  tech(
    "telepathy",
    "Telepathic Assault",
    3,
    p(
      "The telepath Commits Effort for the day as a Main Action to force a wave of metadimensional energy through the brain of a Telepathic Contact target. The assault does 6d6 damage, or 9d6 damage if the telepath has Telepathy-4 skill. The target may make a Mental saving throw to halve the damage. This assault cannot kill a target, but can knock them unconscious for an hour if they're reduced to zero hit points, after which they wake up with one hit point. A victim cannot be targeted by an assault more than once per scene.",
    ),
    {
      commitmentOptions: day(),
      activation: { roll: "Main Action", save: "Mental" },
      damageRoll: "6d6 (9d6 at Telepathy-4)",
    },
  ),
  tech(
    "telepathy",
    "Memory Editing",
    4,
    p(
      "The telepath can make simple edits to the memory of a target currently linked by a Telepathic Contact. Events of no more than 24 hours in duration can be erased from memory, conversations can be created or changed, new events can be added to a day, or other similar alterations made. The psychic can make these changes as a Main Action by Committing Effort for the day. If the psychic doesn't have a good understanding of the memories they're changing, such as might be granted by the level-4 degree of Telepathic Contact, the edits they make may not fit well. The target gets a Mental saving throw to resist editing for the rest of the scene, but on a failure, they will not notice the changed memories until given a reason to recollect them.",
    ),
    { commitmentOptions: day(), activation: { roll: "Main Action", save: "Mental" } },
  ),
  tech(
    "telepathy",
    "Unity of Thought",
    4,
    p(
      "The telepath becomes exceptionally skilled at weaving together multiple allied minds. When they establish a Telepathic Contact with a willing ally they may bind up to six willing participants into the same contact without further Effort. This multi-person link is relatively shallow, and allows only the Instant exchange of thoughts, images, and sensory impressions. While under its effect, every participant knows the exact location and condition of all others, and uses the best Initiative roll of any of them if combat commences. At the table, up to five minutes of discussion and coordination among the players can be arranged each round without incurring delays for the PCs. Every combat turn, one gestalt member of the psychic's choice gets an extra round of action to represent the benefits of the perfect coordination of the group. The psychic cannot gain this bonus round himself. The telepathic link lasts as long as the psychic initiates no new Telepathic Contact, and it has a range that extends to any point within a solar system.",
    ),
  ),
];

// ---------------------------------------------------------------------------
// Teleportation (11)
// ---------------------------------------------------------------------------

const TELEPORTATION = [
  tech(
    "teleportation",
    "Personal Apportation",
    0,
    desc(
      [
        "Teleporters do not provoke the kind of persistent worry that telepaths induce in most normals, but their particular gifts cause a more physical concern. An experienced teleporter can reach or see into any location they've ever been; security officials don't just need to make sure that no teleporter is in a restricted area, but that they've never been there before at any time.",
        "The teleporter can translocate to another location they have either occupied before or can see with their unaided vision. Locations are fixed in reference to the nearest major gravity well. For example, it is not possible to teleport to the cockpit of a distant moving vehicle they once occupied, but they can teleport to another point on a planet's surface even though the planet has since moved far through the stellar void.",
        "The core technique allows the teleporter to move himself and any mass he is able to carry with his own natural strength. Resisting targets cannot be carried along, and unresisting ones must be touched. A teleporter can leave any clothing, shackles, adhesions, or other matter behind when he teleports, but he cannot leave behind matter that has been inserted into his body, such as cybernetics or shrapnel. Matter cannot be partially left behind. A teleporter will instinctively abort any apportation that would leave him embedded in a solid object or in an environment of imminent physical harm. Any Committed Effort on such aborted jumps is wasted, as is any action spent triggering the power.",
        "Teleporting with Personal Apportation counts as a Main Action and requires that the psychic Commit Effort for the scene.",
      ],
      {
        0: "The psychic can teleport up to 10 meters.",
        1: "The psychic can teleport up to 100 meters.",
        2: "The psychic can teleport up to 10 kilometers.",
        3: "The psychic can teleport up to 1,000 kilometers.",
        4: "The psychic can teleport anywhere on a planet's surface or near orbit.",
      },
    ),
    { isCore: true, commitmentOptions: scene(), activation: { roll: "Main Action" } },
  ),
  tech(
    "teleportation",
    "Proficient Apportation",
    1,
    p(
      "Personal Apportation now counts as a Move action, though it still can be performed only once per round. Apportations of 10 meters or less no longer require Effort to be Committed, though any augments to the technique must still be paid for normally.",
    ),
  ),
  tech(
    "teleportation",
    "Spatial Awareness",
    1,
    p(
      "The psychic may Commit Effort as an On Turn action to gain an intuitive 360-degree awareness of their physical surroundings. The sense is roughly equivalent to sight out to 100 meters, though it cannot read text or distinguish colors. It is blocked by solid objects but is unimpeded by darkness, mist, blinding light, holograms, or optical illusions. The sense lasts as long as the Effort remains Committed to the technique.",
    ),
    { commitmentOptions: active(), activation: { roll: "On Turn action" } },
  ),
  tech(
    "teleportation",
    "Burdened Apportation",
    2,
    p(
      "The psychic can carry willing companions with them when using Personal Apportation. Up to three human-sized companions and their man-portable gear may be carried per skill level in Teleportation. Allies must be within 3 meters of the teleporter to be carried along. Ordinary inert matter cannot be carried along unless the psychic is touching it or it's being carried by an ally affected by this power. If carrying inert mass, up to two hundred kilos of objects can be carried per skill level. Using this technique increases the Effort cost of Personal Apportation, requiring that an extra point of Effort be Committed for the day.",
    ),
    { commitmentOptions: day("Additional Effort when carrying companions or cargo") },
  ),
  tech(
    "teleportation",
    "Perceptive Dislocation",
    2,
    p(
      "Commit Effort for the day to sense any location the psychic could teleport to. The psychic perceives the location as if there, lasting for fifteen minutes at most.",
    ),
    { commitmentOptions: day() },
  ),
  tech(
    "teleportation",
    "Spatial Synchrony Mandala",
    2,
    p(
      "The psychic imprints a particular object or person on their psionic awareness. Provided the object is relatively intact and in range of their Personal Apportation, the psychic always knows its exact location and can teleport to within three meters of it with Personal Apportation even if it has moved from its original location. Imprinting an object requires an hour's meditation with it, and only one object can be imprinted at a time. If imprinting on a person, the target must be willing and cooperative to make the imprint. Objects must be at least one kilogram in mass to be effectively tracked.",
    ),
  ),
  tech(
    "teleportation",
    "Effortless Apportation",
    3,
    p(
      "The psychic does not need to Commit Effort to use Personal Apportation. If the technique is augmented by other techniques that come with their own extra or increased cost, however, this extra cost must still be paid.",
    ),
  ),
  tech(
    "teleportation",
    "Stutterjump",
    3,
    p(
      "The psychic can instinctively micro-teleport away from incoming danger. As an On Turn action they may Commit Effort to begin shifting their spatial position away from attacks, gaining a base Armor Class of 20 so long as the Effort remains Committed. This Armor Class is not modified by armor, shields, or Dexterity modifiers, and the micro-jumps do not significantly move the psychic from their current location. While Stutterjump is active, as an Instant action the adept may Commit Effort for the day to negate a successful hit by a weapon attack, even after damage has been rolled. This reflexive defensive jump may be used only once per day and leaves the psychic just outside the radius of explosions or other area-effect attacks.",
    ),
    {
      commitmentOptions: [
        { cost: 1, length: "active", note: "Base AC 20 while active" },
        { cost: 1, length: "day", note: "Negate one successful weapon hit (once per day)" },
      ],
      activation: { roll: "On Turn action" },
    },
  ),
  tech(
    "teleportation",
    "Rift Reduplication",
    3,
    p(
      "Expert teleporters can be infuriatingly difficult to pin down. By Committing an additional Effort for the day as an Instant action, the adept can use Personal Apportation as an On Turn action, even if they've already used it once this round. Apporting itself costs whatever Effort it normally would, in addition to any techniques that augment it. Rift Reduplication can only be triggered once per round. If the adept uses their powers to teleport into a location, perform an action, and then use Rift Reduplication to teleport back out, onlookers in the area will not have time to react to their action or attack the adept unless the onlookers have held their action explicitly to counter the psychic.",
    ),
    { commitmentOptions: day("Additional Instant surcharge"), activation: { roll: "Instant action" } },
  ),
  tech(
    "teleportation",
    "Deep Intrusion",
    4,
    p(
      "The adept can use Personal Apportation to blind-teleport into a building, structure, vehicle, or spaceship visible to them, including spaceships close enough to engage in conventional ship-to-ship combat. They intuitively seek out a space large enough to hold them and without immediate environmental hazards, but cannot control their precise destination. Using this technique in conjunction with Personal Apportation is very draining to the psychic, and requires that they Commit an additional Effort point for the day.",
    ),
    { commitmentOptions: day("Additional Effort with Personal Apportation") },
  ),
  tech(
    "teleportation",
    "Offensive Apportation",
    4,
    p(
      "The psychic can use Personal Apportation as a Main Action to teleport an unwilling target, provided the user can make physical contact with them. Contact with an unsuspecting or incapacitated target is automatic, while touching a resisting enemy requires a Punch hit roll with a bonus equal to the psychic's Teleportation skill. If the psychic does not use the Burdened Apportation technique then only the target is teleported; otherwise the user may go along with them. The psychic cannot teleport a target to any location they could not teleport to, including locations of imminent environmental danger, such as high in the air, into a windowless tomb, or into the middle of a sea. A conscious, resisting target can make a Mental saving throw to forcibly abort the teleportation, rolling at a penalty equal to the psychic's Teleportation skill. Use of this technique adds to the cost of Personal Apportation, requiring the psychic Commit an additional point of Effort for the day whether the touch hits or not.",
    ),
    {
      commitmentOptions: day("Additional Effort whether touch hits or not"),
      activation: { roll: "Main Action", save: "Mental" },
    },
  ),
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const PSYCHIC_TECHNIQUES = [
  ...BIOPSIONICS,
  ...METAPSIONICS,
  ...PRECOGNITION,
  ...TELEKINESIS,
  ...TELEPATHY,
  ...TELEPORTATION,
];

/** @param {keyof typeof DISCIPLINES} key */
export function techniquesByDiscipline(key) {
  return PSYCHIC_TECHNIQUES.filter((t) => t.discipline === key);
}
