/**
 * Generate packs/source/example-starships/ from packs/data/example-starships.json.
 *
 * Reuses the hull-preset table (module/config/starship-hulls.mjs, already the
 * live source for the sheet's "Apply Hull" action) for baseline stats, and the
 * starship-fittings data table (packs/data/starship-fittings.json) to copy
 * embedded-item system fields verbatim from the fittings/defenses/weapons
 * pack (Task 8) -- so example-ship items stay in sync with that pack's data.
 *
 * Usage: node build/generate-example-starships.mjs
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { randomId, writeSourceDoc } from "./pack-folder-paths.mjs";
import { STARSHIP_HULLS } from "../module/config/starship-hulls.mjs";
import { STATIONS } from "../module/helpers/starship-crew.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SHIPS_PATH = path.join(ROOT, "packs", "data", "example-starships.json");
const FITTINGS_PATH = path.join(ROOT, "packs", "data", "starship-fittings.json");
const DEST = path.join(ROOT, "packs", "source", "example-starships");

const DEFAULT_ICON = {
  shipFitting: "icons/svg/upgrade.svg",
  shipWeapon: "icons/svg/explosion.svg",
  shipDefense: "icons/svg/shield.svg",
};

const GROUP_TYPE = { weapons: "shipWeapon", defenses: "shipDefense", fittings: "shipFitting" };

/** Build the equipment "system" block for an item entry, matching generate-starship-fittings.mjs. */
function equipmentSystem(entry, type) {
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

  return system;
}

/**
 * Build one embedded item doc for a ship actor.
 * @param {object} entry Fitting/defense/weapon table entry (from starship-fittings.json)
 * @param {object} override Ship-specific override, e.g. { attackBonus }
 * @param {string} type shipFitting | shipWeapon | shipDefense
 * @param {string} actorId
 * @param {number} sort
 */
function makeEmbeddedItem(entry, override, type, actorId, sort) {
  const id = randomId(`example-starships:${actorId}:${type}:${entry.name}:${sort}`);
  const system = equipmentSystem(entry, type);
  if (type === "shipWeapon" && override?.attackBonus !== undefined) {
    system.attackBonus = override.attackBonus;
  }

  return {
    _id: id,
    name: entry.name,
    type,
    img: DEFAULT_ICON[type],
    sort,
    flags: {},
    effects: [],
    system,
    _key: `!actors.items!${actorId}.${id}`,
  };
}

/** @param {string} name @param {Map<string,object>} lookup */
function findEntry(name, lookup) {
  const entry = lookup.get(name.toLowerCase());
  if (!entry) throw new Error(`Unknown equipment name in example-starships.json: "${name}"`);
  return entry;
}

function main() {
  const shipsData = JSON.parse(fs.readFileSync(SHIPS_PATH, "utf8"));
  const fittingsData = JSON.parse(fs.readFileSync(FITTINGS_PATH, "utf8"));

  const lookupByGroup = {};
  for (const group of Object.keys(GROUP_TYPE)) {
    lookupByGroup[group] = new Map((fittingsData[group] ?? []).map((e) => [e.name.toLowerCase(), e]));
  }

  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });

  const foldersById = new Map(); // no in-pack folders for this compendium (flat, like creatures-of-a-far-age)
  let count = 0;

  for (const ship of shipsData.ships) {
    const hull = STARSHIP_HULLS[ship.hullType];
    if (!hull) throw new Error(`Unknown hullType "${ship.hullType}" for ship "${ship.name}"`);

    const actorId = randomId(`example-starships:actor:${ship.key}`);
    const items = [];
    let sort = 100000;

    for (const group of ["weapons", "defenses", "fittings"]) {
      const type = GROUP_TYPE[group];
      for (const want of ship[group] ?? []) {
        const entry = findEntry(want.name, lookupByGroup[group]);
        const qty = want.qty ?? 1;
        for (let i = 0; i < qty; i++) {
          items.push(makeEmbeddedItem(entry, want, type, actorId, sort));
          sort += 100000;
        }
      }
    }

    const stationFormula = `2d6+${ship.crewSkill}`;
    const stations = Object.fromEntries(
      STATIONS.map((station) => [station, { actor: null, formula: stationFormula }]),
    );

    const doc = {
      _id: actorId,
      name: ship.name,
      type: "starship",
      sort: 100000,
      flags: {},
      img: "icons/svg/mystery-man.svg",
      items,
      effects: [],
      system: {
        description: ship.description ?? "",
        hullType: ship.hullType,
        hullClass: hull.hullClass,
        hp: { value: hull.hp, max: hull.hp },
        ac: hull.ac,
        armor: hull.armor,
        speed: hull.speed,
        drive: ship.drive ?? 1,
        power: { max: hull.power },
        mass: { max: hull.mass },
        hardpoints: { max: hull.hardpoints },
        crew: { min: hull.crewMin, max: hull.crewMax, current: hull.crewMin },
        cost: ship.cost,
        cargo: ship.cargo ?? 0,
        npcCp: ship.npcCp,
        stations,
      },
      ownership: { default: 0 },
      prototypeToken: {
        flags: {},
        name: ship.name,
        displayName: 30,
        img: "icons/svg/mystery-man.svg",
        tint: null,
        width: 1,
        height: 1,
        scale: 1,
        lockRotation: false,
        rotation: 0,
        vision: false,
        dimSight: 0,
        brightSight: 0,
        dimLight: 0,
        brightLight: 0,
        sightAngle: 360,
        lightAngle: 360,
        lightAlpha: 1,
        lightAnimation: { speed: 5, intensity: 5 },
        actorId,
        actorLink: false,
        disposition: 0,
        displayBars: 20,
        bar1: { attribute: "hp" },
        bar2: {},
        randomImg: false,
        prependAdjective: true,
      },
      _key: `!actors!${actorId}`,
    };

    writeSourceDoc(DEST, doc, foldersById);
    count += 1;
  }

  console.log(`Generated example-starships source: ${count} actors.`);
}

main();
