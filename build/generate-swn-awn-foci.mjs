/**
 * One-shot pack generator: writes Focus items into abilities-swn / abilities-awn.
 *
 * - Ensures a top-level "Foci" folder exists in each pack.
 * - Preserves existing focus `_id`s by name across re-runs.
 * - Deletes stale focus files before rewriting (Skills are left untouched).
 *
 * Run: node ./build/generate-swn-awn-foci.mjs
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

const FOCUS_IMG = "systems/wwn/assets/icons/items/focus.png";

/** @param {string} key @param {string} type @param {string|number|boolean} value @param {string} phase */
function ch(key, type, value, phase) {
  return { key, type, value, phase };
}

/**
 * @param {string} parentId
 * @param {string} effectId
 * @param {string} name
 * @param {object[]} changes
 * @param {{ focusLevel?: number, disabled?: boolean }} [opts]
 */
function makeEffect(parentId, effectId, name, changes, { focusLevel, disabled = false } = {}) {
  return {
    _id: effectId,
    type: "base",
    name,
    img: FOCUS_IMG,
    transfer: true,
    disabled: disabled || focusLevel === 2,
    system: { changes },
    flags: { wwn: focusLevel ? { focusLevel } : {} },
    _key: `!items.effects!${parentId}.${effectId}`,
  };
}

/**
 * Build an HTML description from an intro (string or array of paragraphs) plus
 * per-level prose. Foci with no numbered levels (e.g. Unique Gift) just pass the intro.
 * @param {string | string[]} intro
 * @param {...(string|undefined)} levels
 */
function desc(intro, ...levels) {
  const introParas = Array.isArray(intro) ? intro : [intro];
  const parts = introParas.map((p) => `<p>${p}</p>`);
  levels.forEach((text, i) => {
    if (text) parts.push(`<p><strong>Level ${i + 1}:</strong> ${text}</p>`);
  });
  return parts.join("");
}

/**
 * Focus data-authoring helper. `levels` is a sparse list of `{ level, changes }`
 * entries that become transferred Active Effects (Level 2 effects start disabled;
 * the actor-side sync toggles them on when ownedLevel reaches that level).
 * @param {string} name
 * @param {string} description
 * @param {object} [opts]
 */
function focus(name, description, opts = {}) {
  return {
    name,
    description,
    bonusSkills: opts.bonusSkills ?? [],
    bonusSkillsPick: opts.bonusSkillsPick ?? 0,
    bonusDice: opts.bonusDice ?? null,
    skillBonus: opts.skillBonus ?? "",
    resourceGrant: opts.resourceGrant ?? { targetName: "", targetSource: "", bonusMax: 0 },
    internalResource: opts.internalResource ?? { value: 0, max: 0 },
    resourceLength: opts.resourceLength ?? "none",
    levels: opts.levels ?? [],
  };
}

// ---------------------------------------------------------------------------
// SWN foci (25)
// ---------------------------------------------------------------------------

const swnFoci = [
  focus(
    "Alert",
    desc(
      "You are keenly aware of your surroundings and virtually impossible to take unaware. You have an instinctive alacrity of response that helps you act before less wary persons can think to move.",
      "Gain Notice as a bonus skill. You cannot be surprised, nor can others use the Execution Attack option on you. When you roll initiative, roll twice and take the best result.",
      "You always act first in a combat round unless someone else involved is also this <em><strong>Alert</strong></em>.",
    ),
    {
      bonusSkills: ["notice"],
      bonusSkillsPick: 1,
      levels: [
        {
          level: 1,
          changes: [
            ch("system.combat.initiative.individual.roll", "override", "2d8kh", "initial"),
            ch("system.combat.immuneToSurprise", "override", "true", "initial"),
          ],
        },
        {
          level: 2,
          changes: [
            ch("system.combat.initiative.individual.mod", "add", 100, "initial"),
            ch("system.combat.initiative.group.mod", "add", 100, "initial"),
          ],
        },
      ],
    },
  ),
  focus(
    "Armsman",
    desc(
      "You have an unusual competence with thrown weapons and melee attacks. This focus&rsquo; benefits do not apply to unarmed attacks or projectile weapons. For thrown weapons, you can&rsquo;t use the benefits of the <em><strong>Armsman</strong></em> focus at the same time as <em><strong>Gunslinger</strong></em>.",
      "Gain Stab as a bonus skill. You can draw or sheath a Stowed melee or thrown weapon as an Instant action. You may add your Stab skill level to a melee or thrown weapon&rsquo;s damage roll or Shock damage, assuming it has any to begin with.",
      "Your primitive melee and thrown weapons count as TL4 weapons for the purpose of overcoming advanced armors. Even on a miss with a melee weapon, you do an unmodified 1d4 damage to the target, plus any Shock damage. This bonus damage doesn&rsquo;t apply to thrown weapons or attacks that use the Punch skill.",
    ),
    {
      bonusSkills: ["stab"],
      bonusSkillsPick: 1,
      levels: [
        {
          level: 1,
          changes: [
            ch("system.combat.meleeDamage", "add", "@stab", "final"),
            ch("system.combat.meleeShock", "add", "@stab", "final"),
          ],
        },
        {
          level: 2,
          changes: [
            ch("system.combat.meleeCountsAsTl4", "override", "true", "final"),
            ch("system.combat.meleeMissDamage", "override", "1d4", "final"),
          ],
        },
      ],
    },
  ),
  focus(
    "Assassin",
    desc(
      "You are practiced at sudden murder, and have certain advantages in carrying out an Execution Attack.",
      "Gain Sneak as a bonus skill. You can conceal an object no larger than a knife or pistol from anything less invasive than a strip search, including normal TL4 weapon detection devices. You can draw or produce this object as an On Turn action, and your point-blank ranged attacks made from surprise with it cannot miss the target.",
      "You can take a Move action on the same round as you make an Execution Attack, closing rapidly with a target before you attack. You may split this Move action when making an Execution Attack, taking part of it before you murder your target and part of it afterwards. This movement happens too quickly to alert a victim or to be hindered by bodyguards, barring an actual physical wall of meat between you and your prey.",
    ),
    { bonusSkills: ["sneak"], bonusSkillsPick: 1 },
  ),
  focus(
    "Authority",
    desc(
      "You have an uncanny kind of charisma about you, one that makes others instinctively follow your instructions and further your causes. At level 1, this is a knack of charm and personal magnetism, while level 2 might suggest latent telepathic influence or transhuman memetic hacking augmentations. Where this focus refers to followers, it means NPCs who have voluntarily chosen to be in your service. PCs never count as followers.",
      "Gain Lead as a bonus skill. Once per day, you can make a request from an NPC who is not openly hostile to you, rolling a Cha/Lead skill check at a difficulty of the NPC&rsquo;s Morale score. If you succeed, they will comply with the request, provided it is not harmful or extremely uncharacteristic.",
      "Those who follow you are fired with confidence. Any NPC being directly led by you gains a Morale and hit roll bonus equal to your Lead skill and a +1 bonus on all skill checks. Your followers will not act against your interests unless under extreme pressure.",
    ),
    {
      bonusSkills: ["lead"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
    },
  ),
  focus(
    "Close Combatant",
    desc(
      "You&rsquo;ve had all too much practice at close-in fighting and desperate struggles with pistol or blade. You&rsquo;re extremely skilled at avoiding injury in melee combat, and at level 2 you can dodge through a melee scrum without fear of being knifed in passing.",
      "Gain any combat skill as a bonus skill. You can use pistol-sized ranged weapons in melee without suffering penalties for the proximity of melee attackers. You ignore Shock damage from melee assailants, even if you&rsquo;re unarmored at the time.",
      "The Shock damage from your melee attacks treats all targets as if they were AC 10. The Fighting Withdrawal combat action is treated as an On Turn action for you and can be performed freely.",
    ),
    {
      bonusSkills: ["stab", "punch", "shoot"],
      bonusSkillsPick: 1,
      levels: [
        { level: 1, changes: [ch("system.combat.immuneToShock", "override", "true", "final")] },
        { level: 2, changes: [ch("system.combat.treatAllMeleeAsAcTen", "override", "true", "final")] },
      ],
    },
  ),
  focus(
    "Connected",
    desc(
      "You&rsquo;re remarkably gifted at making friends and forging ties with the people around you. Wherever you go, you always seem to know somebody useful to your ends.",
      "Gain Connect as a bonus skill. If you&rsquo;ve spent at least a week in a not-entirely-hostile location, you&rsquo;ll have built a web of contacts willing to do favors for you that are no more than mildly illegal. You can call on one favor per game day and the GM decides how far they&rsquo;ll go for you.",
      "Once per game session, if it&rsquo;s not entirely implausible, you meet someone you know who is willing to do modest favors for you. You can decide when and where you want to meet this person, but the GM decides who they are and what they can do for you.",
    ),
    {
      bonusSkills: ["connect"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
    },
  ),
  focus(
    "Die Hard",
    desc(
      "You are surprisingly hard to kill. You can survive injuries or bear up under stresses that would incapacitate a less determined hero.",
      "You gain an extra 2 maximum hit points per level. This bonus applies retroactively if you take this focus after first level. You automatically stabilize if mortally wounded by anything smaller than a Heavy weapon.",
      "The first time each day that you are reduced to zero hit points by an injury, you instead survive with one hit point remaining. This ability can&rsquo;t save you from Heavy weapons or similar trauma.",
    ),
    {
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
      levels: [
        {
          level: 1,
          changes: [
            ch("system.hitDice.perLevelMod", "add", 2, "final"),
            ch("system.combat.autoStabilize", "override", "true", "final"),
          ],
        },
      ],
    },
  ),
  focus(
    "Diplomat",
    desc(
      "You know how to get your way in personal negotiations, and can manipulate the attitudes of those around you. Even so, while smooth words are versatile, they&rsquo;ll only work if your interlocutor is actually willing to listen to you.",
      "Gain Talk as a bonus skill. You speak all the languages common to the sector and can learn new ones to a workable level in a week, becoming fluent in a month. Reroll 1s on any skill check dice related to negotiation or diplomacy.",
      "Once per game session, shift an intelligent NPC&rsquo;s reaction roll one step closer to friendly if you can talk to them for at least thirty seconds.",
    ),
    { bonusSkills: ["talk"], bonusSkillsPick: 1 },
  ),
  focus(
    "Gunslinger",
    desc(
      "You have a gift with a gun. While this talent most commonly applies to slugthrowers or energy weapons, it is also applicable to thrown weapons, bows, or other ranged weapons that can be used with the Shoot skill. For thrown weapons, you can&rsquo;t use the benefits of the <em><strong>Armsman</strong></em> focus at the same time as <em><strong>Gunslinger</strong></em>.",
      "Gain Shoot as a bonus skill. You can draw or holster a Stowed ranged weapon as an On Turn action. You may add your Shoot skill level to a ranged weapon&rsquo;s damage roll.",
      "Once per round, you can reload a ranged weapon as an On Turn action if it takes no more than one round to reload. Even on a miss with a Shoot attack, you do an unmodified 1d4 damage.",
    ),
    {
      bonusSkills: ["shoot"],
      bonusSkillsPick: 1,
      levels: [
        { level: 1, changes: [ch("system.combat.rangeDamage", "add", "@shoot", "final")] },
        { level: 2, changes: [ch("system.combat.rangeMissDamage", "override", "1d4", "final")] },
      ],
    },
  ),
  focus(
    "Hacker",
    desc(
      "You have a considerable fluency with digital security measures and standard encryption methods. You know how to make computerized systems obey you until their automatic failsafes come down on your control.",
      "Gain Program as a bonus skill. When attempting to hack a database or computerized system, roll 3d6 on the skill check and drop the lowest die.",
      "Your hack duration increases to 1d4+Program skill x10 minutes. You have an instinctive understanding of the tech; you never need to learn the data protocols for a strange system and are always treated as familiar with it.",
    ),
    { bonusSkills: ["program"], bonusSkillsPick: 1, bonusDice: 1, skillBonus: "program" },
  ),
  focus(
    "Healer",
    desc(
      "Healing comes naturally to you, and you&rsquo;re particularly gifted at preventing the quick bleed-out of wounded allies and comrades.",
      "Gain Heal as a bonus skill. You may attempt to stabilize one mortally-wounded adjacent person per round as an On Turn action. When rolling Heal skill checks, roll 3d6 and drop the lowest die.",
      "Stims or other technological healing devices applied by you heal twice as many hit points as normal. Using only basic medical supplies, you can heal 1d6+Heal skill hit points of damage to every injured or wounded person in your group with ten minutes of first aid spread among them. Such healing can be applied to a given target only once per day.",
    ),
    { bonusSkills: ["heal"], bonusSkillsPick: 1, bonusDice: 1, skillBonus: "heal" },
  ),
  focus(
    "Henchkeeper",
    desc(
      [
        "You have a distinct knack for picking up lost souls who willingly do your bidding. You might induce them with promises of money, power, excitement, sex, or some other prize that you may or may not eventually grant. A henchman obtained with this focus will serve in loyal fashion until clearly betrayed or placed in unacceptable danger. Henchmen are not &ldquo;important&rdquo; people in their society, and are usually marginal sorts, outcasts, the desperate, or other persons with few options.",
        "You can use more conventional pay or inducements to acquire additional henchmen, but these extra hirelings are no more loyal or competent than your pay and treatment can purchase.",
      ],
      "Gain Lead as a bonus skill. You can acquire henchmen within 24 hours of arriving in a community, assuming anyone is suitable hench material. These henchmen will not fight except to save their own lives, but will escort you on adventures and risk great danger to help you. Most henchmen will be treated as Peaceful Humans from the Xenobestiary. You can have one henchman at a time for every three character levels you have, rounded up. You can release henchmen with no hard feelings at any plausible time and pick them back up later should you be without a current henchman.",
      "Your henchmen are remarkably loyal and determined, and will fight for you against anything but clearly overwhelming odds. Whether through natural competence or their devotion to you, they&rsquo;re treated as Martial Humans from the Xenobestiary. You can make faithful henchmen out of skilled and highly-capable NPCs, but this requires that you actually have done them some favor or help that would reasonably earn such fierce loyalty.",
    ),
    { bonusSkills: ["lead"], bonusSkillsPick: 1 },
  ),
  focus(
    "Ironhide",
    desc(
      "Whether through uncanny reflexes, remarkable luck, gengineered skin fibers, or subtle telekinetic shielding, you have natural defenses equivalent to high-quality combat armor. The benefits of this focus don&rsquo;t stack with armor, though Dexterity or shield modifiers apply.",
      "You have an innate Armor Class of 15 plus half your character level, rounded up.",
      "Your abilities are so effective that they render you immune to unarmed attacks or primitive weaponry as if you wore powered armor.",
    ),
    {
      levels: [
        { level: 1, changes: [ch("system.combat.innateAc.min", "upgrade", "@halfLevel + 15", "final")] },
        { level: 2, changes: [ch("system.combat.immuneToPrimitiveWeapons", "override", "true", "final")] },
      ],
    },
  ),
  focus(
    "Psychic Training",
    desc(
      "You&rsquo;ve had special training in a particular psychic discipline. You must be a Psychic or have taken the Partial Psychic class option as an Adventurer to pick this focus. In the latter case, you can only take training in the discipline you initially chose as a Partial Psychic. As with most foci, this focus can be taken only once.",
      "Gain any psychic skill as a bonus. If this improves it to level-1 proficiency, choose a free level-1 technique from that discipline. Your maximum Effort increases by one.",
      "When you advance a level, the bonus psychic skill you chose for the first level of the focus automatically gets one skill point put toward increasing it or purchasing a technique from it. You may save these points for later, if more are required to raise the skill or buy a particular technique. These points are awarded retroactively if you take this focus level later in the game.",
    ),
    {
      bonusSkills: ["biopsionics", "metapsionics", "precognition", "telekinesis", "telepathy", "teleportation"],
      bonusSkillsPick: 1,
      resourceGrant: { targetName: "Effort", targetSource: "", bonusMax: 1 },
    },
  ),
  focus(
    "Savage Fray",
    desc(
      "You are a whirlwind of bloody havoc in melee combat, and can survive being surrounded far better than most combatants.",
      "Gain Stab as a bonus skill. All enemies adjacent to you at the end of your turn whom you have not attacked suffer the Shock damage of your weapon if their Armor Class is not too high to be affected.",
      "After suffering your first melee hit in a round, any further melee attacks from other assailants automatically miss you. If the attacker who hits you has multiple attacks, they may attempt all of them, but other foes around you simply miss.",
    ),
    {
      bonusSkills: ["stab"],
      bonusSkillsPick: 1,
      levels: [
        { level: 1, changes: [ch("system.combat.endOfTurnAdjacentShock", "override", "true", "final")] },
        { level: 2, changes: [ch("system.combat.missAfterFirstMeleeHit", "override", "true", "final")] },
      ],
    },
  ),
  focus(
    "Shocking Assault",
    desc(
      "You&rsquo;re extremely dangerous to enemies around you. The ferocity of your melee attacks stresses and distracts enemies even when your blows don&rsquo;t draw blood.",
      "Gain Punch or Stab as a bonus skill. The Shock damage of your weapon treats all targets as if they were AC 10, assuming your weapon is capable of harming the target in the first place.",
      "In addition, you gain a +2 bonus to the Shock damage rating of all melee weapons and unarmed attacks. Regular hits never do less damage than this Shock would do on a miss.",
    ),
    {
      bonusSkills: ["punch", "stab"],
      bonusSkillsPick: 1,
      levels: [
        { level: 1, changes: [ch("system.combat.treatAllMeleeAsAcTen", "override", "true", "final")] },
        { level: 2, changes: [ch("system.combat.meleeShock", "add", 2, "final")] },
      ],
    },
  ),
  focus(
    "Sniper",
    desc(
      "You are an expert at placing a bullet or beam on an unsuspecting target. These special benefits only apply when making an Execution Attack with a firearm or bow.",
      "Gain Shoot as a bonus skill. When making a skill check for an Execution Attack or target shooting, roll 3d6 and drop the lowest die.",
      "A target hit by your Execution Attack takes a -4 penalty on the Physical saving throw to avoid immediate mortal injury. Even if the save is successful, the target takes double the normal damage inflicted by the attack.",
    ),
    { bonusSkills: ["shoot"], bonusSkillsPick: 1, bonusDice: 1, skillBonus: "shoot" },
  ),
  focus(
    "Specialist",
    desc(
      "You are remarkably talented at a particular skill. Whether a marvelous cat burglar, a world-famous athlete, a brilliant engineer, or some other savant, your expertise is extremely reliable. You may take this focus more than once for different skills.",
      "Gain a non-combat, non-psychic skill as a bonus. Roll 3d6 and drop the lowest die for all skill checks in this skill.",
      "Roll 4d6 and drop the two lowest dice for all skill checks in this skill.",
    ),
    { bonusSkillsPick: 1, bonusDice: 1, skillBonus: "" },
  ),
  focus(
    "Star Captain",
    desc(
      "You have a tremendous natural talent for ship combat, and can make any starship you captain a significantly more fearsome opponent. You must take the captain&rsquo;s role during a fight in order to benefit from this focus.",
      "Gain Lead as a bonus skill. Your ship gains 2 extra Command Points at the start of each turn.",
      "A ship you captain gains bonus hit points equal to 20% of its maximum at the start of each combat. Damage is taken from these bonus points first, and they vanish at the end of the fight and do not require repairs to replenish before the next. In addition, once per engagement, you may resolve a Crisis as an Instant action by explaining how your leadership resolves the problem.",
    ),
    {
      bonusSkills: ["lead"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "scene",
      levels: [
        { level: 1, changes: [ch("system.starship.commandPointsBonus", "add", 2, "final")] },
        { level: 2, changes: [ch("system.starship.combatBonusHpPercent", "override", 20, "final")] },
      ],
    },
  ),
  focus(
    "Starfarer",
    desc(
      "You are an expert in the plotting and execution of interstellar spike drills. While most experienced pilots can manage conventional drills along well-charted spike routes, you have the knack for forging new drill paths and cutting courses too dangerous for lesser navigators.",
      "Gain Pilot as a bonus skill. You automatically succeed at all spike drill-related skill checks of difficulty 10 or less.",
      "Double your Pilot skill for all spike drill-related skill checks. Spike drives of ships you navigate are treated as one level higher, up to a maximum of drive-7. Spike drills you personally oversee take only half the time they would otherwise require.",
    ),
    {
      bonusSkills: ["pilot"],
      bonusSkillsPick: 1,
      levels: [
        { level: 1, changes: [ch("system.starship.spikeDrillAutoSucceedDiff", "override", 10, "final")] },
        {
          level: 2,
          changes: [
            ch("system.starship.spikeDrillDoublePilot", "override", "true", "final"),
            ch("system.starship.spikeDriveLevelBonus", "add", 1, "final"),
          ],
        },
      ],
    },
  ),
  focus(
    "Tinker",
    desc(
      "You have a natural knack for modifying and improving equipment.",
      "Gain Fix as a bonus skill. Your Maintenance score is doubled, allowing you to maintain twice as many mods. Both ship and gear mods cost only half their usual price in credits, though pretech salvage requirements remain the same.",
      "Your Fix skill is treated as one level higher for purposes of building and maintaining mods and calculating your Maintenance score. Advanced mods require one fewer pretech salvage part to make, down to a minimum of zero.",
    ),
    { bonusSkills: ["fix"], bonusSkillsPick: 1 },
  ),
  focus(
    "Unarmed Combatant",
    desc(
      "Your empty hands are more dangerous than knives and guns in the grip of the less gifted. Your unarmed attacks are counted as melee weapons when it comes to binding up opponents wielding rifles and similar long arms, though you need at least one hand free to do so.",
      "Gain Punch as a bonus skill. Your unarmed attacks become more dangerous as your Punch skill increases: at level-0 they do 1d6 damage, at level-1 1d8, at level-2 1d10, level-3 1d12, and level-4 1d12+1. At Punch-1 or better, they have the Shock quality equal to your Punch skill against AC 15 or less. While you normally add your Punch skill level to any unarmed damage, don&rsquo;t add it twice to this Shock damage.",
      "You know locks and twists that use powered servos against their wearer. Your unarmed attacks count as TL4 weapons for the purpose of overcoming advanced armors. Even on a miss with a Punch attack, you do an unmodified 1d6 damage.",
    ),
    {
      bonusSkills: ["punch"],
      bonusSkillsPick: 1,
      levels: [{ level: 2, changes: [ch("system.combat.punchMissDamage", "override", "1d6", "final")] }],
    },
  ),
  focus(
    "Unique Gift",
    desc(
      "Whether due to exotic technological augmentation, a unique transhuman background, or a remarkable human talent, you have the ability to do something that&rsquo;s simply impossible for a normal human. This is a special focus which serves as a catch-all for some novel power or background perk that doesn&rsquo;t have a convenient fit in the existing rules. It&rsquo;s up to the GM to decide what&rsquo;s reasonable and fair to be covered under this gift; if an ability is particularly powerful, it might require the user to take System Strain to use it. As a general rule this ability should be better than a piece of gear the PC could buy for credits, since the player is spending a very limited resource when they make this focus pick.",
    ),
    {},
  ),
  focus(
    "Wanderer",
    desc(
      "Your hero gets around. As part of a life on the road, they&rsquo;ve mastered a number of tricks for ensuring their mobility and surviving the inevitable difficulties of a vagabond existence.",
      "Gain Survive as a bonus skill. You can convey basic ideas in all the common languages of the sector. You can always find free transport to a desired destination for yourself and a small group of your friends provided any traffic goes to the place. Finding this transport takes no more than an hour, but it may not be a strictly legitimate means of travel and may require working passage.",
      "You can forge, scrounge, or snag travel papers and identification for the party with 1d6 hours of work. These papers and permits will stand up to ordinary scrutiny, but require an opposed Int/Administer versus Wis/Notice check if examined by an official while the PC is actually wanted by the state for some crime. When finding transport for the party, the transportation always makes the trip at least as fast as a dedicated charter would.",
    ),
    { bonusSkills: ["survive"], bonusSkillsPick: 1 },
  ),
  focus(
    "Wild Psychic Talent",
    desc(
      "Some men and women are born with a very limited form of MES, the mental condition that allows for the use of psychic powers. While these people are not true psychics, these &ldquo;wild talents&rdquo; can create one limited psychic effect. Wild talents are not treated as psychics for general purposes and cannot &ldquo;torch&rdquo; their powers. When relevant, they are treated as having one point of Effort. Psychics and Partial Psychics cannot take this focus.",
      "Pick a psychic discipline. You gain an ability equivalent to the level-0 core power of that discipline. Optionally, you may instead pick a level-1 technique from that discipline, but that technique must stand alone; you can&rsquo;t pick one that augments another technique or core ability.",
      "You now have a maximum Effort of two points. You may pick a second ability according to the guidelines above. This second ability does not need to be a stand-alone technique if it augments the power you chose for level 1 of this focus.",
    ),
    { internalResource: { value: 0, max: 1 }, resourceLength: "none" },
  ),
];

// ---------------------------------------------------------------------------
// AWN foci (32)
// ---------------------------------------------------------------------------

const awnFoci = [
  focus(
    "Alert",
    desc(
      "You are keenly aware of your surroundings and virtually impossible to take unaware. You have an instinctive alacrity of response that helps you act before less wary persons can think to move.",
      "Gain Notice as a bonus skill. You cannot be surprised, nor can others use the Execution Attack option on you. When your group rolls initiative, your vigilance allows them to roll twice and take the higher roll.",
      "In addition to the benefits of level 1, you always act first in a combat round unless someone else involved is also this <em><strong>Alert</strong></em>.",
    ),
    {
      bonusSkills: ["notice"],
      bonusSkillsPick: 1,
      levels: [
        {
          level: 1,
          changes: [
            ch("system.combat.initiative.group.roll", "override", "2d8kh", "initial"),
            ch("system.combat.immuneToSurprise", "override", "true", "initial"),
          ],
        },
        {
          level: 2,
          changes: [
            ch("system.combat.initiative.individual.mod", "add", 100, "initial"),
            ch("system.combat.initiative.group.mod", "add", 100, "initial"),
          ],
        },
      ],
    },
  ),
  focus(
    "Apex Predator",
    desc(
      "You have extensive experience in hunting or handling dangerous wild animals, and know how to avoid, intimidate, or kill such beasts.",
      "Gain Survive and Shoot as bonus skills. Once per scene, as an On Turn action, force any hostile beasts in combat with the party to make a Morale check. Add half your level, rounded up, to any damage or Shock done to sub-sapient beasts.",
      "Once per scene, as an Instant action, force a beast you&rsquo;ve hit to make a Physical saving throw at a penalty equal to your Survive or combat skill, whichever is higher. On a failure, it takes your maximum hit points in extra damage.",
    ),
    {
      bonusSkills: ["survive", "shoot"],
      bonusSkillsPick: 2,
      internalResource: { value: 0, max: 1 },
      resourceLength: "scene",
    },
  ),
  focus(
    "Armsmaster",
    desc(
      "You have an unusual competence with thrown weapons and melee attacks. This focus&rsquo; benefits do not apply to unarmed attacks or non-thrown projectile weapons. This focus&rsquo; bonuses also don&rsquo;t stack with <em><strong>Deadeye</strong></em> or other foci that add a skill&rsquo;s level to your damage or Shock.",
      "Gain Stab as a bonus skill. You can Ready a Stowed melee or thrown weapon as an Instant action. You may add your Stab skill level to a melee or thrown weapon&rsquo;s damage roll or Shock damage, assuming it has any to begin with.",
      "The Shock from your melee attacks always treats the target as if they have AC 10. Gain a +1 bonus to hit with all thrown or melee attacks.",
    ),
    {
      bonusSkills: ["stab"],
      bonusSkillsPick: 1,
      levels: [
        {
          level: 1,
          changes: [
            ch("system.combat.meleeDamage", "add", "@stab", "final"),
            ch("system.combat.meleeShock", "add", "@stab", "final"),
          ],
        },
        {
          level: 2,
          changes: [
            ch("system.combat.treatAllMeleeAsAcTen", "override", "true", "final"),
            ch("system.combat.meleeAttack", "add", 1, "final"),
          ],
        },
      ],
    },
  ),
  focus(
    "Assassin",
    desc(
      "You are practiced at sudden murder, and have certain advantages in carrying out an Execution Attack.",
      "Gain Sneak as a bonus skill. You can conceal an object no larger than a knife or pistol from anything less invasive than a strip search, including normal weapon detection devices. You can draw or produce this object as an On Turn action, and your point-blank ranged attacks made from surprise with it cannot miss the target.",
      "You can take a Move action on the same round as you make an Execution Attack, closing rapidly with a target before you attack. You may split this Move action when making an Execution Attack, taking part of it before you murder your target and part of it afterwards. This movement happens too quickly to alert a victim or to be hindered by bodyguards not directly in your path.",
    ),
    { bonusSkills: ["sneak"], bonusSkillsPick: 1 },
  ),
  focus(
    "Authority",
    desc(
      "You have an uncanny kind of charisma about you, one that makes others instinctively follow your instructions and further your causes. Where this focus refers to followers, it means NPCs who have voluntarily chosen to be in your service. PCs never count as followers.",
      "Gain Lead as a bonus skill. Once per day, you can make a request from an NPC who is not openly hostile to you, rolling a Cha/Lead skill check at a difficulty of the NPC&rsquo;s Morale score. If you succeed, they will comply with the request, provided it is not harmful or very uncharacteristic.",
      "Those who follow you are fired with confidence. Any NPC being directly led by you gains a Morale and hit roll bonus equal to your Lead skill and a +1 bonus on all skill checks. Your followers will not act against your interests unless under extreme pressure.",
    ),
    {
      bonusSkills: ["lead"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
    },
  ),
  focus(
    "Close Combatant",
    desc(
      "You&rsquo;ve had all too much practice at close-in fighting and desperate struggles with pistol or blade. You&rsquo;re extremely skilled at avoiding injury in melee combat, and at level 2 you can dodge through a melee scrum without fear of being knifed in passing.",
      "Gain any combat skill as a bonus skill. You can use pistol-sized ranged weapons in melee without suffering penalties for the proximity of melee attackers. You ignore Shock damage from melee assailants, even if you&rsquo;re unarmored at the time.",
      "The Shock damage from your melee attacks treats all targets as if they were AC 10. The Fighting Withdrawal combat action is treated as an On Turn action for you and can be performed freely.",
    ),
    {
      bonusSkills: ["stab", "punch", "shoot"],
      bonusSkillsPick: 1,
      levels: [
        { level: 1, changes: [ch("system.combat.immuneToShock", "override", "true", "final")] },
        { level: 2, changes: [ch("system.combat.treatAllMeleeAsAcTen", "override", "true", "final")] },
      ],
    },
  ),
  focus(
    "Deadeye",
    desc(
      "You have a gift with ranged weapons. While this talent most commonly applies to guns, it is also applicable to thrown weapons or other ranged weapons that can be used with the Shoot skill. For thrown weapons, you can&rsquo;t use the benefits of the <em><strong>Armsmaster</strong></em> focus at the same time as <em><strong>Deadeye</strong></em>.",
      "Gain Shoot as a bonus skill. You can Ready a Stowed ranged weapon as an Instant action. You may use a rifle or two-handed ranged weapon even when an enemy is within melee range, albeit at a -4 hit penalty. You may add your Shoot skill level to a ranged weapon&rsquo;s damage roll.",
      "You can reload guns, crossbows, or other slow-loading weapons as an On Turn action, provided they don&rsquo;t take more than a round to reload. You can use ranged weapons of any size in melee without penalty. Once per scene, as an On Turn action when target shooting at an inanimate, non-creature target, you automatically hit unless you roll a 2 on your Shoot skill check or the shot is physically impossible.",
    ),
    {
      bonusSkills: ["shoot"],
      bonusSkillsPick: 1,
      levels: [{ level: 1, changes: [ch("system.combat.rangeDamage", "add", "@shoot", "final")] }],
    },
  ),
  focus(
    "Diplomat",
    desc(
      "You know how to get your way in personal negotiations, and can manipulate the attitudes of those around you. Even so, while smooth words are versatile, they&rsquo;ll only work if your interlocutor is actually willing to listen to you.",
      "Gain Talk as a bonus skill. You speak all the languages common to your area and can learn new ones to a workable level in a week, becoming fluent in a month. Reroll 1s on any skill check dice related to negotiation or diplomacy.",
      "Once per game session, shift an intelligent NPC&rsquo;s Reaction Roll one step closer to friendly if you can talk to them for at least thirty seconds.",
    ),
    { bonusSkills: ["talk"], bonusSkillsPick: 1 },
  ),
  focus(
    "Gray Man",
    desc(
      "You are uncannily unremarkable. No one thinks to look twice at you, and you always seem an unprofitable mark for violence or theft.",
      "Gain Sneak as a bonus skill. You know how to conceal your carried belongings so that you never appear to have anything worth stealing. Enemies will not target you in combat unless you are the only practical target or you are making yourself an immediate threat.",
      "You can dress and carry yourself to blend into any group unless it&rsquo;s so small that all members know each other. Once per day, as an On Turn action, gain two System Strain to be forgotten or ignored by everyone around you for the rest of the scene until you act in such a way as to draw attention. This ability can&rsquo;t be used if someone is already paying specific attention to you.",
    ),
    {
      bonusSkills: ["sneak"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
    },
  ),
  focus(
    "Healer",
    desc(
      "Healing comes naturally to you, and you&rsquo;re particularly gifted at preventing the quick bleed-out of wounded allies and comrades.",
      "Gain Heal as a bonus skill. You may attempt to stabilize one mortally-wounded adjacent person per round as an On Turn action. When rolling Heal skill checks, roll 3d6 and drop the lowest die.",
      "Pharmaceuticals or other technological healing devices applied by you heal twice as many hit points as normal. Using only basic medical supplies, you can heal 1d6+Heal skill hit points of damage to every injured or wounded person in your group with ten minutes of first aid spread among them. Such healing adds no System Strain, but can be used on a given target only once a day.",
    ),
    { bonusSkills: ["heal"], bonusSkillsPick: 1, bonusDice: 1, skillBonus: "heal" },
  ),
  focus(
    "Henchkeeper",
    desc(
      [
        "You have a distinct knack for picking up lost souls who willingly do your bidding. You might induce them with promises of money, power, excitement, sex, or some other prize that you may or may not eventually grant. A henchman obtained with this focus will serve in loyal fashion until clearly betrayed or placed in unacceptable danger. Henchmen are not &ldquo;important&rdquo; people, and are usually tribal outcasts, low-status enclave workers, or other people with few prospects in their own society.",
        "You can use more conventional pay or inducements to acquire additional henchmen, but these extra hirelings are no more loyal or competent than your pay and treatment can purchase.",
      ],
      "Gain Lead as a bonus skill. You can acquire henchmen within 24 hours of arriving in a community, assuming anyone is suitable hench material. These henchmen will not fight except to save their own lives, but will go with you on missions and risk great danger to help you. Most peaceful modern citizens will fight as Peaceful Civilians, using whatever gear they&rsquo;re given. Wastelanders, civil war survivors, and other hardened souls will fight as Tribal Warriors. You can have one henchman at a time for every three character levels you have, rounded up. You can release henchmen with no hard feelings at any plausible time and pick them back up later should you be without a current henchman.",
      "Your henchmen are remarkably loyal and determined, and will fight for you against anything but clearly overwhelming odds. Whether through natural competence or their devotion to you, they&rsquo;re treated as Tough Survivors. You can make faithful henchmen out of skilled and highly-capable NPCs, but this requires that you actually have done them some favor or help that would reasonably earn such fierce loyalty.",
    ),
    { bonusSkills: ["lead"], bonusSkillsPick: 1 },
  ),
  focus(
    "Iron Stomach",
    desc(
      "You are capable of eating even the most unappetizing, badly-contaminated, and semi-rotten foodstuffs without incurring harm, though you still can&rsquo;t eat outright poison or other wholly inedible substances.",
      "Gain Survive as a bonus skill. You do not need to make a disease check when drinking unfiltered water and you need only one ration of food every two days. You gain a +2 bonus on all saves versus poison or diseases.",
      "Your System Strain maximum increases by +2, to a maximum of 20. By constant casual foraging of insects, grasses, bark, and other semi-edible substances you can feed yourself in any natural environment. You become immune to poisons short of military-grade engineered toxins.",
    ),
    {
      bonusSkills: ["survive"],
      bonusSkillsPick: 1,
      levels: [{ level: 1, changes: [ch("system.saves.base.mod", "add", 2, "initial")] }],
    },
  ),
  focus(
    "Natural Immunity",
    desc(
      "You have a remarkably strong immune system and are impervious to most ordinary sicknesses.",
      "Your maximum System Strain increases by 2 points, up to a maximum of 20. You gain a +4 bonus on all saving throws versus diseases, and any diseases you incur are reduced one level of severity, with Mild diseases automatically resisted.",
      "As level 1, but your maximum System Strain increases by a further +2 to a maximum of 22. You are immune to all normal diseases.",
    ),
    {
      levels: [{ level: 1, changes: [ch("system.saves.base.mod", "add", 4, "initial")] }],
    },
  ),
  focus(
    "Pathfinder",
    desc(
      "Even without navigation gear you have an instinctive knack for directions and safe routes of travel.",
      "Gain Survive as a bonus skill. You always know what direction you&rsquo;re facing. Groups you lead cannot Go Astray, and gain bonus movement equal to two hours of travel without actually taking that time.",
      "Scouting a hex takes half the ordinary time. You&rsquo;re so good at choosing routes and muffling noise that your group is not considered Exposed even if you follow a road or drive a vehicle.",
    ),
    { bonusSkills: ["survive"], bonusSkillsPick: 1 },
  ),
  focus(
    "Road Warrior",
    desc(
      "You pair enormous natural talent at driving with a zest for highway bloodshed. This focus benefits only the driver of a vehicle, and for sci-fi campaign settings it does not include starships or non-atmospheric craft.",
      "Gain Drive as a bonus skill. Once per scene, as an Instant action, reroll a Drive skill check. Any vehicle you drive has bonus hit points equal to twice your character level. You take no hit penalty for shooting from a moving vehicle and gain a bonus Main Action each round that can only be used to attack with a weapon while driving or fire a vehicle-mounted weapon.",
      "Any vehicle you drive gains a +1 Speed bonus. Allies riding with you suffer no penalty for shooting from a moving vehicle. Once per scene, gain the benefits of the Veteran&rsquo;s Luck Edge applied only to vehicle weapons or hits by weapons against the vehicle you&rsquo;re driving.",
    ),
    {
      bonusSkills: ["drive"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "scene",
    },
  ),
  focus(
    "Robot Whisperer",
    desc(
      "You have an intuitive knack for dealing with robotic entities or AIs, whether diplomatically or otherwise.",
      "Gain Fix or Program as a bonus skill. Once per day, as an Instant action, reroll any social skill check made involving an expert system robot, VI, or AI. Gain a +2 bonus on all Reaction Rolls involving robots. Gain a +4 bonus on hit and damage rolls toward robots, and you can harm them even with primitive weapons or unarmed attacks.",
      "You have mastered esoteric override codes. Once per scene, as a Main Action, issue a command to an expert system robot that is no longer than two sentences. The robot gets a Mental save to resist at a penalty equal to your Fix or Program skill level; on a failure, it obeys that command for up to a scene, even if suicidal. VIs and AIs cannot be controlled this way.",
    ),
    {
      bonusSkills: ["fix", "program"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
    },
  ),
  focus(
    "Scrapsmith",
    desc(
      "You find use in the smallest fragment of salvage, and can build things far more efficiently and effectively than other technicians.",
      "Gain Fix as a bonus skill. Building devices from scrap costs half as much scrap as it normally would, rounded up. Once per game session, you can declare that you actually have any device, weapon, or object your skills and resources would have allowed you to make during recent downtime, though it costs no scrap and can&rsquo;t be larger than a suit of armor. Any weapon using ammo is fully loaded. This device or object functions until you use this ability again, after which it breaks down due to lack of maintenance.",
      "You can repair damaged weapons, armor, or personal equipment without needing to use scrap, and can fix a whole party&rsquo;s gear in fifteen minutes. When you break down an object for scrap, you get 50% more scrap from it, rounded down.",
    ),
    { bonusSkills: ["fix"], bonusSkillsPick: 1 },
  ),
  focus(
    "Shocking Assault",
    desc(
      "You&rsquo;re extremely dangerous to enemies around you. The ferocity of your melee attacks stresses and distracts enemies even when your blows don&rsquo;t draw blood.",
      "Gain Punch or Stab as a bonus skill. The Shock damage of your weapon treats all targets as if they were AC 10, assuming your weapon is capable of harming the target in the first place and the target is not immune to Shock.",
      "In addition, you gain a +2 bonus to the Shock damage rating of all melee weapons and unarmed attacks that do Shock. As usual, regular hits never do less damage than this Shock would do.",
    ),
    {
      bonusSkills: ["punch", "stab"],
      bonusSkillsPick: 1,
      levels: [
        { level: 1, changes: [ch("system.combat.treatAllMeleeAsAcTen", "override", "true", "final")] },
        { level: 2, changes: [ch("system.combat.meleeShock", "add", 2, "final")] },
      ],
    },
  ),
  focus(
    "Skilled Combat Rider",
    desc(
      "You were meant to fight from beast-back. You can always find a horse or setting-equivalent riding beast with a week of searching if any are to be had in the area. This may be a self-broken wild mustang or an &ldquo;acquired&rdquo; animal. Only you can ride this mount.",
      "Gain Drive or Ride as a bonus skill. Your mount shares your AC, if better, and once per round you can take damage in lieu of harm to your mount. Any beast you ride counts as a combat-trained animal in terms of the mounted combat rules.",
      "Any beast you ride counts as a war beast for training purposes. You suffer no penalty for ranged mounted attacks. Your mount gains 10 bonus hit points to their maximum. These bonus hit points are refreshed at the start of each fight.",
    ),
    { bonusSkills: ["drive", "ride"], bonusSkillsPick: 1 },
  ),
  focus(
    "Slippery",
    desc(
      "You are remarkably hard to grapple or restrain, either due to natural nimbleness, flexible joints, or blind luck.",
      "Gain Punch or Exert as a bonus skill. You gain a natural +4 bonus on all rolls to resist grappling attempts and can slip out of any restraints short of a full-body straitjacket as a Main Action. You can make a Fighting Withdrawal as an On Turn action.",
      "As level 1, but you cannot be grappled against your will. Your Dexterity modifier increases by +1, to a maximum of +2.",
    ),
    {
      bonusSkills: ["punch", "exert"],
      bonusSkillsPick: 1,
      levels: [{ level: 2, changes: [ch("system.abilities.dex.baseMod", "add", 1, "initial")] }],
    },
  ),
  focus(
    "Sniper's Eye",
    desc(
      "You are an expert at placing a bullet or arrow on an unsuspecting target. These special benefits only apply when making an Execution Attack with a gun, bow, or thrown weapon.",
      "Gain Shoot as a bonus skill. When making a skill check for a ranged Execution Attack or target shooting, roll 3d6 and drop the lowest die.",
      "You don&rsquo;t miss ranged Execution Attacks. A target hit by one takes a -4 penalty on the Physical saving throw to avoid immediate mortal injury. Even if the save is successful, the target takes double the normal damage inflicted by the attack.",
    ),
    { bonusSkills: ["shoot"], bonusSkillsPick: 1, bonusDice: 1, skillBonus: "shoot" },
  ),
  focus(
    "Spark of Brilliance",
    desc(
      "Whether a grizzled veteran who can still perform when the chips are down or a young prodigy with flashes of genius, you demonstrate sudden moments of superlative skill.",
      "Gain any skill as a bonus skill. Pick three skills relevant to your background or concept. Once per day, as an Instant action, treat one of those skills as level-4 for the rest of the scene. This insight doesn&rsquo;t last long enough to undertake prolonged efforts such as gear construction or mod maintenance, but it&rsquo;s time enough for surgery or repair. Any time you advance a level, you may choose to swap out this focus for a different one.",
    ),
    {
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
    },
  ),
  focus(
    "Specialist",
    desc(
      "You are remarkably talented at a particular skill. Whether a marvelous cat burglar, a natural athlete, a brilliant engineer, or some other savant, your expertise is extremely reliable. You may take this focus more than once for different skills.",
      "Gain a non-combat skill as a bonus. Roll 3d6 and drop the lowest die for all skill checks in this skill.",
      "Roll 4d6 and drop the two lowest dice for all skill checks in this skill.",
    ),
    { bonusSkillsPick: 1, bonusDice: 1, skillBonus: "" },
  ),
  focus(
    "Strong Back",
    desc(
      "You can carry a remarkable amount of gear for someone of your size and strength, gaining special benefits in Encumbrance.",
      "Gain Exert as a bonus skill. Your Strength is treated as 18 for purposes of Encumbrance. You can carry a downed teammate as if they were 6 points of Encumbrance, and it does not slow down your overland travel.",
      "Your Strength modifier increases by +1, to a maximum of +2. You can use your Stowed Encumbrance as if it were Readied, and it takes you no extra time to break open bundled gear.",
    ),
    {
      bonusSkills: ["exert"],
      bonusSkillsPick: 1,
      levels: [{ level: 2, changes: [ch("system.abilities.str.baseMod", "add", 1, "initial")] }],
    },
  ),
  focus(
    "Survivalist",
    desc(
      "You are a grizzled survivor of harsh environments and bitter privation. A lifestyle that would rapidly kill an office worker is no more than daily living for you.",
      "Gain Survive as a bonus skill. You can sleep without fire or shelter without suffering privation, barring midwinter conditions. A foraging party you are with rolls all foraging skill checks twice and takes the better roll. You can find enough food and water to sustain yourself while traveling normally through any non-desolate landscape.",
      "Your Constitution modifier increases by +1, to a maximum of +2. You sleep so lightly that you count as being awake for purposes of detecting danger or unusual events around the campsite.",
    ),
    {
      bonusSkills: ["survive"],
      bonusSkillsPick: 1,
      levels: [{ level: 2, changes: [ch("system.abilities.con.baseMod", "add", 1, "initial")] }],
    },
  ),
  focus(
    "Tinker",
    desc(
      "You have a natural talent for modifying and improving equipment.",
      "Gain Fix as a bonus skill. Your Maintenance score is doubled, allowing you to maintain twice as many mods. Vehicle and gear mods cost only half their usual price or scrap requirements, rounded up, though experimental component requirements remain the same.",
      "Your Fix skill is treated as one level higher for purposes of building and maintaining mods and calculating your Maintenance score, up to a maximum of Fix-5. Advanced mods require one fewer experimental component to make, down to a minimum of zero.",
    ),
    { bonusSkills: ["fix"], bonusSkillsPick: 1 },
  ),
  focus(
    "Unarmed Combatant",
    desc(
      "Your empty hands are more dangerous than knives in the grip of the less gifted. Your unarmed attacks are counted as melee weapons when it comes to binding up opponents wielding pistols, rifles and similar ranged arms, though you need at least one hand free to do so.",
      "Gain Punch as a bonus skill. Your unarmed attacks become more dangerous as your Punch skill increases: at level-0 they do 1d6 damage, at level-1 1d8, at level-2 1d10, level-3 1d12, and level-4 1d12+1. At Punch-1 or better, they have the Shock quality equal to your Punch skill against AC 15 or less. While you normally add your Punch skill level to any unarmed damage you inflict, don&rsquo;t add it twice to Shock damage. If using the optional Traumatic Hit rules, your attacks have a Trauma Die of 1d6 and a Trauma Rating of x2.",
      "Even on a miss with a Punch attack, you do an unmodified 1d6 damage, plus any Shock that the blow might inflict on the target. Your Trauma Die becomes 1d8 for lethal attacks.",
    ),
    {
      bonusSkills: ["punch"],
      bonusSkillsPick: 1,
      levels: [{ level: 2, changes: [ch("system.combat.punchMissDamage", "override", "1d6", "final")] }],
    },
  ),
  focus(
    "Unique Gift",
    desc(
      "Your PC has a unique type of mutation, an exceptional human ability, or some experimental genetic modification that grants them some benefit that isn&rsquo;t covered under existing options. This benefit shouldn&rsquo;t be a simple bonus to something you already do; it should be a power or ability that gives you options that you just wouldn&rsquo;t have otherwise. It&rsquo;s up to the GM to decide what&rsquo;s reasonable and fair to be covered under this gift, and whatever they allow should be roughly equivalent to the existing focus options in overall power. If an ability is particularly powerful or a mutation is especially draining, it might require the user to take System Strain to use it. As a general rule this ability should be better than a piece of gear the PC could buy, since the player is spending a very limited resource when they make this focus pick.",
    ),
    {},
  ),
  focus(
    "Unnumbered Friends",
    desc(
      "You have an astonishing ability to find or make friends in the most unlikely places.",
      "Gain Connect as a bonus skill. Once per game session, when dealing with a group or organization, the GM picks someone among them as a friend of yours or one who takes a great liking to you. They&rsquo;ll do favors that don&rsquo;t expose them to serious danger or loss, and the friendship will continue unless you or your allies directly harm them or things they love.",
      "Your Charisma modifier increases by +1, to a maximum of +2. Once per session, spend an hour socializing with someone. They become your good friend unless they have a very good reason not to be, and will remain so until you or your allies betray the friendship.",
    ),
    {
      bonusSkills: ["connect"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
      levels: [{ level: 2, changes: [ch("system.abilities.cha.baseMod", "add", 1, "initial")] }],
    },
  ),
  focus(
    "Unstable Mutant",
    desc(
      "Your mutations are prone to shifting randomly over time as your body seeks a stasis it never quite achieves. This focus is available only to PCs with the Mutant Edge.",
      "You gain one randomly-rolled positive mutation. This mutation is rerolled at the start of each month. Once per day, as a Main Action, accept four points of System Strain to reroll the mutation right then and there.",
      "When you reroll this focus&rsquo;s mutation, roll twice and pick whichever you prefer. Once per week, as a Main Action, accept four points of System Strain and shift this mutation to any positive mutation of your choice. This change lasts one scene, after which it reverts to its prior roll.",
    ),
    { internalResource: { value: 0, max: 1 }, resourceLength: "day" },
  ),
  focus(
    "Whirlwind Assault",
    desc(
      "You are a frenzy of bloody havoc in melee combat, and can hack down numerous lesser foes in close combat&hellip; assuming you survive being surrounded.",
      "Gain Stab or Punch as a bonus skill. Once per scene, as an On Turn action, apply your Shock damage to all foes within melee range, assuming they&rsquo;re susceptible to your Shock.",
      "The first time you kill someone in a round with a normal attack, either with its rolled damage on a hit or with the Shock damage it inflicts, instantly gain a second attack on any target within range using any Ready weapon you have.",
    ),
    {
      bonusSkills: ["stab", "punch"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "scene",
    },
  ),
  focus(
    "Zombie Smasher",
    desc(
      "Whether through long practice or sheer bloodthirst, you are incredibly efficient at putting down the dead. This focus is inapplicable to non-Deadlands campaigns.",
      "As a Main Action, kill up to six zombies of 1 HD or less within range of your weapon. If using a gun, expend one bullet or charge per zombie. Each use of this ability in a scene after the first adds one System Strain.",
      "Your attack roll against zombies always counts as a natural 20. You do an additional 8 points of damage to zombies on a hit.",
    ),
    {},
  ),
];

// ---------------------------------------------------------------------------
// Generation
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
 * @param {object} spec  Entry produced by focus().
 * @param {string} folderId
 * @param {string|undefined} existingId
 * @param {string} idSeed
 */
function buildFocusDoc(spec, folderId, existingId, idSeed) {
  const _id = existingId || randomId(idSeed);
  const effects = spec.levels.map(({ level, changes }) =>
    makeEffect(_id, randomId(`${idSeed}-fx-l${level}`), `${spec.name} (Level ${level})`, changes, {
      focusLevel: level,
    }),
  );
  return {
    name: spec.name,
    type: "focus",
    img: FOCUS_IMG,
    effects,
    flags: {},
    system: {
      description: spec.description,
      ownedLevel: 1,
      resourceGrant: spec.resourceGrant,
      internalResource: spec.internalResource,
      resourceLength: spec.resourceLength,
      bonusSkills: [...spec.bonusSkills],
      bonusSkillsPick: spec.bonusSkillsPick,
      bonusSkillsChosen: [],
      bonusDice: spec.bonusDice,
      skillBonus: spec.skillBonus,
    },
    _id,
    folder: folderId,
    sort: 0,
    ownership: { default: 0 },
    _key: `!items!${_id}`,
  };
}

/**
 * Write foci into `<pack>/Foci`, preserving existing `_id`s by name and
 * deleting stale focus files first. Leaves Skills (and any other non-focus
 * documents) untouched.
 * @param {string} pack  e.g. "abilities-swn"
 * @param {string} seedPrefix  e.g. "swn"
 * @param {object[]} foci  Entries produced by focus().
 */
function generateFociForPack(pack, seedPrefix, foci) {
  const dir = path.join("packs", "source", pack);
  const allDocs = [...readSourceDocs(dir)];

  const existingIdByName = new Map();
  for (const doc of allDocs) {
    if (doc.type === "focus") existingIdByName.set(doc.name, doc._id);
  }

  // Delete stale focus item files (Skills and folders are untouched).
  for (const file of walkJsonFiles(dir)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw.type === "focus") fs.unlinkSync(file);
  }

  const nonFocusDocs = allDocs.filter((d) => d.type !== "focus");
  let fociFolder = nonFocusDocs.find((d) => isFolderDoc(d) && d.name === "Foci" && !d.folder);
  if (!fociFolder) {
    fociFolder = makeFolder("Foci", "Item", null, `${pack}-foci`);
  }

  const foldersById = buildFoldersById([...nonFocusDocs, fociFolder]);
  writeSourceDoc(dir, fociFolder, foldersById);

  for (const spec of foci) {
    const idSeed = `${seedPrefix}-focus-${spec.name}`;
    const doc = buildFocusDoc(spec, fociFolder._id, existingIdByName.get(spec.name), idSeed);
    writeSourceDoc(dir, doc, foldersById);
  }

  console.log(`${pack}: wrote ${foci.length} foci (folder ${fociFolder._id})`);
  return foci.length;
}

const swnCount = generateFociForPack("abilities-swn", "swn", swnFoci);
const awnCount = generateFociForPack("abilities-awn", "awn", awnFoci);

console.log(`Done. Generated ${swnCount} SWN foci and ${awnCount} AWN foci.`);
