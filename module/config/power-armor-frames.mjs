/**
 * AWN modular power armor frame presets.
 * Integral fittings are effectId keys installed at 0 mass/power when the frame is applied.
 */

export const POWER_ARMOR_FRAMES = {
  scrap: {
    label: "Scrap Frame",
    mass: 4,
    power: 4,
    cost: 25000,
    integral: [],
    forbidEfficiency: false,
    runtimeMultiplier: 1,
    perpetual: false,
    transportFrames: 1,
  },
  centurion: {
    label: "Centurion",
    mass: 7,
    power: 6,
    cost: 100000,
    integral: [],
    forbidEfficiency: false,
    runtimeMultiplier: 1,
    perpetual: false,
    transportFrames: 1,
  },
  redBanner: {
    label: "Red Banner",
    mass: 7,
    power: 9,
    cost: 200000,
    integral: [],
    forbidEfficiency: false,
    runtimeMultiplier: 1,
    perpetual: false,
    transportFrames: 1,
  },
  culverin: {
    label: "Culverin",
    mass: 8,
    power: 8,
    cost: 300000,
    integral: ["sealedSystemsAdvanced", "commSuiteAdvanced", "breacherFist"],
    forbidEfficiency: true,
    runtimeMultiplier: 1,
    perpetual: false,
    transportFrames: 1,
  },
  praetorian: {
    label: "Praetorian",
    mass: 9,
    power: 9,
    cost: 500000,
    integral: ["commSuiteAdvanced", "onboardMedicalUnit"],
    forbidEfficiency: false,
    runtimeMultiplier: 1,
    perpetual: false,
    transportFrames: 1,
    stealthPenalty: -2,
  },
  thunderbolt: {
    label: "Thunderbolt",
    mass: 11,
    power: 8,
    cost: 0,
    integral: ["exoAdvanced", "breacherFist", "regenerativeForceField"],
    forbidEfficiency: false,
    runtimeMultiplier: 1,
    perpetual: false,
    transportFrames: 3,
  },
  executor: {
    label: "Executor",
    mass: 13,
    power: 11,
    cost: 1000000,
    integral: ["platingPretech", "shortRangeWarpCapacitor", "exoPretech", "sealedSystemsAdvanced"],
    forbidEfficiency: false,
    runtimeMultiplier: 1,
    perpetual: false,
    transportFrames: 1,
  },
  longRifle: {
    label: "Long Rifle",
    mass: 7,
    power: 8,
    cost: 0,
    integral: [],
    forbidEfficiency: false,
    runtimeMultiplier: 1,
    perpetual: true,
    transportFrames: 1,
  },
  tarnkappe: {
    label: "Tarnkappe",
    mass: 10,
    power: 10,
    cost: 0,
    integral: ["exoPretech", "ghostWalkerField", "platingPretech"],
    forbidEfficiency: false,
    runtimeMultiplier: 0.2,
    perpetual: false,
    transportFrames: 1,
    maxRuntimeCap: 24,
  },
};

/**
 * @param {string} frameType
 * @returns {Record<string, unknown>}
 */
export function applyFramePreset(frameType) {
  const frame = POWER_ARMOR_FRAMES[frameType];
  if (!frame) return {};

  return {
    "system.frameType": frameType,
    "system.mass.max": frame.mass,
    "system.power.max": frame.power,
    "system.cost": frame.cost,
    "system.forbidEfficiency": !!frame.forbidEfficiency,
    "system.runtimeMultiplier": frame.runtimeMultiplier ?? 1,
    "system.perpetual": !!frame.perpetual,
    "system.transportFrames": frame.transportFrames ?? 1,
    "system.stealthPenalty": frame.stealthPenalty ?? 0,
    "system.maxRuntimeCap": frame.maxRuntimeCap ?? null,
  };
}

/**
 * Integral fitting stubs to create when applying a frame (mass/power 0).
 * Full pack items may replace these later; effectIds must match Phase A/B catalog.
 * @param {string} frameType
 * @returns {Array<{ name: string, type: string, system: object }>}
 */
export function integralFittingDocuments(frameType) {
  const frame = POWER_ARMOR_FRAMES[frameType];
  if (!frame?.integral?.length) return [];

  const labels = {
    sealedSystemsAdvanced: "Sealed Systems, Advanced",
    commSuiteAdvanced: "Comm Suite, Advanced",
    breacherFist: "Breacher Fist",
    onboardMedicalUnit: "Onboard Medical Unit",
    exoAdvanced: "Exoskeletal Boost, Advanced",
    exoPretech: "Exoskeletal Boost, Pretech",
    regenerativeForceField: "Regenerative Force Field",
    platingPretech: "Plating, Pretech",
    shortRangeWarpCapacitor: "Short-Range Warp Capacitor",
    ghostWalkerField: "Ghost Walker Field",
  };

  return frame.integral.map((effectId) => ({
    name: labels[effectId] ?? effectId,
    type: "armorFitting",
    system: {
      effectId,
      mass: 0,
      power: 0,
      cost: 0,
      tl: 4,
      integral: true,
      stackable: false,
      disabled: false,
      description: "",
    },
  }));
}
