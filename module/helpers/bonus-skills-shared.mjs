/**
 * Shared bonus-skill choice / resolution / prompt plumbing for focus, power, and classEdge.
 *
 * Grant policy stays type-specific:
 * - focus may use the +3 skill-points path via shouldUseFocusBonusPoints
 * - power / classEdge always grant a single rank (never the points path)
 */
import { getSkillLabelChoices } from "./skill-set.mjs";

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
 * @param {Item} item
 * @returns {string[]}
 */
export function declaredBonusSkills(item) {
  return (item.system.bonusSkills ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

/**
 * @param {Item} item
 * @returns {number}
 */
export function bonusSkillsPickCount(item) {
  return Math.max(Number(item.system.bonusSkillsPick) || 0, 0);
}

/**
 * @param {Item} item
 * @param {{ usesOpenChoice: (item: Item) => boolean }} options
 * @returns {boolean}
 */
export function needsBonusSkillChoice(item, { usesOpenChoice }) {
  const pick = bonusSkillsPickCount(item);
  if (pick <= 0) return false;

  const declared = declaredBonusSkills(item);
  const chosen = item.system.bonusSkillsChosen ?? [];
  if (chosen.length) return false;

  if (!declared.length) return usesOpenChoice(item);
  if (pick === declared.length) return false;
  if (declared.length === 1) return false;
  return pick < declared.length;
}

/**
 * Resolve choice/list slugs for an item with a pick count.
 * @param {Item} item
 * @param {{
 *   usesOpenChoice: (item: Item) => boolean,
 *   emptyPickReturnsDeclared?: boolean,
 * }} options
 * @returns {string[]|null} null when a player choice is required
 */
export function resolveListedBonusSkillSlugs(item, { usesOpenChoice, emptyPickReturnsDeclared = false }) {
  const pick = bonusSkillsPickCount(item);
  const chosen = (item.system.bonusSkillsChosen ?? [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);
  if (chosen.length) return chosen;

  const declared = declaredBonusSkills(item);
  if (pick <= 0) {
    return emptyPickReturnsDeclared ? declared : [];
  }

  if (!declared.length) return usesOpenChoice(item) ? null : [];
  if (declared.length === 1 || pick === declared.length) return declared;
  if (pick < declared.length) return null;
  return declared.slice(0, pick);
}

/**
 * Shared bonus-skill pick dialog.
 * @param {{
 *   item: Item,
 *   options: string[],
 *   pick: number,
 *   titleKey: string,
 *   titleData: Record<string, string>,
 * }} args
 * @returns {Promise<string[]|null>}
 */
export async function promptBonusSkillChoiceDialog({ item, options, pick, titleKey, titleData }) {
  if (pick <= 0) return null;
  const { showWwnDialog, confirmButton, cancelButton } = await import("../applications/wwn-dialog.mjs");
  const labels = await getSkillLabelChoices();

  const skillOptions = options.map((slug) => ({
    slug,
    label: labels[slug] ?? slug,
  }));

  const multi = pick > 1;
  const template = multi
    ? "systems/wwn/templates/dialog/focus-bonus-skills-multi.hbs"
    : "systems/wwn/templates/dialog/focus-bonus-skills.hbs";

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
