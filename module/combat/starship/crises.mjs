/**
 * Starship combat Crisis table and helpers (SWN Revised).
 */

/** @typedef {"continuing"|"acute"} CrisisType */

/**
 * @typedef {object} CrisisDef
 * @property {string} id
 * @property {CrisisType} type
 * @property {string} labelKey
 */

/** d10 → crisis definition (1–10). */
export const CRISIS_TABLE = Object.freeze({
  1: { id: "armorLoss", type: "continuing", labelKey: "WWN.Starship.Crisis.armorLoss" },
  2: { id: "cargoLoss", type: "acute", labelKey: "WWN.Starship.Crisis.cargoLoss" },
  3: { id: "crewLost", type: "acute", labelKey: "WWN.Starship.Crisis.crewLost" },
  4: { id: "engineLock", type: "continuing", labelKey: "WWN.Starship.Crisis.engineLock" },
  5: { id: "fuelBleed", type: "acute", labelKey: "WWN.Starship.Crisis.fuelBleed" },
  6: { id: "haywire", type: "continuing", labelKey: "WWN.Starship.Crisis.haywire" },
  7: { id: "hullBreach", type: "acute", labelKey: "WWN.Starship.Crisis.hullBreach" },
  8: { id: "systemDamage", type: "continuing", labelKey: "WWN.Starship.Crisis.systemDamage" },
  9: { id: "targetDecalibration", type: "continuing", labelKey: "WWN.Starship.Crisis.targetDecalibration" },
  10: { id: "vipImperiled", type: "acute", labelKey: "WWN.Starship.Crisis.vipImperiled" },
});

/**
 * @param {number} d10
 * @returns {CrisisDef}
 */
export function crisisFromRoll(d10) {
  const n = Math.min(10, Math.max(1, Math.floor(Number(d10) || 1)));
  return CRISIS_TABLE[n];
}

/**
 * Hull breach disaster damage dice by class.
 * @param {string} hullClass
 */
export function hullBreachDisasterDice(hullClass) {
  return { fighter: "1d10", frigate: "2d10", cruiser: "3d10", capital: "4d10" }[hullClass] ?? "1d10";
}

/**
 * Create a crisis instance for combatant state.
 * @param {CrisisDef} def
 * @param {{ roundNumber: number, source?: string, systemId?: string|null }} opts
 */
export function createCrisisInstance(def, { roundNumber, source = "hit", systemId = null } = {}) {
  const deadlineRound = def.type === "acute" ? roundNumber + 1 : null;
  return {
    instanceId: `${def.id}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    id: def.id,
    type: def.type,
    labelKey: def.labelKey,
    source,
    systemId,
    createdRound: roundNumber,
    deadlineRound,
    resolved: false,
    expired: false,
    disasterApplied: false,
  };
}

/**
 * Effective armor while Armor Loss crises are active (halved, round down, per stack).
 * @param {number} baseArmor
 * @param {object[]} crises
 */
export function armorWithCrises(baseArmor, crises = []) {
  let armor = Math.max(0, Number(baseArmor) || 0);
  const stacks = crises.filter((c) => c.id === "armorLoss" && !c.resolved).length;
  for (let i = 0; i < stacks; i++) {
    armor = Math.floor(armor / 2);
  }
  return armor;
}

/**
 * Bridge actions blocked by Engine Lock or destroyed engines.
 * @param {object[]} crises
 * @param {boolean} enginesDestroyed
 */
export function bridgeActionsBlocked(crises = [], enginesDestroyed = false) {
  if (enginesDestroyed) return true;
  return crises.some((c) => c.id === "engineLock" && !c.resolved);
}

/**
 * Weapons cannot lock while Target Decalibration is active.
 * @param {object[]} crises
 */
export function weaponsLockedOut(crises = []) {
  return crises.some((c) => c.id === "targetDecalibration" && !c.resolved);
}
