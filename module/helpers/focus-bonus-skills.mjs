import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";
import { isPc } from "./actor-types.mjs";

const FLAG = "wwn";
const BONUS_POINTS_AT_FIRST_LEVEL = 3;
const SPECIALIST_EXCLUDED = new Set(["magic", "stab", "shoot", "punch"]);

/**
 * @param {Actor} actor
 * @param {string} slug
 * @returns {Item|undefined}
 */
export function findSkillBySlug(actor, slug) {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  return actor.items.find((i) => {
    if (i.type !== "skill") return false;
    const itemSlug = i.system.slug || i.name.slugify({ strict: true }).replace(/-/g, "");
    return itemSlug === normalized;
  });
}

/**
 * @param {Item} focus
 * @returns {string[]}
 */
function declaredBonusSkills(focus) {
  return (focus.system.bonusSkills ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

const OPEN_BONUS_SKILL_FOCI = new Set(["Polymath", "Specialist"]);

/**
 * @param {Item} focus
 * @returns {boolean}
 */
function usesOpenBonusSkillChoice(focus) {
  return OPEN_BONUS_SKILL_FOCI.has(focus.name);
}

/**
 * @param {Item} focus
 * @returns {number}
 */
function bonusSkillsPickCount(focus) {
  return Math.max(Number(focus.system.bonusSkillsPick) || 0, 0);
}

/**
 * @param {Item} focus
 * @returns {boolean}
 */
export function focusNeedsBonusSkillChoice(focus) {
  const pick = bonusSkillsPickCount(focus);
  if (pick <= 0) return false;

  const declared = declaredBonusSkills(focus);
  const chosen = focus.system.bonusSkillsChosen ?? [];
  if (chosen.length) return false;

  if (!declared.length) return usesOpenBonusSkillChoice(focus);
  if (pick === declared.length) return false;
  if (declared.length === 1) return false;
  return pick < declared.length;
}

/**
 * Slugs to grant without prompting.
 * @param {Item} focus
 * @returns {string[]|null} null when a player choice is required
 */
export function resolveBonusSkillSlugs(focus) {
  const pick = bonusSkillsPickCount(focus);
  if (pick <= 0) return [];

  const chosen = (focus.system.bonusSkillsChosen ?? [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);
  if (chosen.length) return chosen;

  const declared = declaredBonusSkills(focus);
  if (!declared.length) return usesOpenBonusSkillChoice(focus) ? null : [];

  if (declared.length === 1 || pick === declared.length) return declared;
  if (pick < declared.length) return null;
  return declared.slice(0, pick);
}

/**
 * @param {Item} focus
 * @returns {string[]}
 */
function openChoiceSlugs(focus) {
  const isSpecialist = focus.name === "Specialist";
  return CONFIG.WWN.coreSkills.filter((slug) => !isSpecialist || !SPECIALIST_EXCLUDED.has(slug));
}

/**
 * @param {Item} focus
 * @param {Actor} actor
 * @returns {Promise<string[]|null>}
 */
export async function promptBonusSkillChoice(focus, actor) {
  const declared = declaredBonusSkills(focus);
  const pick = bonusSkillsPickCount(focus);
  if (pick <= 0) return null;
  const options = declared.length ? declared : openChoiceSlugs(focus);

  const skillOptions = options.map((slug) => ({
    slug,
    label: game.i18n.localize(`WWN.Skills.${slug}`) ?? slug,
  }));

  const multi = pick > 1;
  const template = multi
    ? "systems/wwn/templates/dialog/focus-bonus-skills-multi.hbs"
    : "systems/wwn/templates/dialog/focus-bonus-skills.hbs";

  const result = await showWwnDialog({
    modifier: "focus-bonus-skills",
    title: game.i18n.format("WWN.Focus.BonusSkillDialogTitle", { focus: focus.name }),
    template,
    context: { skillOptions, pick, focusName: focus.name },
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
 * @param {Actor} actor
 * @returns {boolean}
 */
function useHouseRulePoints(actor) {
  return (
    game.settings.get("wwn", "bonusSkillsGrantPointsAtFirstLevel") === true
    && (actor.system.details?.level ?? 1) === 1
  );
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
 * @param {Item} focus
 * @param {Actor} actor
 * @param {Item} skill
 */
async function grantBonusSkill(focus, actor, skill) {
  if (isGrantedByFocus(focus, skill)) return;

  const updates = { [`flags.${FLAG}.focusBonusFrom`]: focus.id };
  const flagPath = `flags.${FLAG}.focusBonusGranted`;

  if (useHouseRulePoints(actor)) {
    const current = skill.system.pointsInvested ?? 0;
    updates["system.pointsInvested"] = current + BONUS_POINTS_AT_FIRST_LEVEL;
    updates[`flags.${FLAG}.focusBonusPoints`] = BONUS_POINTS_AT_FIRST_LEVEL;
  } else if ((skill.system.ownedLevel ?? -1) < 0) {
    updates["system.ownedLevel"] = 0;
  }

  await skill.update(updates);
  if (!focus.getFlag(FLAG, "focusBonusGranted")) {
    await focus.update({ [flagPath]: true });
  }
}

/**
 * @param {Item} focus
 * @param {Actor} actor
 * @param {{ prompt?: boolean }} [options]
 */
export async function syncFocusBonusSkills(focus, actor, { prompt = false } = {}) {
  if (focus.type !== "focus" || !isPc(actor)) return;
  if ((focus.system.ownedLevel ?? 1) < 1) return;

  let slugs = resolveBonusSkillSlugs(focus);
  if (slugs === null && focusNeedsBonusSkillChoice(focus)) {
    if (!prompt) return;
    slugs = await promptBonusSkillChoice(focus, actor);
    if (!slugs?.length) return;
    await focus.update({ "system.bonusSkillsChosen": slugs });
  }
  if (!slugs?.length) return;

  for (const slug of slugs) {
    const skill = findSkillBySlug(actor, slug);
    if (!skill) continue;
    await grantBonusSkill(focus, actor, skill);
  }
}

/**
 * @param {Item} focus
 * @param {Actor} actor
 */
export async function revokeFocusBonusSkills(focus, actor) {
  if (focus.type !== "focus" || !isPc(actor)) return;

  for (const skill of actor.items.filter((i) => i.type === "skill")) {
    if (!isGrantedByFocus(focus, skill)) continue;

    const bonusPoints = Number(skill.getFlag(FLAG, "focusBonusPoints")) || 0;
    const del = new foundry.data.operators.ForcedDeletion();
    const updates = {
      [`flags.${FLAG}.focusBonusFrom`]: del,
      [`flags.${FLAG}.focusBonusPoints`]: del,
    };

    if (bonusPoints > 0) {
      updates["system.pointsInvested"] = Math.max((skill.system.pointsInvested ?? 0) - bonusPoints, 0);
    } else if ((skill.system.ownedLevel ?? -1) === 0) {
      updates["system.ownedLevel"] = -1;
    }

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
