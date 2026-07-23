import { isPc } from "./actor-types.mjs";
import { getSkillLabelChoices, getSkillSetCache } from "./skill-set.mjs";
import {
  computeFocusBonusGrant,
  computeFocusBonusRevoke,
  findSkillBySlug,
} from "./focus-bonus-skills.mjs";

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
 * @returns {string[]}
 */
function declaredBonusSkills(item) {
  return (item.system.bonusSkills ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

/**
 * @param {Item} item
 * @returns {number}
 */
function bonusSkillsPickCount(item) {
  return Math.max(Number(item.system.bonusSkillsPick) || 0, 0);
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
  const pick = bonusSkillsPickCount(item);
  if (pick <= 0) return false;

  const declared = declaredBonusSkills(item);
  const chosen = item.system.bonusSkillsChosen ?? [];
  if (chosen.length) return false;

  if (!declared.length) return usesOpenAnyChoice(item);
  if (pick === declared.length) return false;
  if (declared.length === 1) return false;
  return pick < declared.length;
}

/** @deprecated Use powerNeedsBonusSkillChoice (works for power and classEdge). */
export const classEdgeNeedsBonusSkillChoice = powerNeedsBonusSkillChoice;

/**
 * @param {Item} item
 * @returns {string[]|null} null when a player choice is required
 */
export function resolvePowerBonusSkillSlugs(item) {
  if (!BONUS_SKILL_ITEM_TYPES.has(item?.type)) return [];
  const pick = bonusSkillsPickCount(item);
  const chosen = (item.system.bonusSkillsChosen ?? [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);
  if (chosen.length) return chosen;

  const declared = declaredBonusSkills(item);
  if (pick <= 0) {
    return declared;
  }

  if (!declared.length) return usesOpenAnyChoice(item) ? null : [];
  if (declared.length === 1 || pick === declared.length) return declared;
  if (pick < declared.length) return null;
  return declared.slice(0, pick);
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
 * @param {Actor} actor
 * @returns {Promise<string[]|null>}
 */
async function promptBonusSkillChoice(item, actor) {
  const declared = declaredBonusSkills(item);
  const pick = bonusSkillsPickCount(item);
  if (pick <= 0) return null;
  const { showWwnDialog, confirmButton, cancelButton } = await import("../applications/wwn-dialog.mjs");
  const labels = await getSkillLabelChoices();
  const options = declared.length ? declared : openAnySlugs();

  const skillOptions = options.map((slug) => ({
    slug,
    label: labels[slug] ?? slug,
  }));

  const multi = pick > 1;
  const template = multi
    ? "systems/wwn/templates/dialog/focus-bonus-skills-multi.hbs"
    : "systems/wwn/templates/dialog/focus-bonus-skills.hbs";

  const titleKey = item.type === "classEdge"
    ? "WWN.ClassEdge.BonusSkillDialogTitle"
    : "WWN.Power.BonusSkillDialogTitle";
  const titleData = item.type === "classEdge"
    ? { edge: item.name }
    : { power: item.name };

  const result = await showWwnDialog({
    modifier: "focus-bonus-skills",
    title: game.i18n.format(titleKey, titleData),
    template,
    context: { skillOptions, pick, focusName: item.name },
    buttons: [confirmButton(), cancelButton()],
  });

  if (!result || result === "cancel") return null;

  if (multi) {
    const selected = Object.entries(result)
      .filter(([key, val]) => key.startsWith("skill_") && val)
      .map(([key]) => key.replace(/^skill_/, ""));
    if (selected.length !== pick) {
      ui.notifications.warn(game.i18n.format("WWN.Focus.BonusSkillPickCount", { pick }));
      return null;
    }
    return selected;
  }

  const slug = result.skill;
  return slug ? [String(slug)] : null;
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
