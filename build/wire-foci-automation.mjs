/**
 * One-shot pack updater: bonus skills/dice + easy AEs for WWN foci.
 * Run: npm run generate:wire-foci
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FOCUS_BONUS_SKILL_SEEDS } from "../module/helpers/focus-automation-seeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "packs", "source", "abilities", "Foci_RHBA4gySPTttDbxD");

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".json") && !e.name.startsWith("_")) acc.push(p);
  }
  return acc;
}

function randomId(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function change(key, type, value, phase = "initial") {
  return { key, type, value, phase };
}

function attr(attrKey, value) {
  return change(`system.abilities.${attrKey}.baseMod`, "add", value, "initial");
}

function makeEffect(parentId, { name, changes, disabled = false, focusLevel = null, skipFocusLevelSync = false }) {
  const id = randomId();
  const flags = { wwn: {} };
  if (focusLevel != null) flags.wwn.focusLevel = focusLevel;
  if (skipFocusLevelSync) flags.wwn.skipFocusLevelSync = true;
  return {
    _id: id,
    type: "base",
    name,
    img: "systems/wwn/assets/icons/items/focus.png",
    transfer: true,
    disabled,
    system: { changes },
    flags,
    _key: `!items.effects!${parentId}.${id}`,
  };
}

function choiceAttrEffects(parentId, prefix, pairs) {
  // pairs: [[attrKey, label, value], ...]
  return pairs.map(([attrKey, label, value]) =>
    makeEffect(parentId, {
      name: `${prefix} (${label})`,
      changes: [attr(attrKey, value)],
      disabled: true,
      skipFocusLevelSync: true,
    }),
  );
}

/** Extra AEs to add when the focus does not already have effects covering the same idea. */
function buildExtraEffects(item) {
  const name = item.name;
  const id = item._id;
  const out = [];

  const addFixed = (effectName, changes, focusLevel = 1) => {
    out.push(makeEffect(id, { name: effectName, changes, focusLevel }));
  };

  switch (name) {
    case "Origin Focus: Anak, Great":
      addFixed("Anak, Great (Level 1)", [
        attr("str", 1),
        attr("con", 1),
        attr("dex", -1),
        attr("cha", -1),
      ]);
      break;
    case "Origin Focus: Anak, Lesser":
      addFixed("Anak, Lesser (Level 1)", [attr("dex", 1), attr("con", -1)]);
      break;
    case "Origin Focus: Drudge":
      addFixed("Drudge (Level 1)", [
        attr("str", 1),
        attr("con", 1),
        attr("int", -1),
        attr("cha", -1),
        change("system.saves.mental.mod", "add", 2, "initial"),
      ]);
      break;
    case "Origin Focus: Dwarf":
      addFixed("Dwarf (Level 1)", [attr("con", 1)]);
      out.push(
        ...choiceAttrEffects(id, "Dwarf", [
          ["dex", "Dexterity −1", -1],
          ["cha", "Charisma −1", -1],
        ]),
      );
      break;
    case "Origin Focus: Dwarf, Gyre":
      addFixed("Dwarf, Gyre (Level 1)", [change("system.hitDice.perLevelMod", "add", 1, "final")]);
      break;
    case "Origin Focus: Elf, Civilized":
      addFixed("Elf, Civilized (Level 1)", [attr("con", -1)]);
      out.push(
        ...choiceAttrEffects(id, "Elf, Civilized", [
          ["dex", "Dexterity +1", 1],
          ["int", "Intelligence +1", 1],
        ]),
      );
      break;
    case "Origin Focus: Elf, Forest":
      addFixed("Elf, Forest (Level 1)", [attr("dex", 1), attr("con", -1)]);
      break;
    case "Origin Focus: Goblin, Savage":
      addFixed("Goblin, Savage (Level 1)", [attr("dex", 1), attr("int", -1)]);
      break;
    case "Origin Focus: Goblin, Tinker":
      addFixed("Goblin, Tinker (Level 1)", [attr("wis", -1)]);
      out.push(
        ...choiceAttrEffects(id, "Goblin, Tinker", [
          ["dex", "Dexterity +1", 1],
          ["int", "Intelligence +1", 1],
        ]),
      );
      break;
    case "Origin Focus: Halfman":
      addFixed("Halfman (Level 1)", [
        attr("con", 1),
        change("system.saves.mental.mod", "add", 2, "initial"),
      ]);
      break;
    case "Origin Focus: Houri":
      addFixed("Houri (Level 1)", [
        attr("cha", 1),
        change("system.saves.mental.mod", "add", 2, "initial"),
      ]);
      break;
    case "Origin Focus: Laborer Blighted":
      addFixed("Laborer Blighted (Level 1)", [
        attr("str", 1),
        attr("con", 1),
        attr("int", -1),
        attr("wis", -1),
        attr("cha", -1),
        change("system.saves.mental.mod", "add", 2, "initial"),
      ]);
      break;
    case "Origin Focus: Lizardman":
      addFixed("Lizardman (Level 1)", [
        change("system.combat.innateAc.min", "upgrade", 13, "final"),
      ]);
      out.push(
        ...choiceAttrEffects(id, "Lizardman +1", [
          ["str", "Strength +1", 1],
          ["cha", "Charisma +1", 1],
        ]),
        ...choiceAttrEffects(id, "Lizardman −1", [
          ["dex", "Dexterity −1", -1],
          ["cha", "Charisma −1", -1],
        ]),
      );
      break;
    case "Origin Focus: Orc":
      addFixed("Orc (Level 1)", [attr("int", -1)]);
      out.push(
        ...choiceAttrEffects(id, "Orc", [
          ["str", "Strength +1", 1],
          ["con", "Constitution +1", 1],
        ]),
      );
      break;
    case "Origin Focus: Warlike Blighted":
      addFixed("Warlike Blighted (Level 1)", [change("system.combat.allAttack", "add", 1, "final")]);
      out.push(
        ...choiceAttrEffects(id, "Warlike Blighted Mental −1", [
          ["int", "Intelligence −1", -1],
          ["wis", "Wisdom −1", -1],
          ["cha", "Charisma −1", -1],
        ]),
        ...choiceAttrEffects(id, "Warlike Blighted Physical +1", [
          ["str", "Strength +1", 1],
          ["dex", "Dexterity +1", 1],
          ["con", "Constitution +1", 1],
        ]),
      );
      break;
    case "Origin Focus: Chattel Blighted":
      addFixed("Chattel Blighted (Level 1)", [change("system.combat.allAttack", "add", -2, "final")]);
      out.push(
        ...choiceAttrEffects(id, "Chattel Blighted", [
          ["con", "Constitution +1", 1],
          ["cha", "Charisma +1", 1],
        ]),
      );
      break;
    case "Origin Focus: Penal Blighted":
      addFixed("Penal Blighted (Level 1)", [change("system.saves.base.mod", "add", -2, "initial")]);
      out.push(
        ...choiceAttrEffects(id, "Penal Blighted", [
          ["str", "Strength −2", -2],
          ["dex", "Dexterity −2", -2],
          ["con", "Constitution −2", -2],
          ["int", "Intelligence −2", -2],
          ["wis", "Wisdom −2", -2],
          ["cha", "Charisma −2", -2],
        ]),
      );
      break;
    case "Origin Focus: Halfling":
      out.push(
        ...choiceAttrEffects(id, "Halfling", [
          ["con", "Constitution +1", 1],
          ["dex", "Dexterity +1", 1],
        ]),
      );
      break;
    case "Origin Focus: Gnome":
      out.push(
        ...choiceAttrEffects(id, "Gnome", [
          ["str", "Strength −1", -1],
          ["wis", "Wisdom −1", -1],
        ]),
      );
      break;
    case "Origin Focus: Automaton":
      out.push(
        ...choiceAttrEffects(id, "Automaton", [
          ["str", "Strength −1", -1],
          ["dex", "Dexterity −1", -1],
          ["con", "Constitution −1", -1],
          ["int", "Intelligence −1", -1],
          ["wis", "Wisdom −1", -1],
          ["cha", "Charisma −1", -1],
        ]),
      );
      break;
    case "Origin Focus: Undead":
      out.push(
        ...choiceAttrEffects(id, "Undead", [
          ["str", "Strength −1", -1],
          ["dex", "Dexterity −1", -1],
          ["con", "Constitution −1", -1],
          ["int", "Intelligence −1", -1],
          ["wis", "Wisdom −1", -1],
          ["cha", "Charisma −1", -1],
        ]),
      );
      break;
    case "Origin Focus: Functionary Blighted":
      out.push(
        ...choiceAttrEffects(id, "Functionary Blighted", [
          ["str", "Strength −1", -1],
          ["dex", "Dexterity −1", -1],
          ["con", "Constitution −1", -1],
          ["int", "Intelligence −1", -1],
          ["wis", "Wisdom −1", -1],
          ["cha", "Charisma −1", -1],
        ]),
      );
      break;
    case "Xenoblooded":
      out.push(
        makeEffect(id, {
          name: "Xenoblooded (Str +1 / Dex −1)",
          changes: [attr("str", 1), attr("dex", -1)],
          disabled: true,
          skipFocusLevelSync: true,
        }),
        makeEffect(id, {
          name: "Xenoblooded (Dex +1 / Str −1)",
          changes: [attr("dex", 1), attr("str", -1)],
          disabled: true,
          skipFocusLevelSync: true,
        }),
      );
      break;
    default:
      break;
  }
  return out;
}

const SKIP_AE_NAMES = new Set([
  "Alert",
  "Armsmaster",
  "Close Combatant",
  "Deadeye",
  "Die Hard",
  "Impervious Defense",
  "Polymath",
  "Shocking Assault",
  "Developed Attribute",
]);

let updated = 0;
for (const file of walk(root)) {
  const item = JSON.parse(fs.readFileSync(file, "utf8"));
  if (item.type !== "focus") continue;
  let changed = false;

  const spec = FOCUS_BONUS_SKILL_SEEDS[item.name];
  if (spec) {
    if (spec.skills) {
      item.system.bonusSkills = [...spec.skills];
      changed = true;
    }
    if (spec.pick != null) {
      item.system.bonusSkillsPick = spec.pick;
      changed = true;
    }
    if (spec.bonusDice != null) {
      item.system.bonusDice = spec.bonusDice;
      changed = true;
    }
    if (spec.skillBonus !== undefined) {
      item.system.skillBonus = spec.skillBonus;
      changed = true;
    }
  }

  if (!SKIP_AE_NAMES.has(item.name)) {
    const extras = buildExtraEffects(item);
    if (extras.length) {
      // Avoid duplicating if re-run: skip when any effect name already matches.
      const existingNames = new Set((item.effects ?? []).map((e) => e.name));
      const toAdd = extras.filter((e) => !existingNames.has(e.name));
      if (toAdd.length) {
        item.effects = [...(item.effects ?? []), ...toAdd];
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, `${JSON.stringify(item, null, 2)}\n`);
    updated += 1;
    console.log(`Updated ${item.name}`);
  }
}

console.log(`Done. Updated ${updated} foci.`);
