/**
 * One-shot pack generator: writes Focus items into abilities-cwn.
 *
 * - Ensures a top-level "Foci" folder exists in the pack.
 * - Preserves existing focus `_id`s by name across re-runs.
 * - Deletes stale focus files before rewriting (Skills are left untouched).
 *
 * Run: node ./build/generate-cwn-foci.mjs
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
 * @param {{ focusLevel?: number, disabled?: boolean, skipFocusLevelSync?: boolean }} [opts]
 */
function makeEffect(parentId, effectId, name, changes, { focusLevel, disabled = false, skipFocusLevelSync = false } = {}) {
  if (skipFocusLevelSync) {
    return {
      _id: effectId,
      type: "base",
      name,
      img: FOCUS_IMG,
      transfer: true,
      disabled: true,
      system: { changes },
      flags: { wwn: { skipFocusLevelSync: true } },
      _key: `!items.effects!${parentId}.${effectId}`,
    };
  }
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
 * `extraEffects` is a list of `{ name, changes, skipFocusLevelSync, disabled }`
 * entries for choice-driven effects that are never auto-synced (e.g. All Natural's
 * per-attribute picks), always authored disabled for the player to enable manually.
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
    extraEffects: opts.extraEffects ?? [],
  };
}

// ---------------------------------------------------------------------------
// CWN foci (26)
// ---------------------------------------------------------------------------

const cwnFoci = [
  focus(
    "Ace Driver",
    desc(
      "If it&rsquo;s got wheels or wings, you can drive it. Your background may lend itself to a particular type of transport, but your natural talent lets you operate any vehicle with an almost instinctive aptitude. These focus benefits do not apply to drone piloting, however.",
      "Gain Drive as a bonus skill. You have &ldquo;acquired&rdquo; vehicles worth no more than your character level&rsquo;s budget, and can replace lost or destroyed gear at a rate of $10,000 per week. Once per scene, as an Instant action, reroll a failed skill check related to driving or vehicle maintenance and repair.",
      "Gain Fix as a bonus skill. The Speed of a vehicle you drive is increased by 1 point. Once per vehicle, you can add a mod to it for free, ignoring money and experimental component costs. Only you can effectively operate this mod, but it requires no Maintenance. You can change this free mod with a week of downtime.",
    ),
    {
      bonusSkills: ["drive"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "scene",
    },
  ),
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
    "All Natural",
    desc(
      "Your mind and body are superbly gifted, but this very excellence leaves you profoundly incompatible with most cyber. You cannot accept implants except for minor cosmetic ones with an unmodified System Strain cost of zero.",
      "Gain any skill as a bonus skill. Pick an attribute; its modifier increases by +1, up to a maximum of +3. You can make another such attribute pick at levels 3, 5, 7, and 10, choosing the same attribute or a different one. While you can still suffer Traumatic Hits, you never suffer major injuries.",
    ),
    {
      bonusSkills: [],
      bonusSkillsPick: 1,
      extraEffects: [
        {
          name: "All Natural (Strength)",
          changes: [ch("system.abilities.str.baseMod", "add", 1, "initial")],
          skipFocusLevelSync: true,
          disabled: true,
        },
        {
          name: "All Natural (Dexterity)",
          changes: [ch("system.abilities.dex.baseMod", "add", 1, "initial")],
          skipFocusLevelSync: true,
          disabled: true,
        },
        {
          name: "All Natural (Constitution)",
          changes: [ch("system.abilities.con.baseMod", "add", 1, "initial")],
          skipFocusLevelSync: true,
          disabled: true,
        },
        {
          name: "All Natural (Intelligence)",
          changes: [ch("system.abilities.int.baseMod", "add", 1, "initial")],
          skipFocusLevelSync: true,
          disabled: true,
        },
        {
          name: "All Natural (Wisdom)",
          changes: [ch("system.abilities.wis.baseMod", "add", 1, "initial")],
          skipFocusLevelSync: true,
          disabled: true,
        },
        {
          name: "All Natural (Charisma)",
          changes: [ch("system.abilities.cha.baseMod", "add", 1, "initial")],
          skipFocusLevelSync: true,
          disabled: true,
        },
      ],
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
    "Cyberdoc",
    desc(
      "Any skilled medic can implant and maintain cyber systems, but you have a special aptitude for the work.",
      "Gain Fix and Heal as bonus skills. You start play with a cyberdoc kit, and you can implant cyberware even if your Heal skill is level-0. You gain a +2 bonus on all cyber implant surgery skill checks. If you perform cyber maintenance for a person, the delicacy of your adjustments decreases the total System Strain cost of their implants by one point until their next maintenance interval.",
      "The quality of your cyber maintenance improves; the System Strain decrease is equal to two points now instead of one. You never fail to install cyberware correctly. Once per patient, you can build and install a cyber modification to a system without any cost in money or experimental components, assuming you have the requisite skill levels to build it.",
    ),
    { bonusSkills: ["fix", "heal"], bonusSkillsPick: 2 },
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
      "Gain Talk as a bonus skill. You speak all the languages common to the city and can learn new ones to a workable level in a week, becoming fluent in a month. Reroll 1s on any skill check dice related to negotiation or diplomacy.",
      "Once per game session, shift an intelligent NPC&rsquo;s reaction roll one step closer to friendly if you can talk to them for at least thirty seconds.",
    ),
    { bonusSkills: ["talk"], bonusSkillsPick: 1 },
  ),
  focus(
    "Drone Pilot",
    desc(
      "While anyone can drive a drone under casual circumstances, your knack for it is something unusual.",
      "Gain Drive as a bonus skill. You acquire or start play with a Remote Control Unit cybersystem and its installation. Through connections, scavenging, and parts repurpose, you have free drones and their weapons and fittings worth no more than your character level&rsquo;s budget. You can repair these drones without needing spare parts, and destroyed drones can be replaced with a week&rsquo;s work. You always have the equivalent of a drone repair kit on you at no Encumbrance cost.",
      "You can use the Assume Command drone action once per round as an On Turn action. Once per scene, gain a bonus Main Action to command a drone. Any drones you control gain a +2 bonus to their hit rolls, whether or not you&rsquo;re personally firing their weaponry.",
    ),
    {
      bonusSkills: ["drive"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "scene",
    },
  ),
  focus(
    "Expert Programmer",
    desc(
      "A skilled hacker can program their own utilities, but you take this expertise far beyond the norm.",
      "Gain Program as a bonus skill. You can create and maintain an additional number of program elements equal to your character level+2, split among Verbs and Subjects as you see fit. You can change your choices with a week&rsquo;s work. Once per day, as an On Turn action, you can make an on-the-fly edit to a Subject program element to turn it into any other Subject program element you need. The element remains altered until you change it again.",
      "Your programs are exceedingly efficient. Any program elements you write take up only half the usual Memory. A cyberdeck you use gains a CPU bonus equal to your Program skill level.",
    ),
    { bonusSkills: ["program"], bonusSkillsPick: 1 },
  ),
  focus(
    "Healer",
    desc(
      "Healing comes naturally to you, and you&rsquo;re particularly gifted at preventing the quick bleed-out of wounded allies and comrades.",
      "Gain Heal as a bonus skill. You may attempt to stabilize one mortally-wounded adjacent person per round as an On Turn action. When rolling Heal skill checks, roll 3d6 and drop the lowest die.",
      "Pharmaceuticals or other technological healing devices applied by you heal twice as many hit points as normal. Using only basic medical supplies, you can heal 1d6+Heal skill hit points of damage to every injured or wounded person in your group with ten minutes of first aid spread among them. Such healing adds no System Strain, but can be applied to a given target only once per day.",
    ),
    { bonusSkills: ["heal"], bonusSkillsPick: 1, bonusDice: 1, skillBonus: "heal" },
  ),
  focus(
    "Henchkeeper",
    desc(
      [
        "You have a distinct knack for picking up lost souls who willingly do your bidding. You might induce them with promises of money, power, excitement, sex, or some other prize that you may or may not eventually grant. A henchman obtained with this focus will serve in loyal fashion until clearly betrayed or placed in unacceptable danger. Henchmen are not &ldquo;important&rdquo; people, and are usually marginal sorts, criminals, the desperate, or other persons with few options.",
        "You can use more conventional pay or inducements to acquire additional henchmen, but these extra hirelings are no more loyal or competent than your pay and treatment can purchase.",
      ],
      "Gain Lead as a bonus skill. You can acquire henchmen within 24 hours of arriving in a community, assuming anyone is suitable hench material. These henchmen will not fight except to save their own lives, but will go with you on missions and risk great danger to help you. Most corper henchmen will have 5 HP, a +0 attack bonus, and a Morale of 7, plus whatever gear they&rsquo;re given. Slum-dwellers and other natives of harsh societies will fight as Street Thugs if pressed. You can have one henchman at a time for every three character levels you have, rounded up. You can release henchmen with no hard feelings at any plausible time and pick them back up later should you be without a current henchman.",
      "Your henchmen are remarkably loyal and determined, and will fight for you against anything but clearly overwhelming odds. Whether through natural competence or their devotion to you, they&rsquo;re treated as a Basic Corp Security. You can make faithful henchmen out of skilled and highly-capable NPCs, but this requires that you actually have done them some favor or help that would reasonably earn such fierce loyalty.",
    ),
    { bonusSkills: ["lead"], bonusSkillsPick: 1 },
  ),
  focus(
    "Many Faces",
    desc(
      "You have multiple usable identities registered with corporate and governmental databases. These identities are so deeply embedded in the systems that they&rsquo;re almost impossible to pry out unless you do something to compromise them.",
      "Gain Sneak as a bonus skill. You can maintain one alternate identity at a time per three character levels, rounded up. These identities have their own names, backgrounds, criminal records, financial dealings, and bank accounts, and will register as authentic to all normal corporate and governmental checks. If an identity is compromised or you want a different one, you can replace it with a week&rsquo;s work. False identities cannot be important people or involve corporations you don&rsquo;t have a Contact in already.",
    ),
    { bonusSkills: ["sneak"], bonusSkillsPick: 1 },
  ),
  focus(
    "Pop Idol",
    desc(
      "Whether a street musician, graffiti artist, underground journalist, cam girl, folk singer, or Robin Hood-esque thief, you have a devoted following of enthusiasts who are willing to help you when you need them.",
      "Gain Perform as a bonus skill. Once per game week, with an hour or so of messaging, you can mobilize about a hundred of your fans to perform some act of your choice, provided it&rsquo;s no more than mildly criminal or slightly dangerous. Flash mobs, getaway drivers, scouting reports, tailing people, or instant parties might all qualify as services. Your fans don&rsquo;t have any special skills, but they&rsquo;ll do anything ordinary workers or civilians could do. If you mobilize them for donations or merch purchases, you get $1,000 per character level, doubled at fifth level and quadrupled at tenth. You can&rsquo;t mobilize them to buy your content more than once per month.",
      "You can mobilize up to a hundred fans per character level, though major mobs are likely to draw a law enforcement response. You&rsquo;ve cultivated fan leaders who can pass along your wishes deniably, concealing your involvement in the crowd. Your donation and merch earning amounts double. Your Charisma modifier increases by +1, to a maximum of +2.",
    ),
    {
      bonusSkills: ["perform"],
      bonusSkillsPick: 1,
      internalResource: { value: 0, max: 1 },
      resourceLength: "day",
    },
  ),
  focus(
    "Roamer",
    desc(
      "You might be a footloose bum with a knack for stowing aboard cargo shipments, a hard-bitten outlander smuggler, or a restless seeker of the horizon. Either way, you&rsquo;ve seen more of the world with your own two eyes than any common corper ever will.",
      "Gain Survive and Drive as bonus skills. You have conversational skill in all common languages spoken in the region or city, and you never get lost. You have &ldquo;acquired&rdquo; one or more vehicles worth no more than your character level&rsquo;s budget. You can replace lost or damaged vehicles at a rate of $10,000 per week.",
      "Once per scene, as an Instant action, you can reroll a failed skill check related to safe traveling or vehicle operation, whether to fix a blown engine or talk down a ganger who doesn&rsquo;t like strangers crossing his turf.",
    ),
    {
      bonusSkills: ["survive", "drive"],
      bonusSkillsPick: 2,
      internalResource: { value: 0, max: 1 },
      resourceLength: "scene",
    },
  ),
  focus(
    "Safe Haven",
    desc(
      "You have the contacts and expertise to find safehouses and bolt holes that no one else would think to find. You know how to persuade landlords into helping you for nebulous future advantages.",
      "Gain Sneak as a bonus skill. If you spend a week in a particular neighborhood, you can find or arrange a secure safe house and the on-call assistance of a local cyberdoc or medic willing to perform emergency care for no more than you can afford to pay. This safe house will always go unnoticed unless you are at Heat 8+ or specifically compromise it; even in that case, it will remain undiscovered for at least 24 hours if you can get to it without being followed. If a safe house is burnt, you can find a new one with another week&rsquo;s work. A PC can&rsquo;t have more safe houses active at once than their character level.",
      "Your safe houses are actively protected by the local authorities, be they gang members, paid-off cops, or cooperative corp security. Provided you don&rsquo;t make them angry, they&rsquo;ll defend you from most ordinary degrees of pursuit. You can find safe havens geared with the equivalent of tech workshops or level one cyberclinics.",
    ),
    { bonusSkills: ["sneak"], bonusSkillsPick: 1 },
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
    "Sniper's Eye",
    desc(
      "You are an expert at placing a bullet or arrow on an unsuspecting target. These special benefits only apply when making an Execution Attack with a gun, bow, or thrown weapon.",
      "Gain Shoot as a bonus skill. When making a skill check for a ranged Execution Attack or target shooting, roll 3d6 and drop the lowest die.",
      "You don&rsquo;t miss ranged Execution Attacks. A target hit by one takes a -4 penalty on the Physical saving throw to avoid immediate mortal injury. Even if the save is successful, the target takes double the normal damage inflicted by the attack.",
    ),
    { bonusSkills: ["shoot"], bonusSkillsPick: 1, bonusDice: 1, skillBonus: "shoot" },
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
    "Tinker",
    desc(
      "You have a natural talent for modifying and improving equipment.",
      "Gain Fix as a bonus skill. Your Maintenance score is doubled, allowing you to maintain twice as many mods. Vehicle, cyber, and gear mods cost only half their usual price in dollars, though experimental component requirements remain the same.",
      "Your Fix skill is treated as one level higher for purposes of building and maintaining mods and calculating your Maintenance score, up to a maximum of Fix-5. Advanced mods require one fewer experimental components to make, down to a minimum of zero.",
    ),
    { bonusSkills: ["fix"], bonusSkillsPick: 1 },
  ),
  focus(
    "Unarmed Combatant",
    desc(
      "Your empty hands are more dangerous than knives in the grip of the less gifted. Your unarmed attacks are counted as melee weapons when it comes to binding up opponents wielding pistols, rifles and similar ranged arms, though you need at least one hand free to do so.",
      "Gain Punch as a bonus skill. Your unarmed attacks become more dangerous as your Punch skill increases. At level-0, they do 1d6 damage. At level-1, they do 1d8 damage. At level-2 they do 1d10, level-3 does 1d12, and level-4 does 1d12+1. At Punch-1 or better, they have the Shock quality equal to your Punch skill against AC 15 or less. While you normally add your Punch skill level to any unarmed damage you inflict, don&rsquo;t add it twice to Shock damage. If you choose to strike lethally with unarmed attacks, they have a Trauma Die of 1d6 and a Trauma Rating of x2.",
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
    desc([
      "Your PC has a unique piece of cyberware, an exceptional human ability, or some experimental genetic modification that grants them some benefit that isn&rsquo;t covered under existing options.",
      "This benefit shouldn&rsquo;t be a simple bonus to something you already do; it should be a power or ability that gives you options that you just wouldn&rsquo;t have otherwise. It also shouldn&rsquo;t be used to simply optimize an existing character concept, but instead should allow you to make a character who wouldn&rsquo;t make sense without this special ability.",
      "It&rsquo;s up to the GM to decide what&rsquo;s reasonable and fair to be covered under this gift, and whatever they allow should be roughly equivalent to the existing focus options in overall power. If an ability is particularly powerful or the cybernetics are especially draining, it might require the user to take System Strain to use it.",
      "As a general rule this ability should be better than a piece of gear the PC could buy. The player is spending a very limited resource when they make this focus pick, so what they get should be good enough that they can&rsquo;t just duplicate it with a fat bank account.",
    ]),
    {},
  ),
  focus(
    "Unregistered",
    desc(
      "Whether by unrecorded birth, database corruption, or sheer luck, you simply do not exist in any government or corporate database. If taken with the <em><strong>Many Faces</strong></em> focus, your own identity is lost, but you can create others for your own uses. If this focus is taken after character creation, it means your existing records have become hopelessly corrupted and lost.",
      "You have no government or corporate database records associated with you, and it is almost impossible to add any such records without them ending up corrupted or deleted within a week. Human beings can remember you, but they can&rsquo;t rely on computerized records to keep track of you or your activities. You can keep money on credit chips or in cash, but banking or formal property ownership is almost impossible for you.",
    ),
    {},
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
  const levelEffects = spec.levels.map(({ level, changes }) =>
    makeEffect(_id, randomId(`${idSeed}-fx-l${level}`), `${spec.name} (Level ${level})`, changes, {
      focusLevel: level,
    }),
  );
  const extraEffects = spec.extraEffects.map((extra, i) =>
    makeEffect(_id, randomId(`${idSeed}-fx-extra-${i}`), extra.name, extra.changes, {
      skipFocusLevelSync: extra.skipFocusLevelSync,
      disabled: extra.disabled,
    }),
  );
  return {
    name: spec.name,
    type: "focus",
    img: FOCUS_IMG,
    effects: [...levelEffects, ...extraEffects],
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
 * @param {string} pack  e.g. "abilities-cwn"
 * @param {string} seedPrefix  e.g. "cwn"
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

generateFociForPack("abilities-cwn", "cwn", cwnFoci);
