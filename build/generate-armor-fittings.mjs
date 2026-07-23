/**
 * Generate packs/source/armor-fittings/ from packs/data/armor-fittings.json.
 * Usage: node build/generate-armor-fittings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { makeFolder, randomId, writeSourceDoc } from "./pack-folder-paths.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "packs", "data", "armor-fittings.json");
const DEST = path.join(ROOT, "packs", "source", "armor-fittings");
const DEFAULT_IMG = "icons/svg/upgrade.svg";

/** Transfer Active Effects for vision / light fittings (token.* keys, phase final). */
const TRANSFER_EFFECTS = {
  nightVisionSensors: [
    {
      name: "Night Vision Sensors",
      changes: [
        { key: "token.sight.enabled", type: "override", value: "true", phase: "final" },
        { key: "token.sight.range", type: "override", value: 100, phase: "final" },
        { key: "token.sight.visionMode", type: "override", value: "darkvision", phase: "final" },
      ],
    },
  ],
  multispectralOptics: [
    {
      name: "Multispectral Optics",
      changes: [
        { key: "token.sight.enabled", type: "override", value: "true", phase: "final" },
        { key: "token.sight.range", type: "override", value: 120, phase: "final" },
        { key: "token.sight.visionMode", type: "override", value: "darkvision", phase: "final" },
        { key: "token.sight.brightness", type: "override", value: 0, phase: "final" },
        { key: "token.sight.saturation", type: "override", value: 0, phase: "final" },
      ],
    },
  ],
  floodlights: [
    {
      name: "Floodlights",
      changes: [
        { key: "token.light.dim", type: "override", value: 30, phase: "final" },
        { key: "token.light.bright", type: "override", value: 15, phase: "final" },
        { key: "token.light.color", type: "override", value: "#fff8e0", phase: "final" },
      ],
    },
  ],
};

/**
 * @param {string} parentId
 * @param {string} effectId
 * @param {object} def
 * @returns {object}
 */
function makeTransferEffect(parentId, effectId, def) {
  const id = randomId(`armor-fittings-effect:${effectId}:${def.name}`);
  return {
    _id: id,
    type: "base",
    name: def.name,
    img: DEFAULT_IMG,
    transfer: true,
    disabled: false,
    system: { changes: def.changes },
    flags: { wwn: {} },
    _key: `!items.effects!${parentId}.${id}`,
  };
}

/**
 * @param {object} entry
 * @param {string} folderId
 * @param {Record<string, number>} tlCosts
 */
function makeItem(entry, folderId, tlCosts) {
  const id = randomId(`armor-fittings:${entry.effectId}`);
  const tl = entry.tl ?? 3;
  const cost = entry.cost ?? tlCosts[String(tl)] ?? 0;
  const effectDefs = TRANSFER_EFFECTS[entry.effectId] ?? [];
  const effects = effectDefs.map((def) => makeTransferEffect(id, entry.effectId, def));
  return {
    _id: id,
    name: entry.name,
    type: "armorFitting",
    img: DEFAULT_IMG,
    effects,
    system: {
      description: `<p>${entry.description ?? ""}</p>`,
      tl,
      mass: entry.mass ?? 0,
      power: entry.power ?? 0,
      cost,
      stackable: Boolean(entry.stackable),
      disabled: false,
      integral: false,
      effectId: entry.effectId,
      mountWeaponId: "",
      damageRoll: entry.damageRoll ?? "",
      save: entry.save ?? "",
      healing: Boolean(entry.healing),
      isWeapon: Boolean(entry.isWeapon),
      weaponBonus: entry.weaponBonus ?? 0,
      melee: entry.melee !== false,
      missile: Boolean(entry.missile),
      score: entry.score ?? "str",
      linkedSkill: entry.linkedSkill ?? "",
      shock: {
        damage: entry.shock?.damage ?? "",
        ac: entry.shock?.ac ?? 0,
      },
      trauma: {
        die: entry.trauma?.die ?? "",
        rating: entry.trauma?.rating ?? 0,
      },
    },
    ownership: { default: 0 },
    folder: folderId,
    sort: 0,
    _stats: {
      systemId: "wwn",
      systemVersion: null,
      coreVersion: null,
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
    },
    _key: `!items!${id}`,
  };
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });

  const byTl = new Map();
  for (const entry of data.fittings) {
    const tl = entry.tl ?? 3;
    if (!byTl.has(tl)) byTl.set(tl, []);
    byTl.get(tl).push(entry);
  }

  const foldersById = new Map();
  const docs = [];
  let sort = 0;
  for (const tl of [...byTl.keys()].sort((a, b) => a - b)) {
    const folder = makeFolder(`TL${tl}`, "Item", null, `armor-fittings:folder:TL${tl}`);
    foldersById.set(folder._id, folder);
    docs.push(folder);
    for (const entry of byTl.get(tl)) {
      const item = makeItem(entry, folder._id, data.tlCosts);
      item.sort = sort++;
      docs.push(item);
    }
  }

  for (const doc of docs) writeSourceDoc(DEST, doc, foldersById);
  console.log(`Wrote ${data.fittings.length} armor fittings to ${DEST}`);
}

main();
