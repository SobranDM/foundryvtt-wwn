/**
 * Shared bonus-skill choice / resolution / prompt plumbing for focus, power, and classEdge.
 *
 * Grant policy stays type-specific:
 * - focus may use the +3 skill-points path via shouldUseFocusBonusPoints
 * - power / classEdge always grant a single rank (never the points path)
 */
import { getSkillCreateDataBySlug, getSkillLabelChoices, skillSlugOf } from "./skill-set.mjs";
import { evaluateSkillLevelRequirement, isSkillLevelGateEnforced } from "./skill-points.mjs";

const FLAG = "wwn";

/** Flag key (under the `wwn` namespace) an item's own granted-skills list lives under. */
export const GRANTED_SKILLS_FLAG = "bonusSkillsGranted";

/**
 * Flag key mapping each granted slug to the id of the skill it actually
 * landed on -- usually the same skill `slug` names, but a rank-path grant
 * blocked by the level cap may have redirected onto a different skill (see
 * grantBonusSkill). Lets a deleted-skill cleanup pass (see
 * clearGrantedSkillsForDeletedTarget) tell which granted slugs, if any,
 * targeted the skill that just vanished.
 */
export const GRANTED_SKILL_TARGETS_FLAG = "bonusSkillsGrantedTargets";

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
 * Record that `item` has granted `slug`, and (when known) which skill id
 * actually received it -- may differ from the skill `slug` names if the
 * grant was redirected.
 * @param {Item} item
 * @param {string} slug
 * @param {string} [targetId]
 */
export async function recordGrantedSkill(item, slug, targetId) {
  const granted = item.getFlag(FLAG, GRANTED_SKILLS_FLAG) ?? [];
  const update = { [`flags.${FLAG}.${GRANTED_SKILLS_FLAG}`]: [...granted, slug] };
  if (targetId) {
    const targets = item.getFlag(FLAG, GRANTED_SKILL_TARGETS_FLAG) ?? {};
    update[`flags.${FLAG}.${GRANTED_SKILL_TARGETS_FLAG}`] = { ...targets, [slug]: targetId };
  }
  await item.update(update);
}

/**
 * When a skill item is deleted, any focus/power/classEdge that redirected a
 * blocked grant onto it (see grantBonusSkill) is left forever believing that
 * slug is already granted, even though the skill -- and the bonus it
 * carried -- no longer exists. This clears those slugs (from both the
 * granted list and the target map) on every one of the actor's granting
 * items so a later sync can retry the grant instead of the bonus being
 * silently lost for good.
 * @param {Actor} actor
 * @param {string} deletedSkillId
 */
export async function clearGrantedSkillsForDeletedTarget(actor, deletedSkillId) {
  for (const source of actor.items ?? []) {
    if (!["focus", "power", "classEdge"].includes(source.type)) continue;
    const targets = source.getFlag(FLAG, GRANTED_SKILL_TARGETS_FLAG);
    if (!targets) continue;
    const staleSlugs = Object.entries(targets)
      .filter(([, targetId]) => targetId === deletedSkillId)
      .map(([slug]) => slug);
    if (!staleSlugs.length) continue;

    const granted = source.getFlag(FLAG, GRANTED_SKILLS_FLAG) ?? [];
    // A plain update() merges nested flag objects rather than replacing them,
    // so removing a target-map entry needs Foundry's `-=key` deletion syntax
    // (same pattern as the party carrierAssignments cleanup in wwn.mjs) --
    // sending a trimmed copy of the object would just get merged back in.
    const update = {
      [`flags.${FLAG}.${GRANTED_SKILLS_FLAG}`]: granted.filter((s) => !staleSlugs.includes(s)),
    };
    for (const slug of staleSlugs) {
      update[`flags.${FLAG}.${GRANTED_SKILL_TARGETS_FLAG}.-=${slug}`] = null;
    }
    await source.update(update);
  }
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
 * Resolve (or create) every skill for a list of slugs at once.
 * @param {Actor} actor
 * @param {Iterable<string>} slugs
 * @returns {Promise<Map<string, Item>>} slug -> skill (slugs with no
 *   resolvable skill are omitted)
 */
export async function resolveSkillsBySlug(actor, slugs) {
  const bySlug = new Map();
  for (const slug of slugs) {
    if (bySlug.has(slug)) continue;
    const skill = await ensureActorSkillBySlug(actor, slug);
    if (skill) bySlug.set(slug, skill);
  }
  return bySlug;
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

/**
 * Other skills on `actor` eligible to receive a redirected rank-path bonus:
 * anything not in `excludeSkillIds` that isn't *also* blocked by the same
 * character-level rank cap.
 * @param {Actor} actor
 * @param {Iterable<string>} excludeSkillIds Skill ids that must not be
 *   offered -- the blocked skill itself, plus any sibling skill this same
 *   grant pass is about to touch (see `promptBonusSkillRedirect`).
 * @param {number} characterLevel
 * @returns {Item[]}
 */
export function eligibleBonusSkillRedirectTargets(actor, excludeSkillIds, characterLevel) {
  const excluded = excludeSkillIds instanceof Set ? excludeSkillIds : new Set(excludeSkillIds);
  const gated = isSkillLevelGateEnforced(characterLevel);
  return actor.items.filter((i) => {
    if (i.type !== "skill" || excluded.has(i.id)) return false;
    if (!gated) return true;
    return evaluateSkillLevelRequirement(i.system.ownedLevel ?? -1, characterLevel).ok;
  });
}

/**
 * A rank-path bonus-skill grant was blocked by the character-level rank cap
 * (evaluateSkillLevelRequirement) -- rather than losing the bonus outright,
 * let the player redirect it to a different, currently-eligible skill on
 * the same actor.
 * @param {{ item: Item, actor: Actor, blockedSkill: Item, characterLevel: number, reservedSkillIds?: Iterable<string> }} args
 *   `reservedSkillIds` excludes sibling skills this same item's bonus-skill
 *   list is about to grant in this pass -- each of those has its own
 *   pending entitlement and must not be consumed by another skill's
 *   redirect (see `resolveSkillsBySlug` call sites).
 * @returns {Promise<Item|null>} the chosen skill, or null if none are
 *   eligible or the player cancels
 */
export async function promptBonusSkillRedirect({ item, actor, blockedSkill, characterLevel, reservedSkillIds = [] }) {
  const excluded = new Set([blockedSkill.id, ...reservedSkillIds]);
  const candidates = eligibleBonusSkillRedirectTargets(actor, excluded, characterLevel);
  if (!candidates.length) {
    ui.notifications?.warn(
      game.i18n.format("WWN.BonusSkillRedirect.NoneEligible", { skill: blockedSkill.name }),
    );
    return null;
  }

  const { showWwnDialog, confirmButton, cancelButton } = await import("../applications/wwn-dialog.mjs");
  const skillOptions = candidates.map((s) => ({ id: s.id, label: s.name }));

  const result = await showWwnDialog({
    modifier: "bonus-skill-redirect",
    title: game.i18n.format("WWN.BonusSkillRedirect.Title", { item: item.name }),
    template: "systems/wwn/templates/dialog/bonus-skill-redirect.hbs",
    context: { skillOptions, blockedName: blockedSkill.name },
    buttons: [confirmButton(), cancelButton()],
  });
  if (!result || result === "cancel" || !result.skill) return null;
  return actor.items.get(result.skill) ?? null;
}
