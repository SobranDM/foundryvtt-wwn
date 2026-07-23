/**
 * Extra focus onboarding: Spark skill pool, psychic technique notices.
 */
import { getSkillLabelChoices, getSkillSetCache } from "./skill-set.mjs";

const SPARK_POOL_SIZE = 3;

/**
 * @param {Item} focus
 * @param {Actor} actor
 */
export async function promptSparkSkillPool(focus, actor) {
  if (focus.name !== "Spark of Brilliance") return;
  const existing = focus.getFlag("wwn", "sparkPoolSkills");
  if (Array.isArray(existing) && existing.length === SPARK_POOL_SIZE) return;

  const { showWwnDialog, confirmButton, cancelButton } = await import("../applications/wwn-dialog.mjs");
  const labels = await getSkillLabelChoices();
  const slugs = getSkillSetCache().primarySlugs ?? [];
  const skillOptions = slugs.map((slug) => ({ slug, label: labels[slug] ?? slug }));

  const result = await showWwnDialog({
    modifier: "focus-bonus-skills",
    title: game.i18n.localize("WWN.Focus.SparkPoolDialogTitle"),
    template: "systems/wwn/templates/dialog/focus-bonus-skills-multi.hbs",
    context: { skillOptions, pick: SPARK_POOL_SIZE, focusName: focus.name },
    buttons: [confirmButton(), cancelButton()],
  });
  if (!result || result === "cancel") return;

  const selected = Object.entries(result)
    .filter(([key, val]) => key.startsWith("skill_") && val)
    .map(([key]) => key.replace(/^skill_/, ""));
  if (selected.length !== SPARK_POOL_SIZE) {
    ui.notifications.warn(game.i18n.format("WWN.Focus.SparkPoolPickCount", { pick: SPARK_POOL_SIZE }));
    return;
  }
  await focus.setFlag("wwn", "sparkPoolSkills", selected);
}

/**
 * @param {Item} focus
 */
export function notifyPsychicFocusGrant(focus) {
  if (focus.name === "Psychic Training") {
    ui.notifications.info(game.i18n.format("WWN.Focus.PsychicTechniqueNotice", { focus: focus.name }));
  } else if (focus.name === "Wild Psychic Talent") {
    ui.notifications.info(game.i18n.format("WWN.Focus.WildPsychicNotice", { focus: focus.name }));
  }
}

/**
 * Sync Wild Psychic Talent Effort pool with ownedLevel (1 at L1, 2 at L2+).
 * @param {Item} focus
 */
export async function syncWildPsychicEffort(focus) {
  if (focus.name !== "Wild Psychic Talent") return;
  const level = Math.max(Number(focus.system.ownedLevel) || 1, 1);
  const max = level >= 2 ? 2 : 1;
  const cur = Number(focus.system.internalResource?.max) || 0;
  if (cur === max) return;
  await focus.update({
    "system.internalResource.max": max,
    "system.internalResource.value": Math.min(Number(focus.system.internalResource?.value) || 0, max),
    "system.resourceLength": "none",
  });
}
