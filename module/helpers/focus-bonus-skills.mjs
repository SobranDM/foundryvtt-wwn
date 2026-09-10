import { isPc } from "./actor-types.mjs";
import { getSkillSetCache } from "./skill-set.mjs";
import { applySkillPoints, FOCUS_BONUS_SKILL_POINTS } from "./skill-points.mjs";
import {
  findSkillBySlug,
  ensureActorSkillBySlug,
  declaredBonusSkills,
  bonusSkillsPickCount,
  needsBonusSkillChoice,
  resolveListedBonusSkillSlugs,
  promptBonusSkillChoiceDialog,
  hasGrantedSkill,
  recordGrantedSkill,
  GRANTED_SKILLS_FLAG,
} from "./bonus-skills-shared.mjs";

export { findSkillBySlug, GRANTED_SKILLS_FLAG };

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
 * @returns {{ ownedLevel: number, pointsInvested: number }}
 */
export function computeFocusBonusGrant(skill, usePoints) {
  const beforeLevel = skill.system.ownedLevel ?? -1;
  const beforeInvested = skill.system.pointsInvested ?? 0;
  if (usePoints) {
    const after = applySkillPoints(beforeLevel, beforeInvested, FOCUS_BONUS_SKILL_POINTS);
    return { ownedLevel: after.ownedLevel, pointsInvested: after.pointsInvested };
  }
  // Rank path: train untrained skills to 0; leave already-trained skills unchanged.
  if (beforeLevel < 0) {
    return { ownedLevel: 0, pointsInvested: beforeInvested };
  }
  return { ownedLevel: beforeLevel, pointsInvested: beforeInvested };
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
 * Focus grant: may use +3 skill points when level > 1 or the setting is on.
 * Only ever called from the createItem/updateItem hooks (item dropped onto
 * a character, or its bonus-skill choice changes) — never re-synced on a
 * timer or login, so this only ever runs once per focus/skill pair.
 * @param {Item} focus
 * @param {Actor} actor
 * @param {Item} skill
 * @param {string} slug
 */
async function grantBonusSkill(focus, actor, skill, slug) {
  if (hasGrantedSkill(focus, slug)) return;

  const grant = computeFocusBonusGrant(skill, shouldUseFocusBonusPoints(actor));
  await skill.update({
    "system.ownedLevel": grant.ownedLevel,
    "system.pointsInvested": grant.pointsInvested,
  });
  await recordGrantedSkill(focus, slug);
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
    const skill = await ensureActorSkillBySlug(actor, slug);
    if (skill) await grantBonusSkill(focus, actor, skill, slug);
  }

  let choice = resolveChoiceBonusSkillSlugs(focus);
  if (choice === null && focusNeedsBonusSkillChoice(focus)) {
    if (!prompt) return;
    choice = await promptBonusSkillChoice(focus, actor);
    if (!choice?.length) return;
    // wwnBonusSkillSync tells the updateItem hook this write is this same
    // sync call persisting its own choice, not a fresh edit to re-sync for —
    // the grant loop below already covers it. Without the marker, the
    // update's own hook fire would re-enter this function concurrently
    // (Hooks.callAll doesn't await async listeners) and both copies could
    // pass grantBonusSkill's guard before either had written its result back.
    await focus.update({ "system.bonusSkillsChosen": choice }, { wwnBonusSkillSync: true });
  }
  if (!choice?.length) {
    await syncSpecialistSkillBonus(focus, focus.system.bonusSkillsChosen ?? []);
    return;
  }

  for (const slug of choice) {
    const skill = await ensureActorSkillBySlug(actor, slug);
    if (skill) await grantBonusSkill(focus, actor, skill, slug);
  }
  await syncSpecialistSkillBonus(focus, choice);
}

/**
 * @param {Actor} actor
 */
export async function syncActorFocusBonusSkills(actor) {
  for (const focus of actor.items.filter((i) => i.type === "focus")) {
    await syncFocusBonusSkills(focus, actor, { prompt: false });
  }
}
