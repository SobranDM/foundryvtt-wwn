import { isPc } from "./actor-types.mjs";
import { getSkillSetCache } from "./skill-set.mjs";
import { computeFocusBonusGrant } from "./focus-bonus-skills.mjs";
import {
  ensureActorSkillBySlug,
  declaredBonusSkills,
  bonusSkillsPickCount,
  needsBonusSkillChoice,
  resolveListedBonusSkillSlugs,
  promptBonusSkillChoiceDialog,
  filterOpenBonusSkillSlugs,
  hasGrantedSkill,
  recordGrantedSkill,
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
 * Always grant a single rank (train untrained → 0). Never uses the focus
 * points path. Only ever called from the createItem/updateItem hooks (item
 * dropped onto a character, or its bonus-skill choice changes) — never
 * re-synced on a timer or login, so this only ever runs once per item/skill
 * pair. Idempotency is tracked on the granting item itself via
 * hasGrantedSkill/recordGrantedSkill (bonus-skills-shared.mjs) — see the
 * note there for why a shared "who granted this" slot on the skill can't
 * work once more than one source targets the same skill.
 * @param {Item} item
 * @param {Item} skill
 * @param {string} slug
 */
async function grantBonusSkill(item, skill, slug) {
  if (hasGrantedSkill(item, slug)) return;

  // Powers and classEdges always use rank grants — never FOCUS_BONUS_SKILL_POINTS.
  const grant = computeFocusBonusGrant(skill, false);
  await skill.update({
    "system.ownedLevel": grant.ownedLevel,
    "system.pointsInvested": grant.pointsInvested,
  });
  await recordGrantedSkill(item, slug);
}

/**
 * @param {Item} item
 * @param {Actor} actor
 * @param {{ prompt?: boolean }} [options]
 */
export async function syncPowerBonusSkills(item, actor, { prompt = false } = {}) {
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

  for (const slug of slugs) {
    const skill = await ensureActorSkillBySlug(actor, slug);
    if (skill) await grantBonusSkill(item, skill, slug);
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
