/**
 * Generate SWN psychic technique powers into abilities-swn.
 *
 * - Writes Psychic Techniques / {Discipline} folders.
 * - Preserves existing psychic power `_id`s by discipline+name when re-run.
 * - Deletes stale psychic power files before rewriting (Foci/Skills untouched).
 *
 * Run: node ./build/generate-swn-psychic.mjs
 * Or:  npm run generate:swn-psychic
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
import {
  PSYCHIC_IMG,
  DISCIPLINES,
  PSYCHIC_TECHNIQUES,
} from "./swn-psychic-seeds.mjs";

const PACK = "abilities-swn";
const PACK_DIR = path.join("packs", "source", PACK);

const ACTION_TYPE_RE = /^(Main|Move|On Turn|Instant)\b/i;
const FORMULA_RE = /^[\d(@]/;

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

/** @param {string} dir @param {string[]} [acc] */
function walkFolderJson(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFolderJson(full, acc);
    else if (entry.name === "_Folder.json") acc.push(full);
  }
  return acc;
}

/**
 * @param {object} seed
 */
function sanitizeActivation(seed) {
  const raw = seed.activation ?? {};
  let roll = String(raw.roll ?? "").trim();
  let duration = String(raw.duration ?? "").trim();
  if (roll && ACTION_TYPE_RE.test(roll) && !FORMULA_RE.test(roll)) {
    if (!duration) duration = roll;
    roll = "";
  }
  return {
    roll,
    rollType: raw.rollType ?? "result",
    rollTarget: Number(raw.rollTarget) || 0,
    save: String(raw.save ?? ""),
    range: String(raw.range ?? ""),
    duration,
  };
}

/**
 * @param {object} seed
 * @returns {Array<{ cost: number, length: string, note: string }>}
 */
function normalizeCommitment(seed) {
  const opts = seed.commitmentOptions;
  if (Array.isArray(opts) && opts.length) {
    return opts.map((o) => ({
      cost: Number(o.cost) || 0,
      length: o.length || "none",
      note: String(o.note ?? ""),
    }));
  }
  return [{ cost: 0, length: "none", note: "" }];
}

/**
 * @param {object} seed
 * @param {string} folderId
 */
function buildPsychicDoc(seed, folderId) {
  const _id = seed.id;
  const disciplineLabel = DISCIPLINES[seed.discipline] ?? seed.discipline;
  return {
    name: seed.name,
    type: "power",
    img: PSYCHIC_IMG,
    effects: [],
    flags: {
      core: {
        sourceId: `Compendium.wwn.abilities-swn.${_id}`,
      },
    },
    system: {
      subType: "psychic",
      description: seed.description,
      source: disciplineLabel,
      customTypeName: "",
      resourceName: "Psychic Effort",
      commitmentOptions: normalizeCommitment(seed),
      poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
      internalResource: { value: 0, max: 0 },
      internalResourceLength: "scene",
      isActive: false,
      effectApplication: "self",
      level: Number(seed.level) || 0,
      prepared: false,
      permanentStrain: 0,
      userStrain: String(seed.userStrain ?? ""),
      targetStrain: String(seed.targetStrain ?? ""),
      installed: false,
      alienationCost: 0,
      activation: sanitizeActivation(seed),
      damageRoll: String(seed.damageRoll ?? ""),
      healing: !!seed.healing,
      bonusSkills: [],
      bonusSkillsPick: 0,
      bonusSkillsChosen: [],
      bonusSkillsMode: "",
    },
    _id,
    folder: folderId,
    sort: (Number(seed.level) || 0) * 1000 + (seed.isCore ? 0 : 100),
    ownership: { default: 0 },
    _key: `!items!${_id}`,
  };
}

function generatePsychicPowers() {
  const allDocs = [...readSourceDocs(PACK_DIR)];

  // Delete existing psychic power JSON files.
  for (const file of walkJsonFiles(PACK_DIR)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw.type === "power" && raw.system?.subType === "psychic") fs.unlinkSync(file);
  }

  // Collect Psychic Techniques folder tree ids to remove.
  const psychicFolderIds = new Set();
  for (const d of allDocs) {
    if (!isFolderDoc(d)) continue;
    if (d.name === "Psychic Techniques" && !d.folder) psychicFolderIds.add(d._id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of allDocs) {
      if (!isFolderDoc(d) || !d.folder) continue;
      if (psychicFolderIds.has(d.folder) && !psychicFolderIds.has(d._id)) {
        psychicFolderIds.add(d._id);
        grew = true;
      }
    }
  }
  for (const file of walkFolderJson(PACK_DIR)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (isFolderDoc(raw) && psychicFolderIds.has(raw._id)) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }

  const preserved = allDocs.filter(
    (d) =>
      !(isFolderDoc(d) && psychicFolderIds.has(d._id))
      && !(d.type === "power" && d.system?.subType === "psychic"),
  );

  const root = makeFolder("Psychic Techniques", "Item", null, "swn-psy-folder-root");
  const disciplineFolders = {};
  for (const [key, label] of Object.entries(DISCIPLINES)) {
    disciplineFolders[key] = makeFolder(label, "Item", root._id, `swn-psy-folder-${key}`);
  }
  const folders = [root, ...Object.values(disciplineFolders)];
  const foldersById = buildFoldersById([...preserved, ...folders]);

  for (const folder of folders) {
    writeSourceDoc(PACK_DIR, folder, foldersById);
  }

  let written = 0;
  for (const seed of PSYCHIC_TECHNIQUES) {
    const folderId = disciplineFolders[seed.discipline]?._id;
    if (!folderId) {
      console.warn(`Unknown discipline for ${seed.name}: ${seed.discipline}`);
      continue;
    }
    const doc = buildPsychicDoc(seed, folderId);
    writeSourceDoc(PACK_DIR, doc, foldersById);
    written += 1;
  }

  console.log(`${PACK}: wrote ${written} psychic techniques`);
  return written;
}

generatePsychicPowers();
