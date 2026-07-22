/**
 * Focus-driven skill roll dice (Specialist, Gifted Chirurgeon, etc.).
 */

/**
 * Extra dice and drop-lowest count from foci targeting a skill slug.
 * @param {Actor} actor
 * @param {string} skillSlug
 * @returns {{ extraDice: number, dropLowest: number }}
 */
export function getFocusSkillDiceBonus(actor, skillSlug) {
  const normalized = String(skillSlug ?? "").trim().toLowerCase();
  if (!normalized) return { extraDice: 0, dropLowest: 0 };

  let extraDice = 0;
  for (const focus of actor.items.filter((i) => i.type === "focus")) {
    if ((focus.system.ownedLevel ?? 1) < 1) continue;
    const target = String(focus.system.skillBonus ?? "").trim().toLowerCase();
    if (target !== normalized) continue;

    const base = Number(focus.system.bonusDice) || 0;
    if (!base) continue;

    let extra = base;
    if (focus.name === "Specialist" && (focus.system.ownedLevel ?? 1) >= 2) {
      extra = Math.max(base, 2);
    }
    extraDice = Math.max(extraDice, extra);
  }

  return { extraDice, dropLowest: extraDice };
}

/**
 * @param {Item} focus
 * @param {Actor} actor
 */
export async function promptFocusSkillBonus(focus, actor) {
  const skills = actor.items
    .filter((i) => i.type === "skill")
    .map((skill) => ({
      slug: skill.system.slug || skill.name.slugify({ strict: true }).replace(/-/g, ""),
      label: skill.name,
    }));

  if (!skills.length) {
    ui.notifications.warn(game.i18n.localize("WWN.Focus.SkillBonusNoSkills"));
    return;
  }

  const result = await import("../applications/wwn-dialog.mjs").then(({ showWwnDialog, confirmButton, cancelButton }) =>
    showWwnDialog({
      modifier: "focus-skill-bonus",
      title: game.i18n.format("WWN.Focus.SkillBonusDialogTitle", { focus: focus.name }),
      template: "systems/wwn/templates/dialog/focus-skill-bonus.hbs",
      context: { skillOptions: skills, focusName: focus.name },
      buttons: [confirmButton(), cancelButton()],
    })
  );

  if (!result || result === "cancel" || !result.skill) return;
  await focus.update({ "system.skillBonus": String(result.skill) });
}
