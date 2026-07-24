/**
 * Starship combat action catalog (costs and metadata).
 */

/** @typedef {"bridge"|"gunnery"|"engineering"|"comms"|"captain"|"general"} Department */

/**
 * @typedef {object} StarshipActionDef
 * @property {string} id
 * @property {Department} department
 * @property {number} cpCost
 * @property {boolean} [exclusive]
 * @property {boolean} [oncePerRound]
 * @property {boolean} [captainInstant]
 * @property {string} labelKey
 */

/** @type {StarshipActionDef[]} */
export const STARSHIP_ACTIONS = Object.freeze([
  { id: "escapeCombat", department: "bridge", cpCost: 4, labelKey: "WWN.Starship.Action.escapeCombat" },
  { id: "evasiveManeuvers", department: "bridge", cpCost: 2, oncePerRound: true, labelKey: "WWN.Starship.Action.evasiveManeuvers" },
  { id: "pursueTarget", department: "bridge", cpCost: 3, labelKey: "WWN.Starship.Action.pursueTarget" },

  { id: "fireOneWeapon", department: "gunnery", cpCost: 2, labelKey: "WWN.Starship.Action.fireOneWeapon" },
  { id: "fireAllGuns", department: "gunnery", cpCost: 3, labelKey: "WWN.Starship.Action.fireAllGuns" },
  { id: "targetSystems", department: "gunnery", cpCost: 1, labelKey: "WWN.Starship.Action.targetSystems" },

  { id: "boostEngines", department: "engineering", cpCost: 2, labelKey: "WWN.Starship.Action.boostEngines" },
  { id: "damageControl", department: "engineering", cpCost: 3, labelKey: "WWN.Starship.Action.damageControl" },
  { id: "emergencyRepairs", department: "engineering", cpCost: 3, labelKey: "WWN.Starship.Action.emergencyRepairs" },

  { id: "crashSystems", department: "comms", cpCost: 2, labelKey: "WWN.Starship.Action.crashSystems" },
  { id: "defeatEcm", department: "comms", cpCost: 2, labelKey: "WWN.Starship.Action.defeatEcm" },
  { id: "sensorGhost", department: "comms", cpCost: 2, oncePerRound: true, labelKey: "WWN.Starship.Action.sensorGhost" },

  { id: "supportDepartment", department: "captain", cpCost: 0, oncePerRound: true, labelKey: "WWN.Starship.Action.supportDepartment" },
  { id: "keepItTogether", department: "captain", cpCost: 0, oncePerRound: true, captainInstant: true, labelKey: "WWN.Starship.Action.keepItTogether" },
  { id: "intoTheFire", department: "captain", cpCost: 0, oncePerRound: true, labelKey: "WWN.Starship.Action.intoTheFire" },

  { id: "doYourDuty", department: "general", cpCost: 0, exclusive: true, labelKey: "WWN.Starship.Action.doYourDuty" },
  { id: "aboveAndBeyond", department: "general", cpCost: 0, exclusive: true, labelKey: "WWN.Starship.Action.aboveAndBeyond" },
  { id: "dealWithCrisis", department: "general", cpCost: 0, exclusive: true, labelKey: "WWN.Starship.Action.dealWithCrisis" },
]);

/** @type {Map<string, StarshipActionDef>} */
export const STARSHIP_ACTIONS_BY_ID = new Map(STARSHIP_ACTIONS.map((a) => [a.id, a]));

/**
 * @param {string} actionId
 * @returns {StarshipActionDef|undefined}
 */
export function getStarshipAction(actionId) {
  return STARSHIP_ACTIONS_BY_ID.get(actionId);
}

/**
 * Group actions by department for sheet rendering.
 * @returns {Record<Department, StarshipActionDef[]>}
 */
export function actionsByDepartment() {
  /** @type {Record<string, StarshipActionDef[]>} */
  const out = {
    bridge: [],
    gunnery: [],
    engineering: [],
    comms: [],
    captain: [],
    general: [],
  };
  for (const a of STARSHIP_ACTIONS) out[a.department].push(a);
  return /** @type {Record<Department, StarshipActionDef[]>} */ (out);
}
