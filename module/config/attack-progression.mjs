/**
 * Attack bonus progression registry for Class/Edge items.
 * Level input is always character level (details.level).
 */

/** @type {Record<string, { label: string, compute: (level: number) => number }>} */
export const ATTACK_PROGRESSIONS = {
  none: {
    label: "WWN.ClassEdge.AttackNone",
    compute: () => 0,
  },
  warrior: {
    label: "WWN.ClassEdge.AttackWarrior",
    compute: (level) => level,
  },
  expert: {
    label: "WWN.ClassEdge.AttackExpert",
    compute: (level) => Math.floor(level / 2),
  },
  mage: {
    label: "WWN.ClassEdge.AttackMage",
    compute: (level) => Math.floor(level / 5),
  },
  partialWarrior: {
    label: "WWN.ClassEdge.AttackPartialWarrior",
    compute: (level) => Math.floor(level / 2) + Math.ceil(level / 4),
  },
};

/** Select options for Class/Edge sheet (excludes `none` from display order). */
export const ATTACK_PROGRESSION_MODES = Object.fromEntries(
  Object.entries(ATTACK_PROGRESSIONS).map(([key, { label }]) => [key, label])
);
