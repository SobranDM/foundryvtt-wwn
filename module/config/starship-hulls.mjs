/**
 * SWN hull statistics used to seed editable starship actor fields.
 * Costs are stored as credits rather than abbreviated PDF values.
 */
export const HULL_CLASSES = {
  fighter: "Fighter",
  frigate: "Frigate",
  cruiser: "Cruiser",
  capital: "Capital",
};

export const STARSHIP_HULLS = {
  strikeFighter: { label: "Strike Fighter", cost: 200000, speed: 5, armor: 5, hp: 8, crewMin: 1, crewMax: 1, ac: 16, power: 5, mass: 2, hardpoints: 1, hullClass: "fighter" },
  shuttle: { label: "Shuttle", cost: 200000, speed: 3, armor: 0, hp: 15, crewMin: 1, crewMax: 10, ac: 11, power: 3, mass: 5, hardpoints: 1, hullClass: "fighter" },
  freeMerchant: { label: "Free Merchant", cost: 500000, speed: 3, armor: 2, hp: 20, crewMin: 1, crewMax: 6, ac: 14, power: 10, mass: 15, hardpoints: 2, hullClass: "frigate" },
  patrolBoat: { label: "Patrol Boat", cost: 2500000, speed: 4, armor: 5, hp: 25, crewMin: 5, crewMax: 20, ac: 14, power: 15, mass: 10, hardpoints: 4, hullClass: "frigate" },
  corvette: { label: "Corvette", cost: 4000000, speed: 2, armor: 10, hp: 40, crewMin: 10, crewMax: 40, ac: 13, power: 15, mass: 15, hardpoints: 6, hullClass: "frigate" },
  heavyFrigate: { label: "Heavy Frigate", cost: 7000000, speed: 1, armor: 10, hp: 50, crewMin: 30, crewMax: 120, ac: 15, power: 25, mass: 20, hardpoints: 8, hullClass: "frigate" },
  bulkFreighter: { label: "Bulk Freighter", cost: 5000000, speed: 0, armor: 0, hp: 40, crewMin: 10, crewMax: 40, ac: 11, power: 15, mass: 25, hardpoints: 2, hullClass: "cruiser" },
  fleetCruiser: { label: "Fleet Cruiser", cost: 10000000, speed: 1, armor: 15, hp: 60, crewMin: 50, crewMax: 200, ac: 14, power: 50, mass: 30, hardpoints: 10, hullClass: "cruiser" },
  battleship: { label: "Battleship", cost: 50000000, speed: 0, armor: 20, hp: 100, crewMin: 200, crewMax: 1000, ac: 16, power: 75, mass: 50, hardpoints: 15, hullClass: "capital" },
  carrier: { label: "Carrier", cost: 60000000, speed: 0, armor: 10, hp: 75, crewMin: 300, crewMax: 1500, ac: 14, power: 50, mass: 100, hardpoints: 4, hullClass: "capital" },
  smallStation: { label: "Small Station", cost: 5000000, speed: null, armor: 5, hp: 120, crewMin: 20, crewMax: 200, ac: 11, power: 50, mass: 40, hardpoints: 10, hullClass: "cruiser" },
  largeStation: { label: "Large Station", cost: 40000000, speed: null, armor: 20, hp: 120, crewMin: 100, crewMax: 1000, ac: 17, power: 125, mass: 75, hardpoints: 30, hullClass: "capital" },
};

/**
 * Return the actor update data needed to apply a hull preset.
 * @param {string} hullType
 * @returns {Record<string, unknown>}
 */
export function applyHullPreset(hullType) {
  const hull = STARSHIP_HULLS[hullType];
  if (!hull) return {};

  return {
    "system.hullType": hullType,
    "system.hullClass": hull.hullClass,
    "system.hp.value": hull.hp,
    "system.hp.max": hull.hp,
    "system.ac": hull.ac,
    "system.armor": hull.armor,
    "system.speed": hull.speed,
    "system.power.max": hull.power,
    "system.mass.max": hull.mass,
    "system.hardpoints.max": hull.hardpoints,
    "system.crew.min": hull.crewMin,
    "system.crew.max": hull.crewMax,
    "system.cost": hull.cost,
  };
}
