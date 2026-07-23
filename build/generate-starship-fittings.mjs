/**
 * Generate packs/source/starship-fittings/ from packs/data/starship-fittings.json.
 *
 * The data file is the maintainable source of truth (transcribed from the SWN
 * "Building a Starship" PDF tables); this script turns it into Foundry-shaped
 * item + folder JSON matching the existing packs/source/<pack> layout, so that
 * `npm run build:packs` can compile it into a LevelDB pack.
 *
 * Usage: node build/generate-starship-fittings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { makeFolder, randomId, writeSourceDoc } from "./pack-folder-paths.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "packs", "data", "starship-fittings.json");
const DEST = path.join(ROOT, "packs", "source", "starship-fittings");

const DEFAULT_ICON = {
  shipFitting: "icons/svg/upgrade.svg",
  shipWeapon: "icons/svg/explosion.svg",
  shipDefense: "icons/svg/shield.svg",
};

/**
 * Build an equipment item doc (shipFitting / shipDefense / shipWeapon).
 * @param {object} entry
 * @param {string} type
 * @param {string} folderId
 */
function makeItem(entry, type, folderId) {
  const id = randomId(`starship-fittings:${type}:${entry.name}`);
  const description = entry.description
    ? `<p>${entry.description}</p><p><strong>Effect:</strong> ${entry.effect ?? ""}</p>`.replace("<p><strong>Effect:</strong> </p>", "")
    : `<p>${entry.effect ?? ""}</p>`;

  const system = {
    description,
    cost: entry.specialCost ? 0 : entry.cost ?? 0,
    power: entry.power ?? 0,
    mass: entry.mass ?? 0,
    minClass: entry.minClass ?? "fighter",
    costScales: Boolean(entry.costScales),
    powerScales: Boolean(entry.powerScales),
    massScales: Boolean(entry.massScales),
    disabled: false,
    specialCost: Boolean(entry.specialCost),
  };

  if (type === "shipWeapon") {
    system.damage = entry.damage ?? "";
    system.hardpoints = entry.hardpoints ?? 1;
    system.tl = entry.tl ?? 4;
    system.qualities = entry.qualities ?? "";
    system.ammo = entry.ammo ?? null;
    system.ammoCost = entry.ammoCost ?? 0;
    system.attackBonus = entry.attackBonus ?? 0;
  }

  return {
    _id: id,
    name: entry.name,
    type,
    img: DEFAULT_ICON[type],
    effects: [],
    system,
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

  const groups = [
    { key: "fittings", type: "shipFitting", folderName: "Fittings" },
    { key: "defenses", type: "shipDefense", folderName: "Defenses" },
    { key: "weapons", type: "shipWeapon", folderName: "Weapons" },
  ];

  const foldersById = new Map();
  const docs = [];
  const counts = {};

  for (const group of groups) {
    const folder = makeFolder(group.folderName, "Item", null, `starship-fittings:folder:${group.folderName}`);
    foldersById.set(folder._id, folder);
    docs.push(folder);

    const entries = data[group.key] ?? [];
    counts[group.key] = entries.length;
    for (const entry of entries) {
      docs.push(makeItem(entry, group.type, folder._id));
    }
  }

  for (const doc of docs) writeSourceDoc(DEST, doc, foldersById);

  console.log(`Generated starship-fittings source: ${JSON.stringify(counts)} (${docs.length} docs incl. folders)`);
}

main();
