import { isPc } from "./actor-types.mjs";
import { getSkillSetCache } from "./skill-set.mjs";
import {
  applySkillPoints,
  evaluateSkillLevelRequirement,
  isSkillLevelGateEnforced,
  FOCUS_BONUS_SKILL_POINTS,
} from "./skill-points.mjs";
import {
  findSkillBySlug,
  resolveSkillsBySlug,
  declaredBonusSkills,
  bonusSkillsPickCount,
  needsBonusSkillChoice,
  resolveListedBonusSkillSlugs,
  promptBonusSkillChoiceDialog,
  promptBonusSkillRedirect,
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
 * @param {number} [characterLevel] When given, grants respect the same
 *   character-level rank cap as a manual purchase (evaluateSkillLevelRequirement),
 *   unless the `noSkillLevelReq` house-rule setting is on.
 * @returns {{ ownedLevel: number, pointsInvested: number, blocked: boolean }}
 *   `blocked` is only ever true on the rank path: the grant could not raise
 *   this skill at all (as opposed to the points path, which always banks
 *   what it can't spend on the skill itself). The caller can offer to
 *   redirect a blocked grant to a different skill -- see
 *   {@link module:bonus-skills-shared.promptBonusSkillRedirect}.
 */
export function computeFocusBonusGrant(skill, usePoints, characterLevel) {
  const beforeLevel = skill.system.ownedLevel ?? -1;
  const beforeInvested = skill.system.pointsInvested ?? 0;
  if (usePoints) {
    const after = applySkillPoints(beforeLevel, beforeInvested, FOCUS_BONUS_SKILL_POINTS, { characterLevel });
    return { ownedLevel: after.ownedLevel, pointsInvested: after.pointsInvested, blocked: false };
  }
  // Rank path: each grant raises the skill by one rank (untrained -1 -> 0,
  // trained 0 -> 1, etc.) -- stacking a second grant on an already-trained
  // skill is a real rank increase, not a wasted no-op. But it must still
  // respect the same level cap a manual purchase would (e.g. a level-1
  // character can reach rank 1 but never rank 2, which needs level 3).
  if (isSkillLevelGateEnforced(characterLevel) && !evaluateSkillLevelRequirement(beforeLevel, characterLevel).ok) {
    return { ownedLevel: beforeLevel, pointsInvested: beforeInvested, blocked: true };
  }
  return { ownedLevel: beforeLevel + 1, pointsInvested: beforeInvested, blocked: false };
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
 * Grant `slug`'s bonus to `skill` on `actor`. Shared by focus, power, and
 * classEdge grants (only ever called from the createItem/updateItem hooks —
 * item dropped onto a character, or its bonus-skill choice changes — never
 * re-synced on a timer or login, so this only ever runs once per
 * item/skill pair; idempotency is tracked on the granting item itself via
 * hasGrantedSkill/recordGrantedSkill).
 *
 * A rank-path grant blocked by the character-level rank cap isn't just
 * dropped: the player is offered a different, currently-eligible skill to
 * redirect the bonus to instead (still subject to the same cap). If no
 * prompt is allowed right now, or none is available/chosen, the grant is
 * left unrecorded so a later prompt-enabled sync can retry it.
 * @param {Item} item Granting focus/power/classEdge
 * @param {Actor} actor
 * @param {Item} skill
 * @param {string} slug
 * @param {{ usePoints: boolean, prompt: boolean, reservedSkillIds?: Iterable<string> }} options
 *   `usePoints` only ever applies to focus grants (power/classEdge always
 *   grant a rank). `reservedSkillIds` are sibling skills this same item's
 *   bonus-skill list is also granting in this pass -- excluded as redirect
 *   targets since they have their own pending entitlement (see the
 *   `resolveSkillsBySlug` call sites in syncFocusBonusSkills/syncPowerBonusSkills).
 */
export async function grantBonusSkill(item, actor, skill, slug, { usePoints, prompt, reservedSkillIds = [] }) {
  if (hasGrantedSkill(item, slug)) return;

  const characterLevel = actor.system.details?.level ?? 1;
  let target = skill;
  let grant = computeFocusBonusGrant(target, usePoints, characterLevel);

  if (grant.blocked) {
    if (!prompt) return;
    const redirect = await promptBonusSkillRedirect({ item, actor, blockedSkill: skill, characterLevel, reservedSkillIds });
    if (!redirect) return;
    target = redirect;
    grant = computeFocusBonusGrant(target, usePoints, characterLevel);
    if (grant.blocked) return;
  }

  await target.update({
    "system.ownedLevel": grant.ownedLevel,
    "system.pointsInvested": grant.pointsInvested,
  });
  await recordGrantedSkill(item, slug, target.id);
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
 * @param {{ prompt?: boolean, allowRedirectPrompt?: boolean }} [options]
 *   `prompt` gates the top-level "which skill(s) does this grant" choice
 *   dialog. `allowRedirectPrompt` (defaults to `prompt`) separately gates
 *   the one-time "this grant is blocked, pick another skill" dialog --
 *   callers running from a live hook but not wanting to re-ask the
 *   top-level choice (e.g. an existing focus's ownedLevel/bonusSkillsChosen
 *   changing) can pass `{ prompt: false, allowRedirectPrompt: true }` so a
 *   newly-unlocked, newly-blocked grant still gets a chance to redirect
 *   instead of being stuck forever (nothing else ever re-syncs this
 *   focus/skill pair with a prompt allowed). Batch/migration callers
 *   (`syncActorFocusBonusSkills`) leave both false.
 */
export async function syncFocusBonusSkills(focus, actor, { prompt = false, allowRedirectPrompt = prompt } = {}) {
  if (focus.type !== "focus" || !isPc(actor)) return;
  if ((focus.system.ownedLevel ?? 1) < 1) return;

  const usePoints = shouldUseFocusBonusPoints(actor);
  const always = alwaysBonusSkills(focus);
  const alwaysSkills = await resolveSkillsBySlug(actor, always);
  const alwaysReserved = new Set([...alwaysSkills.values()].map((s) => s.id));
  for (const slug of always) {
    const skill = alwaysSkills.get(slug);
    if (skill) {
      await grantBonusSkill(focus, actor, skill, slug, {
        usePoints,
        prompt: allowRedirectPrompt,
        reservedSkillIds: alwaysReserved,
      });
    }
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

  // Re-resolved (rather than reusing alwaysSkills) so a redirect during this
  // loop can't land on an "always" skill either -- that skill has its own
  // pending entitlement whether or not it's been granted yet.
  const choiceSkills = await resolveSkillsBySlug(actor, [...always, ...choice]);
  const choiceReserved = new Set([...choiceSkills.values()].map((s) => s.id));
  for (const slug of choice) {
    const skill = choiceSkills.get(slug);
    if (skill) {
      await grantBonusSkill(focus, actor, skill, slug, {
        usePoints,
        prompt: allowRedirectPrompt,
        reservedSkillIds: choiceReserved,
      });
    }
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
