/**
 * Shared bonus-skill choice / resolution / prompt plumbing for focus, power, and classEdge.
 *
 * Grant policy stays type-specific:
 * - focus may use the +3 skill-points path via shouldUseFocusBonusPoints
 * - power / classEdge always grant a single rank (never the points path)
 */
import { getSkillCreateDataBySlug, getSkillLabelChoices, skillSlugOf } from "./skill-set.mjs";

const FLAG = "wwn";

/** Flag key (under the `wwn` namespace) an item's own granted-skills list lives under. */
export const GRANTED_SKILLS_FLAG = "bonusSkillsGranted";

/**
 * Whether `item` has already granted its bonus for `slug`. Tracked on the
 * granting item itself (which skills *it* has granted), never on the
 * skill — a shared "who granted this" slot on the skill breaks once more
 * than one source targets the same skill: each grant overwrites the
 * other's stamp, so neither guard ever holds and both re-grant forever.
 * Per-item tracking has no shared slot to contend over, so it can't
 * collide no matter how many other items also touch the same skill.
 * @param {Item} item
 * @param {string} slug
 * @returns {boolean}
 */
export function hasGrantedSkill(item, slug) {
  const granted = item.getFlag(FLAG, GRANTED_SKILLS_FLAG);
  return Array.isArray(granted) && granted.includes(slug);
}

/**
 * Record that `item` has granted `slug`.
 * @param {Item} item
 * @param {string} slug
 */
export async function recordGrantedSkill(item, slug) {
  const granted = item.getFlag(FLAG, GRANTED_SKILLS_FLAG) ?? [];
  await item.setFlag(FLAG, GRANTED_SKILLS_FLAG, [...granted, slug]);
}

/**
 * @param {Actor} actor
 * @param {string} slug
 * @returns {Item|undefined}
 */
export function findSkillBySlug(actor, slug) {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  return actor.items.find((i) => i.type === "skill" && skillSlugOf(i) === normalized);
}

/**
 * Existing sheet skills are granted in place; secondary / unseeded slugs must be created.
 * @param {Actor} actor
 * @param {string} slug
 * @returns {{ action: "grant", slug: string, skill: Item } | { action: "create", slug: string }}
 */
export function planBonusSkillGrant(actor, slug) {
  const skill = findSkillBySlug(actor, slug);
  if (skill) return { action: "grant", slug, skill };
  return { action: "create", slug };
}

/**
 * Find a skill on the actor, or create it from the configured skill pack.
 * @param {Actor} actor
 * @param {string} slug
 * @returns {Promise<Item|undefined>}
 */
export async function ensureActorSkillBySlug(actor, slug) {
  const existing = findSkillBySlug(actor, slug);
  if (existing) return existing;
  const data = await getSkillCreateDataBySlug(slug);
  if (!data) return undefined;
  const created = await actor.createEmbeddedDocuments("Item", [data]);
  return Array.isArray(created) ? created[0] : created;
}

/**
 * Primary-skill options for an open bonus-skill pick.
 * `noncombat` drops Punch / Stab / Shoot (CONFIG.WWN.combatSkills).
 * @param {string[]} primarySlugs
 * @param {string} mode
 * @param {string[]} [combatSkills]
 * @returns {string[]}
 */
export function filterOpenBonusSkillSlugs(
  primarySlugs,
  mode,
  combatSkills = globalThis.CONFIG?.WWN?.combatSkills ?? ["stab", "shoot", "punch"],
) {
  const slugs = [...(primarySlugs ?? [])];
  if (mode === "noncombat") {
    const combat = new Set(combatSkills);
    return slugs.filter((slug) => !combat.has(slug));
  }
  return slugs;
}

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
