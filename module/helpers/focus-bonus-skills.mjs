import { isPc } from "./actor-types.mjs";
import { getSkillSetCache } from "./skill-set.mjs";
import { applySkillPoints, FOCUS_BONUS_SKILL_POINTS } from "./skill-points.mjs";
import {
  findSkillBySlug,
  declaredBonusSkills,
  bonusSkillsPickCount,
  needsBonusSkillChoice,
  resolveListedBonusSkillSlugs,
  promptBonusSkillChoiceDialog,
} from "./bonus-skills-shared.mjs";

export { findSkillBySlug };

const FLAG = "wwn";
const SPECIALIST_EXCLUDED = new Set(["magic", "stab", "shoot", "punch"]);
const NON_COMBAT_NON_MAGIC_EXCLUDED = new Set(["magic", "stab", "shoot", "punch"]);

/** Foci that always grant these skills in addition to any choice list. */
const ALWAYS_BONUS_SKILLS = {
  "Origin Focus: Orc": ["survive"],
  "Origin Focus: Elf, Half-Elf": ["connect"],
  "Origin Focus: Elf, Gyre": ["notice"],
};

/**
 * Extra bonus skills unlocked when focus ownedLevel reaches a threshold.
 * @type {Record<string, Record<number, string[]>>}
 */
export const LEVEL_BONUS_SKILLS = {
  "Ace Driver": { 2: ["fix"] },
};

/**
 * Open-choice modes when `bonusSkills` is empty (or for dual-grant open half).
 * - any: all primary skills
 * - specialist: exclude Magic/Stab/Shoot/Punch (and psychic secondaries via primary-only list)
 * - nonCombatNonMagic: same exclusions as specialist
 * - psychic: secondary psychic skill slugs only
 */
const OPEN_BONUS_MODES = {
  Polymath: "any",
  Specialist: "specialist",
  "Spark of Brilliance": "any",
  "All Natural": "any",
  "Psychic Training": "psychic",
  "Origin Focus: Chattel Blighted": "nonCombatNonMagic",
  "Origin Focus: Functionary Blighted": "nonCombatNonMagic",
  "Origin Focus: Elf, Half-Elf": "any",
  "Origin Focus: Elf, Gyre": "any",
};

/**
 * @param {Item} focus
 * @returns {string[]}
 */
export function alwaysBonusSkills(focus) {
  const base = (ALWAYS_BONUS_SKILLS[focus.name] ?? []).map((s) => String(s).trim().toLowerCase());
  return [...base, ...levelBonusSkills(focus)];
}

/**
 * Skills granted once focus ownedLevel reaches a threshold (e.g. Ace Driver L2 Fix).
 * @param {Item} focus
 * @returns {string[]}
 */
export function levelBonusSkills(focus) {
  const table = LEVEL_BONUS_SKILLS[focus.name];
  if (!table) return [];
  const owned = Math.max(Number(focus.system?.ownedLevel) || 1, 1);
  const out = [];
  for (const [levelKey, slugs] of Object.entries(table)) {
    if (owned < Number(levelKey)) continue;
    for (const s of slugs ?? []) {
      const slug = String(s).trim().toLowerCase();
      if (slug) out.push(slug);
    }
  }
  return out;
}

/**
 * @param {Item} focus
 * @returns {string|null}
 */
export function openBonusMode(focus) {
  return OPEN_BONUS_MODES[focus.name] ?? null;
}

/**
 * @param {Item} focus
 * @returns {boolean}
 */
function usesOpenBonusSkillChoice(focus) {
  return openBonusMode(focus) != null && declaredBonusSkills(focus).length === 0;
}

/**
 * @param {Actor} actor
 * @returns {boolean}
 */
export function shouldUseFocusBonusPoints(actor) {
  const level = actor.system.details?.level ?? 1;
  if (level > 1) return true;
  return game.settings.get("wwn", "bonusSkillsGrantPointsAtFirstLevel") === true;
}

/**
 * @param {Item} focus
 * @returns {boolean}
 */
export function focusNeedsBonusSkillChoice(focus) {
  return needsBonusSkillChoice(focus, { usesOpenChoice: usesOpenBonusSkillChoice });
}

/**
 * Choice-only slugs (excludes always-granted).
 * @param {Item} focus
 * @returns {string[]|null} null when a player choice is required
 */
export function resolveChoiceBonusSkillSlugs(focus) {
  return resolveListedBonusSkillSlugs(focus, {
    usesOpenChoice: usesOpenBonusSkillChoice,
    emptyPickReturnsDeclared: false,
  });
}

/**
 * Always + choice slugs. null when a player choice is still required.
 * @param {Item} focus
 * @returns {string[]|null}
 */
export function resolveBonusSkillSlugs(focus) {
  const always = alwaysBonusSkills(focus);
  const choice = resolveChoiceBonusSkillSlugs(focus);
  if (choice === null) return null;
  return [...new Set([...always, ...choice])];
}

/**
 * @param {Item} focus
 * @returns {string[]}
 */
function openChoiceSlugs(focus) {
  const mode = openBonusMode(focus) ?? "any";
  const cache = getSkillSetCache();
  if (mode === "psychic") {
    return [...(cache.secondarySlugs ?? [])];
  }
  const slugs = cache.primarySlugs;
  if (mode === "any") return [...slugs];
  const excluded = mode === "specialist" ? SPECIALIST_EXCLUDED : NON_COMBAT_NON_MAGIC_EXCLUDED;
  return slugs.filter((slug) => !excluded.has(slug));
}

/**
 * @param {Item} focus
 * @param {Actor} actor
 * @returns {Promise<string[]|null>}
 */
export async function promptBonusSkillChoice(focus, actor) {
  const declared = declaredBonusSkills(focus);
  const pick = bonusSkillsPickCount(focus);
  const options = declared.length ? declared : openChoiceSlugs(focus);
  return promptBonusSkillChoiceDialog({
    item: focus,
    options,
    pick,
    titleKey: "WWN.Focus.BonusSkillDialogTitle",
    titleData: { focus: focus.name },
  });
}

/**
 * @param {{ system: { ownedLevel?: number, pointsInvested?: number } }} skill
 * @param {boolean} usePoints
 * @returns {{
 *   ownedLevel: number,
 *   pointsInvested: number,
 *   focusBonusMode: "rank"|"points",
 *   focusBonusLevelDelta: number,
 *   focusBonusPointsDelta: number
 * }}
 */
export function computeFocusBonusGrant(skill, usePoints) {
  const beforeLevel = skill.system.ownedLevel ?? -1;
  const beforeInvested = skill.system.pointsInvested ?? 0;
  if (usePoints) {
    const after = applySkillPoints(beforeLevel, beforeInvested, FOCUS_BONUS_SKILL_POINTS);
    return {
      ownedLevel: after.ownedLevel,
      pointsInvested: after.pointsInvested,
      focusBonusMode: "points",
      focusBonusLevelDelta: after.ownedLevel - beforeLevel,
      focusBonusPointsDelta: after.pointsInvested - beforeInvested,
    };
  }
  // Rank path: train untrained skills to 0; leave already-trained skills unchanged.
  if (beforeLevel < 0) {
    return {
      ownedLevel: 0,
      pointsInvested: beforeInvested,
      focusBonusMode: "rank",
      focusBonusLevelDelta: 1,
      focusBonusPointsDelta: 0,
    };
  }
  return {
    ownedLevel: beforeLevel,
    pointsInvested: beforeInvested,
    focusBonusMode: "rank",
    focusBonusLevelDelta: 0,
    focusBonusPointsDelta: 0,
  };
}

/**
 * @param {{ name: string, system: { skillBonus?: string } }} focus
 * @param {string[]} choiceSlugs
 * @returns {{ "system.skillBonus": string }|null}
 */
export function specialistSkillBonusPatch(focus, choiceSlugs) {
  if (focus.name !== "Specialist") return null;
  if (focus.system.skillBonus?.trim()) return null;
  const slug = choiceSlugs?.[0];
  if (!slug) return null;
  return { "system.skillBonus": slug };
}

/**
 * Reverse a prior focus bonus grant.
 * @param {{ system: { ownedLevel?: number, pointsInvested?: number }, getFlag?: Function }} skill
 * @param {{ levelDelta?: number, pointsDelta?: number, legacyPoints?: number }} deltas
 * @returns {{ ownedLevel?: number, pointsInvested?: number }}
 */
export function computeFocusBonusRevoke(skill, deltas) {
  const levelDelta = Number(deltas.levelDelta) || 0;
  const pointsDelta = Number(deltas.pointsDelta) || 0;
  const legacyPoints = Number(deltas.legacyPoints) || 0;
  const out = {};
  if (levelDelta || pointsDelta) {
    out.ownedLevel = (skill.system.ownedLevel ?? -1) - levelDelta;
    out.pointsInvested = Math.max((skill.system.pointsInvested ?? 0) - pointsDelta, 0);
  } else if (legacyPoints > 0) {
    out.pointsInvested = Math.max((skill.system.pointsInvested ?? 0) - legacyPoints, 0);
  } else if (deltas.legacyRank && (skill.system.ownedLevel ?? -1) === 0) {
    // Pre-delta grants only trained -1 → 0; reverse that when no stored mode/deltas exist.
    out.ownedLevel = -1;
  }
  return out;
}

/**
 * @param {Item} focus
 * @param {Item} skill
 * @returns {boolean}
 */
function isGrantedByFocus(focus, skill) {
  return skill.getFlag(FLAG, "focusBonusFrom") === focus.id;
}

/**
 * Focus grant: may use +3 skill points when level > 1 or the setting is on.
 * @param {Item} focus
 * @param {Actor} actor
 * @param {Item} skill
 */
async function grantBonusSkill(focus, actor, skill) {
  if (isGrantedByFocus(focus, skill)) return;

  const grant = computeFocusBonusGrant(skill, shouldUseFocusBonusPoints(actor));
  const updates = {
    [`flags.${FLAG}.focusBonusFrom`]: focus.id,
    "system.ownedLevel": grant.ownedLevel,
    "system.pointsInvested": grant.pointsInvested,
    [`flags.${FLAG}.focusBonusMode`]: grant.focusBonusMode,
    [`flags.${FLAG}.focusBonusLevelDelta`]: grant.focusBonusLevelDelta,
    [`flags.${FLAG}.focusBonusPointsDelta`]: grant.focusBonusPointsDelta,
  };

  await skill.update(updates);
  if (!focus.getFlag(FLAG, "focusBonusGranted")) {
    await focus.update({ [`flags.${FLAG}.focusBonusGranted`]: true });
  }
}

/**
 * @param {Item} focus
 * @param {string[]} choiceSlugs
 */
async function syncSpecialistSkillBonus(focus, choiceSlugs) {
  const patch = specialistSkillBonusPatch(focus, choiceSlugs);
  if (patch) await focus.update(patch);
}

/**
 * @param {Item} focus
 * @param {Actor} actor
 * @param {{ prompt?: boolean }} [options]
 */
export async function syncFocusBonusSkills(focus, actor, { prompt = false } = {}) {
  if (focus.type !== "focus" || !isPc(actor)) return;
  if ((focus.system.ownedLevel ?? 1) < 1) return;

  const always = alwaysBonusSkills(focus);
  for (const slug of always) {
    const skill = findSkillBySlug(actor, slug);
    if (skill) await grantBonusSkill(focus, actor, skill);
  }

  let choice = resolveChoiceBonusSkillSlugs(focus);
  if (choice === null && focusNeedsBonusSkillChoice(focus)) {
    if (!prompt) return;
    choice = await promptBonusSkillChoice(focus, actor);
    if (!choice?.length) return;
    await focus.update({ "system.bonusSkillsChosen": choice });
  }
  if (!choice?.length) {
    await syncSpecialistSkillBonus(focus, focus.system.bonusSkillsChosen ?? []);
    return;
  }

  for (const slug of choice) {
    const skill = findSkillBySlug(actor, slug);
    if (skill) await grantBonusSkill(focus, actor, skill);
  }
  await syncSpecialistSkillBonus(focus, choice);
}

/**
 * @param {Item} focus
 * @param {Actor} actor
 */
export async function revokeFocusBonusSkills(focus, actor) {
  if (focus.type !== "focus" || !isPc(actor)) return;

  for (const skill of actor.items.filter((i) => i.type === "skill")) {
    if (!isGrantedByFocus(focus, skill)) continue;

    const levelDelta = Number(skill.getFlag(FLAG, "focusBonusLevelDelta")) || 0;
    const pointsDelta = Number(skill.getFlag(FLAG, "focusBonusPointsDelta")) || 0;
    // Legacy: older grants stored focusBonusPoints without level deltas.
    const legacyPoints = Number(skill.getFlag(FLAG, "focusBonusPoints")) || 0;
    const legacyRank = !skill.getFlag(FLAG, "focusBonusMode");

    const del = new foundry.data.operators.ForcedDeletion();
    const updates = {
      [`flags.${FLAG}.focusBonusFrom`]: del,
      [`flags.${FLAG}.focusBonusMode`]: del,
      [`flags.${FLAG}.focusBonusLevelDelta`]: del,
      [`flags.${FLAG}.focusBonusPointsDelta`]: del,
      [`flags.${FLAG}.focusBonusPoints`]: del,
      ...Object.fromEntries(
        Object.entries(
          computeFocusBonusRevoke(skill, { levelDelta, pointsDelta, legacyPoints, legacyRank }),
        ).map(([key, value]) => [`system.${key}`, value]),
      ),
    };

    await skill.update(updates);
  }
}

/**
 * @param {Actor} actor
 */
export async function syncActorFocusBonusSkills(actor) {
  for (const focus of actor.items.filter((i) => i.type === "focus")) {
    await syncFocusBonusSkills(focus, actor, { prompt: false });
  }
}
