import { isPc } from "./actor-types.mjs";
import { getSkillSetCache } from "./skill-set.mjs";
import { grantBonusSkill } from "./focus-bonus-skills.mjs";
import {
  resolveSkillsBySlug,
  declaredBonusSkills,
  bonusSkillsPickCount,
  needsBonusSkillChoice,
  resolveListedBonusSkillSlugs,
  promptBonusSkillChoiceDialog,
  filterOpenBonusSkillSlugs,
} from "./bonus-skills-shared.mjs";

/** Item types that use power-style bonusSkills fields. */
const BONUS_SKILL_ITEM_TYPES = new Set(["power", "classEdge"]);

/**
 * @param {string} mode
 * @returns {boolean}
 */
function isOpenBonusMode(mode) {
  return mode === "any" || mode === "noncombat";
}

function usesOpenAnyChoice(item) {
  return isOpenBonusMode(item.system.bonusSkillsMode) && declaredBonusSkills(item).length === 0;
}

/**
 * @param {Item} item
 * @returns {boolean}
 */
export function powerNeedsBonusSkillChoice(item) {
  if (!BONUS_SKILL_ITEM_TYPES.has(item?.type)) return false;
  return needsBonusSkillChoice(item, { usesOpenChoice: usesOpenAnyChoice });
}

/**
 * @param {Item} item
 * @returns {string[]|null} null when a player choice is required
 */
export function resolvePowerBonusSkillSlugs(item) {
  if (!BONUS_SKILL_ITEM_TYPES.has(item?.type)) return [];
  return resolveListedBonusSkillSlugs(item, {
    usesOpenChoice: usesOpenAnyChoice,
    emptyPickReturnsDeclared: true,
  });
}
function openAnySlugs(item) {
  return filterOpenBonusSkillSlugs(
    getSkillSetCache().primarySlugs ?? [],
    item?.system?.bonusSkillsMode ?? "any",
  );
}

/**
 * @param {Item} item
 * @param {Actor} _actor
 * @returns {Promise<string[]|null>}
 */
async function promptBonusSkillChoice(item, _actor) {
  const declared = declaredBonusSkills(item);
  const pick = bonusSkillsPickCount(item);
  const options = declared.length ? declared : openAnySlugs(item);
  const titleKey = item.type === "classEdge"
    ? "WWN.ClassEdge.BonusSkillDialogTitle"
    : "WWN.Power.BonusSkillDialogTitle";
  const titleData = item.type === "classEdge"
    ? { edge: item.name }
    : { power: item.name };

  return promptBonusSkillChoiceDialog({
    item,
    options,
    pick,
    titleKey,
    titleData,
  });
}

/**
 * @param {Item} item
 * @param {Actor} actor
 * @param {{ prompt?: boolean, allowRedirectPrompt?: boolean }} [options]
 *   `prompt` gates the top-level "which skill(s) does this grant" choice
 *   dialog. `allowRedirectPrompt` (defaults to `prompt`) separately gates
 *   the one-time "this grant is blocked, pick another skill" dialog -- see
 *   the matching note on `syncFocusBonusSkills`.
 */
export async function syncPowerBonusSkills(item, actor, { prompt = false, allowRedirectPrompt = prompt } = {}) {
  if (!BONUS_SKILL_ITEM_TYPES.has(item?.type) || !isPc(actor)) return;

  const hasBonusConfig =
    declaredBonusSkills(item).length > 0
    || bonusSkillsPickCount(item) > 0
    || isOpenBonusMode(item.system.bonusSkillsMode);
  if (!hasBonusConfig) return;

  let slugs = resolvePowerBonusSkillSlugs(item);
  if (slugs === null && powerNeedsBonusSkillChoice(item)) {
    if (!prompt) return;
    slugs = await promptBonusSkillChoice(item, actor);
    if (!slugs?.length) return;
    // wwnBonusSkillSync: see the matching note in focus-bonus-skills.mjs's
    // syncFocusBonusSkills — stops this write's own updateItem hook fire
    // from re-entering this function before the grant loop below finishes.
    await item.update({ "system.bonusSkillsChosen": slugs }, { wwnBonusSkillSync: true });
  }
  if (!slugs?.length) return;

  // Resolved up front so a blocked slug's redirect can't land on a sibling
  // slug from this same list -- that sibling has its own pending
  // entitlement, whether or not it's been granted yet in this loop.
  const skillsBySlug = await resolveSkillsBySlug(actor, slugs);
  const reservedSkillIds = new Set([...skillsBySlug.values()].map((s) => s.id));
  for (const slug of slugs) {
    const skill = skillsBySlug.get(slug);
    // Powers and classEdges always use rank grants — never the focus points path.
    if (skill) {
      await grantBonusSkill(item, actor, skill, slug, {
        usePoints: false,
        prompt: allowRedirectPrompt,
        reservedSkillIds,
      });
    }
  }
}

/**
 * @param {Actor} actor
 */
export async function syncActorPowerBonusSkills(actor) {
  for (const item of actor.items.filter((i) => BONUS_SKILL_ITEM_TYPES.has(i.type))) {
    await syncPowerBonusSkills(item, actor, { prompt: false });
  }
}
