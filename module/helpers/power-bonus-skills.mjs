import { isPc } from "./actor-types.mjs";
import { getSkillSetCache } from "./skill-set.mjs";
import {
  computeFocusBonusGrant,
  computeFocusBonusRevoke,
} from "./focus-bonus-skills.mjs";
import {
  findSkillBySlug,
  declaredBonusSkills,
  bonusSkillsPickCount,
  needsBonusSkillChoice,
  resolveListedBonusSkillSlugs,
  promptBonusSkillChoiceDialog,
} from "./bonus-skills-shared.mjs";

const FLAG = "wwn";

/** Item types that use power-style bonusSkills fields. */
const BONUS_SKILL_ITEM_TYPES = new Set(["power", "classEdge"]);

/**
 * @param {Item} item
 * @returns {{ from: string, mode: string, levelDelta: string, pointsDelta: string, granted: string }}
 */
function flagKeys(item) {
  if (item.type === "classEdge") {
    return {
      from: "classEdgeBonusFrom",
      mode: "classEdgeBonusMode",
      levelDelta: "classEdgeBonusLevelDelta",
      pointsDelta: "classEdgeBonusPointsDelta",
      granted: "classEdgeBonusGranted",
    };
  }
  return {
    from: "powerBonusFrom",
    mode: "powerBonusMode",
    levelDelta: "powerBonusLevelDelta",
    pointsDelta: "powerBonusPointsDelta",
    granted: "powerBonusGranted",
  };
}

/**
 * @param {Item} item
 * @returns {boolean}
 */
function usesOpenAnyChoice(item) {
  return item.system.bonusSkillsMode === "any" && declaredBonusSkills(item).length === 0;
}

/**
 * @param {Item} item
 * @returns {boolean}
 */
export function powerNeedsBonusSkillChoice(item) {
  if (!BONUS_SKILL_ITEM_TYPES.has(item?.type)) return false;
  return needsBonusSkillChoice(item, { usesOpenChoice: usesOpenAnyChoice });
}

/** @deprecated Use powerNeedsBonusSkillChoice (works for power and classEdge). */
export const classEdgeNeedsBonusSkillChoice = powerNeedsBonusSkillChoice;

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

export const resolveClassEdgeBonusSkillSlugs = resolvePowerBonusSkillSlugs;

/**
 * @returns {string[]}
 */
function openAnySlugs() {
  return [...(getSkillSetCache().primarySlugs ?? [])];
}

/**
 * @param {Item} item
 * @param {Actor} _actor
 * @returns {Promise<string[]|null>}
 */
async function promptBonusSkillChoice(item, _actor) {
  const declared = declaredBonusSkills(item);
  const pick = bonusSkillsPickCount(item);
  const options = declared.length ? declared : openAnySlugs();
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
 * @param {Item} skill
 * @returns {boolean}
 */
function isGrantedByItem(item, skill) {
  const keys = flagKeys(item);
  return skill.getFlag(FLAG, keys.from) === item.id;
}

/**
 * Always grant a single rank (train untrained → 0). Never uses the focus points path.
 * @param {Item} item
 * @param {Item} skill
 */
async function grantBonusSkill(item, skill) {
  if (isGrantedByItem(item, skill)) return;

  const keys = flagKeys(item);
  // Powers and classEdges always use rank grants — never FOCUS_BONUS_SKILL_POINTS.
  const grant = computeFocusBonusGrant(skill, false);
  const updates = {
    [`flags.${FLAG}.${keys.from}`]: item.id,
    "system.ownedLevel": grant.ownedLevel,
    "system.pointsInvested": grant.pointsInvested,
    [`flags.${FLAG}.${keys.mode}`]: grant.focusBonusMode,
    [`flags.${FLAG}.${keys.levelDelta}`]: grant.focusBonusLevelDelta,
    [`flags.${FLAG}.${keys.pointsDelta}`]: grant.focusBonusPointsDelta,
  };

  await skill.update(updates);
  if (!item.getFlag(FLAG, keys.granted)) {
    await item.update({ [`flags.${FLAG}.${keys.granted}`]: true });
  }
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
    || item.system.bonusSkillsMode === "any";
  if (!hasBonusConfig) return;

  let slugs = resolvePowerBonusSkillSlugs(item);
  if (slugs === null && powerNeedsBonusSkillChoice(item)) {
    if (!prompt) return;
    slugs = await promptBonusSkillChoice(item, actor);
    if (!slugs?.length) return;
    await item.update({ "system.bonusSkillsChosen": slugs });
  }
  if (!slugs?.length) return;

  for (const slug of slugs) {
    const skill = findSkillBySlug(actor, slug);
    if (skill) await grantBonusSkill(item, skill);
  }
}

export const syncClassEdgeBonusSkills = syncPowerBonusSkills;

/**
 * @param {Item} item
 * @param {Actor} actor
 */
export async function revokePowerBonusSkills(item, actor) {
  if (!BONUS_SKILL_ITEM_TYPES.has(item?.type) || !isPc(actor)) return;

  const keys = flagKeys(item);
  for (const skill of actor.items.filter((i) => i.type === "skill")) {
    if (!isGrantedByItem(item, skill)) continue;

    const levelDelta = Number(skill.getFlag(FLAG, keys.levelDelta)) || 0;
    const pointsDelta = Number(skill.getFlag(FLAG, keys.pointsDelta)) || 0;
    const legacyRank = !skill.getFlag(FLAG, keys.mode);

    const del = new foundry.data.operators.ForcedDeletion();
    const updates = {
      [`flags.${FLAG}.${keys.from}`]: del,
      [`flags.${FLAG}.${keys.mode}`]: del,
      [`flags.${FLAG}.${keys.levelDelta}`]: del,
      [`flags.${FLAG}.${keys.pointsDelta}`]: del,
      ...Object.fromEntries(
        Object.entries(
          computeFocusBonusRevoke(skill, { levelDelta, pointsDelta, legacyRank }),
        ).map(([key, value]) => [`system.${key}`, value]),
      ),
    };

    await skill.update(updates);
  }
}

export const revokeClassEdgeBonusSkills = revokePowerBonusSkills;

/**
 * @param {Actor} actor
 */
export async function syncActorPowerBonusSkills(actor) {
  for (const item of actor.items.filter((i) => BONUS_SKILL_ITEM_TYPES.has(i.type))) {
    await syncPowerBonusSkills(item, actor, { prompt: false });
  }
}
