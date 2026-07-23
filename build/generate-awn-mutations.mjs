/**
 * Generate AWN mutation powers into abilities-awn and RollTables into tables-awn.
 *
 * - Writes Mutations / Positive / {category} / Negative folders under abilities-awn.
 * - Writes linked positive/negative tables + text stigma tables under tables-awn.
 * - Preserves existing mutation `_id`s by polarity+name when re-run.
 * - Deletes stale mutation power files and tables-awn contents before rewrite
 *   (Foci and Skills in abilities-awn are left untouched).
 *
 * Run: node ./build/generate-awn-mutations.mjs
 * Or:  npm run generate:awn-mutations
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
  MUTATION_IMG,
  POSITIVE_MUTATIONS,
  NEGATIVE_MUTATIONS,
  STIGMA_TABLES,
  allMutations,
} from "./awn-mutation-seeds.mjs";

const ABILITIES_PACK = "abilities-awn";
const TABLES_PACK = "tables-awn";
const ABILITIES_DIR = path.join("packs", "source", ABILITIES_PACK);
const TABLES_DIR = path.join("packs", "source", TABLES_PACK);

const CATEGORY_FOLDERS = {
  structure: "Structure",
  sense: "Sense",
  hybrid: "Hybrid",
  cognition: "Cognition",
  pseudoPsychic: "Pseudo-Psychic",
  exotic: "Exotic",
};

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

/**
 * @param {object} seed
 * @returns {{ roll: string, rollType: string, rollTarget: number, save: string, range: string, duration: string }}
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
 * @param {string} parentId
 * @param {string} effectId
 * @param {string} name
 * @param {object[]} changes
 * @param {{ disabled?: boolean }} [opts]
 */
function makeEffect(parentId, effectId, name, changes, { disabled = false } = {}) {
  return {
    _id: effectId,
    type: "base",
    name,
    img: MUTATION_IMG,
    transfer: true,
    disabled,
    system: { changes },
    flags: {},
    _key: `!items.effects!${parentId}.${effectId}`,
  };
}

/**
 * @param {object} seed
 * @param {string} folderId
 */
function buildMutationDoc(seed, folderId) {
  const _id = seed.id;
  const effects = (seed.effects ?? []).map((fx, i) =>
    makeEffect(
      _id,
      randomId(`awn-mut-fx-${seed.polarity}-${seed.name}-${i}`),
      fx.name,
      (fx.changes ?? []).map((c) => ({
        key: c.key,
        type: c.type,
        value: c.value,
        phase: c.phase ?? "initial",
      })),
      { disabled: !!fx.disabled },
    ),
  );

  const ir = seed.internalResource ?? { value: 0, max: 0 };
  return {
    name: seed.name,
    type: "power",
    img: MUTATION_IMG,
    effects,
    flags: {
      core: {
        sourceId: `Compendium.wwn.abilities-awn.${_id}`,
      },
    },
    system: {
      subType: "mutation",
      description: seed.description,
      source: seed.polarity === "positive" ? (CATEGORY_FOLDERS[seed.category] ?? "Positive") : "Negative",
      customTypeName: "",
      resourceName: "",
      commitmentOptions: [{ cost: 0, length: "none", note: "" }],
      poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
      internalResource: { value: Number(ir.value) || 0, max: Number(ir.max) || 0 },
      internalResourceLength: seed.internalResourceLength === "day" ? "day" : "scene",
      isActive: false,
      effectApplication: "self",
      level: 1,
      prepared: false,
      permanentStrain: 0,
      userStrain: String(seed.userStrain ?? ""),
      targetStrain: String(seed.targetStrain ?? ""),
      installed: false,
      alienationCost: 0,
      activation: sanitizeActivation(seed),
      damageRoll: String(seed.damageRoll ?? ""),
      healing: !!seed.healing,
      bonusSkills: [...(seed.bonusSkills ?? [])],
      bonusSkillsPick: Number(seed.bonusSkillsPick) || 0,
      bonusSkillsChosen: [],
      bonusSkillsMode: seed.bonusSkillsMode === "any" ? "any" : "",
    },
    _id,
    folder: folderId,
    sort: (seed.d10 ?? seed.tableRange?.[0] ?? 0) * 1000,
    ownership: { default: 0 },
    _key: `!items!${_id}`,
  };
}

/**
 * Ensure folder chain under abilities-awn; returns Map name->folder and foldersById.
 * @param {object[]} keepDocs non-mutation docs to preserve in folder map
 */
function ensureMutationFolders(keepDocs) {
  const folders = [];
  const byName = new Map();

  const ensure = (name, parentId, seed) => {
    const key = `${parentId ?? "root"}::${name}`;
    if (byName.has(key)) return byName.get(key);
    let existing = keepDocs.find(
      (d) => isFolderDoc(d) && d.name === name && (d.folder ?? null) === (parentId ?? null),
    );
    if (!existing) existing = makeFolder(name, "Item", parentId ?? null, seed);
    byName.set(key, existing);
    folders.push(existing);
    return existing;
  };

  const mutations = ensure("Mutations", null, "awn-mut-folder-mutations");
  const positive = ensure("Positive", mutations._id, "awn-mut-folder-positive");
  const negative = ensure("Negative", mutations._id, "awn-mut-folder-negative");
  const categories = {};
  for (const [key, label] of Object.entries(CATEGORY_FOLDERS)) {
    categories[key] = ensure(label, positive._id, `awn-mut-folder-${key}`);
  }

  return { mutations, positive, negative, categories, folders };
}

function generateMutationPowers() {
  const allDocs = [...readSourceDocs(ABILITIES_DIR)];
  const keepDocs = allDocs.filter((d) => {
    if (isFolderDoc(d)) {
      // Drop old mutation folder tree; recreate fresh. Keep Foci/Skills folders.
      const mutationFolderNames = new Set([
        "Mutations",
        "Positive",
        "Negative",
        ...Object.values(CATEGORY_FOLDERS),
      ]);
      // Only remove folders that are under Mutations — identified after we know structure.
      // Safer: delete mutation item files; remove empty Mutations tree folders by name if under Mutations.
      return true;
    }
    return d.type !== "power" || d.system?.subType !== "mutation";
  });

  // Delete existing mutation power JSON files.
  for (const file of walkJsonFiles(ABILITIES_DIR)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw.type === "power" && raw.system?.subType === "mutation") fs.unlinkSync(file);
  }

  // Remove prior Mutations folder tree files (folders only under Mutations).
  const mutationFolderIds = new Set();
  for (const d of allDocs) {
    if (!isFolderDoc(d)) continue;
    if (d.name === "Mutations" && !d.folder) mutationFolderIds.add(d._id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of allDocs) {
      if (!isFolderDoc(d) || !d.folder) continue;
      if (mutationFolderIds.has(d.folder) && !mutationFolderIds.has(d._id)) {
        mutationFolderIds.add(d._id);
        grew = true;
      }
    }
  }
  for (const file of walkJsonFiles(ABILITIES_DIR).concat(
    // also _Folder.json files
    (() => {
      const acc = [];
      const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name === "_Folder.json") acc.push(p);
        }
      };
      walk(ABILITIES_DIR);
      return acc;
    })(),
  )) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (isFolderDoc(raw) && mutationFolderIds.has(raw._id)) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }

  const preserved = keepDocs.filter((d) => !(isFolderDoc(d) && mutationFolderIds.has(d._id)));
  const { negative, categories, folders } = ensureMutationFolders(preserved);
  const foldersById = buildFoldersById([...preserved, ...folders]);

  for (const folder of folders) {
    writeSourceDoc(ABILITIES_DIR, folder, foldersById);
  }

  const docs = [];
  for (const seed of POSITIVE_MUTATIONS) {
    const folderId = categories[seed.category]._id;
    const doc = buildMutationDoc(seed, folderId);
    writeSourceDoc(ABILITIES_DIR, doc, foldersById);
    docs.push(doc);
  }
  for (const seed of NEGATIVE_MUTATIONS) {
    const doc = buildMutationDoc(seed, negative._id);
    writeSourceDoc(ABILITIES_DIR, doc, foldersById);
    docs.push(doc);
  }

  console.log(`${ABILITIES_PACK}: wrote ${docs.length} mutation powers`);
  return docs;
}

/**
 * @param {string} tableId
 * @param {string} name
 * @param {string} formula
 * @param {object[]} results
 * @param {string|null} folderId
 */
function buildTableDoc(tableId, name, formula, results, folderId) {
  return {
    _id: tableId,
    name,
    img: "icons/svg/d20-grey.svg",
    description: "",
    results,
    formula,
    replacement: true,
    displayRoll: true,
    folder: folderId,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: {
      systemId: "wwn",
      systemVersion: null,
      coreVersion: null,
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
    },
    _key: `!tables!${tableId}`,
  };
}

/**
 * @param {string} tableId
 * @param {string} resultId
 * @param {object} opts
 */
function textResult(tableId, resultId, { text, weight = 1, range }) {
  return {
    _id: resultId,
    type: "text",
    name: "",
    description: text,
    img: "icons/svg/d20-black.svg",
    documentUuid: null,
    weight,
    range,
    drawn: false,
    flags: {},
    _key: `!tables.results!${tableId}.${resultId}`,
  };
}

/**
 * @param {string} tableId
 * @param {string} resultId
 * @param {object} opts
 */
function documentResult(tableId, resultId, { name, documentId, weight = 1, range }) {
  return {
    _id: resultId,
    type: "document",
    name,
    description: "",
    img: MUTATION_IMG,
    documentUuid: `Compendium.wwn.abilities-awn.${documentId}`,
    weight,
    range,
    drawn: false,
    flags: {},
    _key: `!tables.results!${tableId}.${resultId}`,
  };
}

function clearTablesPack() {
  if (!fs.existsSync(TABLES_DIR)) {
    fs.mkdirSync(TABLES_DIR, { recursive: true });
    return;
  }
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json")) fs.unlinkSync(p);
    }
  };
  walk(TABLES_DIR);
}

function generateTables(mutationDocs) {
  clearTablesPack();

  const root = makeFolder("AWN Mutations", "RollTable", null, "awn-tables-root");
  const stigmaFolder = makeFolder("Stigmas", "RollTable", root._id, "awn-tables-stigmas");
  const positiveFolder = makeFolder("Positive Mutations", "RollTable", root._id, "awn-tables-positive");
  const negativeFolder = makeFolder("Negative Mutations", "RollTable", root._id, "awn-tables-negative");
  const folders = [root, stigmaFolder, positiveFolder, negativeFolder];
  const foldersById = buildFoldersById(folders);
  for (const f of folders) writeSourceDoc(TABLES_DIR, f, foldersById);

  const byId = new Map(mutationDocs.map((d) => [d._id, d]));
  const positives = POSITIVE_MUTATIONS;
  const negatives = NEGATIVE_MUTATIONS;

  // Category d10 tables
  for (const [catKey, label] of Object.entries(CATEGORY_FOLDERS)) {
    const tableId = randomId(`awn-table-pos-${catKey}`);
    const seeds = positives.filter((m) => m.category === catKey).sort((a, b) => a.d10 - b.d10);
    const results = seeds.map((m) =>
      documentResult(tableId, randomId(`awn-tr-${catKey}-${m.d10}`), {
        name: m.name,
        documentId: m.id,
        range: [m.d10, m.d10],
      }),
    );
    const doc = buildTableDoc(
      tableId,
      `Positive Mutations — ${label}`,
      "1d10",
      results,
      positiveFolder._id,
    );
    writeSourceDoc(TABLES_DIR, doc, foldersById);
  }

  // Any positive: d60 with category blocks of 10 (d6 category + d10 within)
  {
    const tableId = randomId("awn-table-pos-any");
    const results = [];
    let i = 0;
    for (const catKey of Object.keys(CATEGORY_FOLDERS)) {
      const seeds = positives.filter((m) => m.category === catKey).sort((a, b) => a.d10 - b.d10);
      for (const m of seeds) {
        i += 1;
        results.push(
          documentResult(tableId, randomId(`awn-tr-any-${i}`), {
            name: m.name,
            documentId: m.id,
            range: [i, i],
          }),
        );
      }
    }
    const doc = buildTableDoc(
      tableId,
      "Positive Mutations — Any",
      "1d60",
      results,
      positiveFolder._id,
    );
    writeSourceDoc(TABLES_DIR, doc, foldersById);
  }

  // Negatives d100
  {
    const tableId = randomId("awn-table-neg");
    const results = negatives.map((m) =>
      documentResult(tableId, randomId(`awn-tr-neg-${m.tableRange[0]}`), {
        name: m.name,
        documentId: m.id,
        weight: m.tableRange[1] - m.tableRange[0] + 1,
        range: m.tableRange,
      }),
    );
    const doc = buildTableDoc(tableId, "Negative Mutations", "1d100", results, negativeFolder._id);
    writeSourceDoc(TABLES_DIR, doc, foldersById);
  }

  // Stigma text tables
  for (const [key, spec] of Object.entries(STIGMA_TABLES)) {
    const tableId = randomId(`awn-table-stigma-${key}`);
    const results = (spec.results ?? []).map((r, idx) =>
      textResult(tableId, randomId(`awn-tr-stigma-${key}-${idx}`), {
        text: r.text,
        range: r.range,
        weight: r.range[1] - r.range[0] + 1,
      }),
    );
    const doc = buildTableDoc(tableId, spec.name, spec.formula, results, stigmaFolder._id);
    writeSourceDoc(TABLES_DIR, doc, foldersById);
  }

  console.log(`${TABLES_PACK}: wrote mutation + stigma tables`);
  void byId;
}

const mutationDocs = generateMutationPowers();
generateTables(mutationDocs);
console.log(`Done. Total mutations in seed: ${allMutations().length}`);
