/**
 * Starship crew station resolution and maintenance helpers.
 * Pure helpers for unit tests; no Foundry imports.
 */

export const STATIONS = ["bridge", "gunnery", "engineering", "comms", "captain"];

export const DEFAULT_STATION_SKILL = {
  bridge: "Pilot",
  gunnery: "Shoot",
  engineering: "Fix",
  comms: "Program",
  captain: "Lead",
};

/**
 * WWN core skills that stand in for SWN station skills when the SWN-named
 * skill item is missing (e.g. Sail covers vehicular Pilot checks).
 * First match wins.
 */
export const STATION_SKILL_ALIASES = {
  Pilot: ["Pilot", "Sail"],
  Fix: ["Fix", "Craft", "Work"],
  Program: ["Program", "Know"],
  Shoot: ["Shoot"],
  Lead: ["Lead"],
};

/**
 * @param {{ actor?: string|null, formula?: string }} stationData
 * @param {{ getActor?: (uuid: string) => object|null|undefined }} [options]
 * @returns {{ mode: "actor"|"formula"|"unassigned", actor?: object, formula?: string, actorUuid?: string|null }}
 */
export function resolveStation(stationData = {}, { getActor = (uuid) => uuid } = {}) {
  const actorUuid = stationData.actor ?? null;

  if (actorUuid) {
    const actor = getActor(actorUuid);
    if (actor != null) {
      return { mode: "actor", actor, actorUuid };
    }
  }

  const formula = stationData.formula?.trim() ?? "";
  if (formula) {
    return { mode: "formula", formula };
  }

  return { mode: "unassigned" };
}

/** @param {number} shipCost */
export function maintenanceCost(shipCost) {
  return Math.floor(shipCost * 0.05);
}

/**
 * Build actor.update payloads for assigning a crew member to a station.
 * When `exclusive` is true, the same UUID is cleared from every other station.
 *
 * @param {Record<string, {actor?: string|null}>|null|undefined} stations
 * @param {string} stationKey
 * @param {string|null} actorUuid
 * @param {{ exclusive?: boolean }} [options]
 * @returns {Record<string, string|null>}
 */
export function buildStationAssignmentUpdate(stations, stationKey, actorUuid, { exclusive = false } = {}) {
  if (!STATIONS.includes(stationKey)) return {};
  const updates = { [`system.stations.${stationKey}.actor`]: actorUuid };
  if (exclusive && actorUuid) {
    for (const key of STATIONS) {
      if (key === stationKey) continue;
      if (stations?.[key]?.actor === actorUuid) {
        updates[`system.stations.${key}.actor`] = null;
      }
    }
  }
  return updates;
}

/**
 * Find a skill item by name (case-insensitive) among an actor's items.
 * @param {Iterable<{type?: string, name?: string}>} items
 * @param {string} skillName
 * @returns {object|null}
 */
export function findSkillItem(items, skillName) {
  const target = String(skillName ?? "").trim().toLowerCase();
  if (!target) return null;
  return (
    [...(items ?? [])].find(
      (item) => item?.type === "skill" && String(item.name ?? "").toLowerCase() === target
    ) ?? null
  );
}

/**
 * Find the skill used for a station check, trying SWN names then WWN aliases.
 * @param {Iterable<{type?: string, name?: string}>} items
 * @param {string} skillName  Canonical station skill (e.g. from DEFAULT_STATION_SKILL)
 * @returns {object|null}
 */
export function findStationSkillItem(items, skillName) {
  const names = STATION_SKILL_ALIASES[skillName] ?? [skillName];
  for (const name of names) {
    const found = findSkillItem(items, name);
    if (found) return found;
  }
  return null;
}

/**
 * Gunnery is crewed with Pilot on nimble fighter hulls, Shoot on every
 * other hull class (SWN core).
 * @param {string} hullClass
 * @returns {string}
 */
export function gunnerySkillName(hullClass) {
  return hullClass === "fighter" ? "Pilot" : DEFAULT_STATION_SKILL.gunnery;
}

/**
 * Ship weapons roll with whichever of Int/Dex is better (SWN core).
 * @param {{int?: {mod?: number}, dex?: {mod?: number}}} abilities
 * @returns {number}
 */
export function bestAttributeMod(abilities) {
  const intMod = abilities?.int?.mod ?? 0;
  const dexMod = abilities?.dex?.mod ?? 0;
  return Math.max(intMod, dexMod);
}
