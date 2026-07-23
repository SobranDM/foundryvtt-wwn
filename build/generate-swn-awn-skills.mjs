import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

function id16() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

function iconFor(slug) {
  const map = {
    administer: "administer",
    connect: "connect",
    exert: "exert",
    fix: "craft",
    heal: "heal",
    know: "know",
    lead: "lead",
    notice: "notice",
    perform: "perform",
    pilot: "sail",
    program: "know",
    punch: "punch",
    shoot: "shoot",
    sneak: "sneak",
    stab: "stab",
    survive: "survive",
    talk: "convince",
    trade: "trade",
    work: "work",
    drive: "ride",
    biopsionics: "psychic",
    metapsionics: "psychic",
    precognition: "psychic",
    telekinesis: "psychic",
    telepathy: "psychic",
    teleportation: "psychic",
    mentalism: "psychic",
    technomagic: "magic",
  };
  return `systems/wwn/assets/icons/skills/${map[slug] ?? "know"}.png`;
}

function skillDoc({ name, slug, description, score, secondary }) {
  const _id = id16();
  return {
    name,
    type: "skill",
    img: iconFor(slug),
    effects: [],
    flags: {},
    system: {
      description,
      ownedLevel: -1,
      score,
      skillDice: "2d6",
      secondary: !!secondary,
      slug,
    },
    _stats: {
      systemId: "wwn",
      systemVersion: null,
      coreVersion: null,
      createdTime: Date.now(),
      modifiedTime: null,
      lastModifiedBy: null,
    },
    _id,
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    _key: `!items!${_id}`,
  };
}

async function writePack(packName, skills) {
  const dir = path.join("packs/source", packName);
  await fs.mkdir(dir, { recursive: true });
  for (const s of skills) {
    const doc = skillDoc(s);
    const file = `${s.name.replace(/[^A-Za-z0-9]+/g, "_")}_${doc._id}.json`;
    await fs.writeFile(path.join(dir, file), `${JSON.stringify(doc, null, 2)}\n`);
  }
  console.log(`${packName}: ${skills.length} skills`);
}

const swn = [
  {
    name: "Administer",
    slug: "administer",
    score: "int",
    description:
      "Manage an organization, handle paperwork, analyze records, and keep an institution functioning on a daily basis. Roll it for bureaucratic expertise, organizational management, legal knowledge, dealing with government agencies, and understanding how institutions really work.",
  },
  {
    name: "Connect",
    slug: "connect",
    score: "cha",
    description:
      "Find people who can be helpful to your purposes and get them to cooperate with you. Roll it to make useful connections with others, find people you know, know where to get illicit goods and services, and be familiar with foreign cultures and languages. You can use it in place of Talk for persuading people you find via this skill.",
  },
  {
    name: "Exert",
    slug: "exert",
    score: "con",
    description:
      "Apply trained speed, strength, or stamina in some feat of physical exertion. Roll it to run, jump, lift, swim, climb, throw, and so forth. You can use it as a combat skill when throwing things, though it doesn't qualify as a combat skill for other ends.",
  },
  {
    name: "Fix",
    slug: "fix",
    score: "int",
    description:
      "Create and repair devices both simple and complex. How complex will depend on your character's background; a lostworlder blacksmith is going to need some study time before he's ready to fix that broken fusion reactor, though he can do it eventually. Roll it to fix things, build things, and identify what something is supposed to do.",
  },
  {
    name: "Heal",
    slug: "heal",
    score: "int",
    description:
      "Employ medical and psychological treatment for the injured or disturbed. Roll it to cure diseases, stabilize the critically injured, treat psychological disorders, or diagnose illnesses.",
  },
  {
    name: "Know",
    slug: "know",
    score: "int",
    description:
      "Know facts about academic or scientific fields. Roll it to understand planetary ecologies, remember relevant history, solve science mysteries, and know the basic facts about rare or esoteric topics.",
  },
  {
    name: "Lead",
    slug: "lead",
    score: "cha",
    description:
      "Convince others to also do whatever it is you're trying to do. Talk might persuade them that following you is smart, but Lead can make them do it even when they think it's a bad idea. Roll it to lead troops in combat, convince others to follow you, or maintain morale and discipline.",
  },
  {
    name: "Notice",
    slug: "notice",
    score: "wis",
    description:
      "Spot anomalies or interesting facts about your environment. Roll it for searching places, detecting ambushes, spotting things, and reading the emotional state of other people.",
  },
  {
    name: "Perform",
    slug: "perform",
    score: "cha",
    description:
      "Exhibit some performative skill. Roll it to dance, sing, orate, act, or otherwise put on a convincing or emotionally moving performance.",
  },
  {
    name: "Pilot",
    slug: "pilot",
    score: "dex",
    description:
      "Use this skill to pilot vehicles or ride beasts. Roll it to fly spaceships, drive vehicles, ride animals, or tend to basic vehicle repair. This skill doesn't help you with things entirely outside the scope of your background or experience, though with some practice a PC can expand their expertise.",
  },
  {
    name: "Program",
    slug: "program",
    score: "int",
    description:
      "Operating or hacking computing and communications hardware. Roll it to program or hack computers, control computer-operated hardware, operate communications tech, or decrypt things.",
  },
  {
    name: "Punch",
    slug: "punch",
    score: "str",
    description:
      "Use it as a combat skill when fighting unarmed. If your PC means to make a habit of this rather than as a recourse of desperation, you should take the Unarmed Combatant focus described later.",
  },
  {
    name: "Shoot",
    slug: "shoot",
    score: "dex",
    description:
      "Use it as a combat skill when using ranged weaponry, whether hurled rocks, bows, laser pistols, combat rifles, or ship's gunnery.",
  },
  {
    name: "Sneak",
    slug: "sneak",
    score: "dex",
    description:
      "Move without drawing notice. Roll it for stealth, disguise, infiltration, manual legerdemain, pickpocketing, and the defeat of security measures.",
  },
  {
    name: "Stab",
    slug: "stab",
    score: "str",
    description: "Use it as a combat skill when wielding melee weapons, whether primitive or complex.",
  },
  {
    name: "Survive",
    slug: "survive",
    score: "wis",
    description:
      "Obtain the basics of food, water, and shelter in hostile environments, along with avoiding their natural perils. Roll it to handle animals, navigate difficult terrain, scrounge urban resources, make basic tools, and avoid wild beasts or gangs.",
  },
  {
    name: "Talk",
    slug: "talk",
    score: "cha",
    description:
      "Convince other people of the facts you want them to believe. What they do with that conviction may not be completely predictable. Roll it to persuade, charm, or deceive others in conversation.",
  },
  {
    name: "Trade",
    slug: "trade",
    score: "cha",
    description:
      "Find what you need on the market and sell what you have. Roll it to sell or buy things, figure out where to purchase hard-to-get or illicit goods, deal with customs agents, or run a business.",
  },
  {
    name: "Work",
    slug: "work",
    score: "con",
    description:
      "This is a catch-all skill for professions not represented by other skills. Roll it to work at a particular profession, art, or trade.",
  },
  {
    name: "Biopsionics",
    slug: "biopsionics",
    score: "int",
    secondary: true,
    description: "Master powers of physical repair, body augmentation, and shapeshifting.",
  },
  {
    name: "Metapsionics",
    slug: "metapsionics",
    score: "int",
    secondary: true,
    description: "Master powers that nullify, boost, and shape the use of other psychic abilities.",
  },
  {
    name: "Precognition",
    slug: "precognition",
    score: "int",
    secondary: true,
    description: "Master the ability to sense future events and control probability.",
  },
  {
    name: "Telekinesis",
    slug: "telekinesis",
    score: "int",
    secondary: true,
    description: "Master the remote control of kinetic energy to move objects and fabricate force constructs.",
  },
  {
    name: "Telepathy",
    slug: "telepathy",
    score: "int",
    secondary: true,
    description: "Master the reading and influencing of other sapient minds.",
  },
  {
    name: "Teleportation",
    slug: "teleportation",
    score: "int",
    secondary: true,
    description: "Master the arts of physical translocation of yourself and allies.",
  },
];

const awn = [
  {
    name: "Administer",
    slug: "administer",
    score: "int",
    description:
      "Manage an organization, handle paperwork, analyze records, and keep an institution functioning on a daily basis. Roll it for bureaucratic expertise, organizational management, legal knowledge, dealing with government agencies, and getting answers from old files or records.",
  },
  {
    name: "Connect",
    slug: "connect",
    score: "cha",
    description:
      "Find people who can be helpful to your purposes and get them to cooperate with you. Roll it to make useful connections with others, find people you know, know where to get illicit goods and services, and be familiar with foreign cultures and languages. You can use it in place of Talk for persuading people you find via this skill. Note that the people you meet via Connect are not necessarily inclined to work with you without a good reason. Gifts can often be that reason.",
  },
  {
    name: "Drive",
    slug: "drive",
    score: "dex",
    description:
      "Drive vehicles, sail ships, fly planes, ride animals, or otherwise use vehicles or riding beasts, including basic repairs or mount care. The particular scope of a PC's skill depends on their background, but someone with a good Drive skill can quickly pick up other modes with a little practice. Primitive campaign worlds might substitute Ride for this skill.",
  },
  {
    name: "Exert",
    slug: "exert",
    score: "con",
    description:
      "Apply trained speed, strength, or stamina in some feat of physical exertion. Roll it to run, jump, lift, swim, climb, throw, and so forth. You can use it as a combat skill when throwing things, though it doesn't qualify as a combat skill for other uses.",
  },
  {
    name: "Fix",
    slug: "fix",
    score: "int",
    description:
      "Create and repair devices both simple and complex. Building gear out of salvaged components generally requires the Fix skill when creating anything of significant complexity.",
  },
  {
    name: "Heal",
    slug: "heal",
    score: "int",
    description:
      "Employ medical and psychological treatment for the injured or disturbed. Roll it to cure diseases, stabilize the critically injured, treat psychological disorders, or diagnose illnesses.",
  },
  {
    name: "Know",
    slug: "know",
    score: "int",
    description:
      "Know facts about academic or scientific fields. Roll it to understand academic topics, remember relevant history, solve science mysteries, and know the basic facts about rare or esoteric topics. For tribal societies, it also covers tribal law, custom, and lore.",
  },
  {
    name: "Lead",
    slug: "lead",
    score: "cha",
    description:
      "Convince others to also do whatever it is you're trying to do. Talk might persuade them that following you is smart, but Lead can make them do it even when they think it's a bad idea. Roll it to lead troops in combat, convince others to follow you, or maintain morale among your followers when the situation looks grim.",
  },
  {
    name: "Notice",
    slug: "notice",
    score: "wis",
    description:
      "Spot anomalies or interesting facts about your environment. Roll it for searching places, detecting ambushes, spotting things, and reading the emotional state of other people.",
  },
  {
    name: "Perform",
    slug: "perform",
    score: "cha",
    description:
      "Exhibit some performance skill. Roll it to dance, sing, orate, act, or otherwise put on a convincing or emotionally moving performance.",
  },
  {
    name: "Program",
    slug: "program",
    score: "int",
    description:
      "Operating or hacking computing and communications hardware. Some campaigns may have more opportunities to use this skill than others, so you may want to check with your GM first to find out how common functional computers are in whatever apocalyptic waste you're going to be entering.",
  },
  {
    name: "Punch",
    slug: "punch",
    score: "str",
    description:
      "Use it as a combat skill when fighting unarmed. If your PC means to make a habit of this rather than as a recourse of desperation, you should take the Unarmed Combatant Focus described later.",
  },
  {
    name: "Shoot",
    slug: "shoot",
    score: "dex",
    description:
      "Use it as a combat skill when using ranged weaponry, whether thrown weapons, bows, pistols, combat rifles, or heavy artillery.",
  },
  {
    name: "Sneak",
    slug: "sneak",
    score: "dex",
    description:
      "Move without drawing notice. Roll it for stealth, disguise, infiltration, manual legerdemain, pickpocketing, and the physical defeating of security measures such as locks, including electronic locks for PCs with some justification for being familiar with such things.",
  },
  {
    name: "Stab",
    slug: "stab",
    score: "str",
    description:
      "Use it as a combat skill when wielding melee weapons, whether primitive or complex. It can also be used when throwing weapons in lieu of Shoot.",
  },
  {
    name: "Survive",
    slug: "survive",
    score: "wis",
    description:
      "Every post-apocalyptic survivor is likely to know the basics of daily subsistence, but Survive skill gives the PC the knowledge to find food, avoid natural perils, track targets, and identify plants and animals in their familiar regions.",
  },
  {
    name: "Talk",
    slug: "talk",
    score: "cha",
    description:
      "Convince other people of the facts you want them to believe. What they do with that conviction may not be completely predictable. Roll it to persuade, charm, or deceive others in conversation.",
  },
  {
    name: "Trade",
    slug: "trade",
    score: "cha",
    description:
      "Find what you need on the market and sell what you have. Roll it to sell or buy things, figure out where to purchase hard-to-get or illicit goods, and discern the local value of salvage.",
  },
  {
    name: "Work",
    slug: "work",
    score: "con",
    description:
      "This is a catch-all skill for professions not represented by other skills, such as farmers or fine artists. Pick a profession; you have the technical skills associated with that role and can roll Work as Connect when dealing with others associated with your line of work.",
  },
  {
    name: "Mentalism",
    slug: "mentalism",
    score: "int",
    secondary: true,
    description: "Mentalism represents a Mentalist's mastery of their particular brand of Psychic abilities.",
  },
  {
    name: "Technomagic",
    slug: "technomagic",
    score: "int",
    secondary: true,
    description:
      "Technomagic skill is exclusive to Ash Sorcerers, and represents both their personal mastery of their arcane powers and their academic knowledge of the dark secrets of before-times science. It can be used to comprehend magic, know of techno-wizards, and apprehend facts about creatures born of dark sorcery.",
  },
];

await writePack("skills-swn", swn);
await writePack("skills-awn", awn);
