/**
 * Apply HP damage to a starship, routing through combat bonus HP first.
 */
import { remainingCombatBonusHp } from "../../helpers/starship-combat-hp.mjs";
import { createNoticeMessage } from "../../chat/chat-card.mjs";
import { confirmWwnDialog } from "../../applications/wwn-dialog.mjs";
import { rollStationCheck } from "../../helpers/starship-rolls.mjs";
import {
  extractChatRollTotal,
  stationCheckSucceeded,
  STARSHIP_ACTION_DC,
} from "./roll-resolve.mjs";

/**
 * @param {Actor} starship
 * @param {number} damage
 */
export async function applyStarshipHullDamage(starship, damage) {
  let remaining = Math.max(0, Math.floor(Number(damage) || 0));
  if (remaining <= 0) return { hullDamage: 0 };

  const bonus = remainingCombatBonusHp(starship);
  if (bonus > 0) {
    const fromBonus = Math.min(bonus, remaining);
    const nextBonus = bonus - fromBonus;
    await starship.setFlag("wwn", "combatBonusHp", nextBonus);
    remaining -= fromBonus;
  }

  if (remaining <= 0) return { hullDamage: 0 };

  const hp = Number(starship.system.hp?.value) || 0;
  const nextHp = Math.max(0, hp - remaining);
  await starship.update({ "system.hp.value": nextHp });

  if (nextHp <= 0) {
    await handleZeroHp(starship);
  }

  return { hullDamage: remaining, hp: nextHp };
}

/**
 * @param {Actor} starship
 */
async function handleZeroHp(starship) {
  const hullClass = starship.system.hullClass;
  if (hullClass === "fighter") {
    await createNoticeMessage({
      title: starship.name,
      actor: starship,
      body: game.i18n.localize("WWN.Starship.FighterDestroyed"),
    });
    return;
  }

  await starship.setFlag("wwn", "mortallyDamaged", true);
  const fuse = await new Roll("2d6").evaluate();
  await createNoticeMessage({
    title: starship.name,
    actor: starship,
    body: game.i18n.format("WWN.Starship.MortallyDamaged", { minutes: fuse.total }),
  });

  const tryHulk = await confirmWwnDialog({
    title: starship.name,
    content: `<p>${game.i18n.localize("WWN.Starship.TryHulkSave")}</p>`,
  });
  if (!tryHulk) return;

  const msg = await rollStationCheck(starship, "engineering", { skipDialog: false });
  const total = extractChatRollTotal(msg);
  if (total == null) return;

  if (stationCheckSucceeded(total, STARSHIP_ACTION_DC.hulkSave)) {
    await starship.setFlag("wwn", "burntOutHulk", true);
    await createNoticeMessage({
      title: starship.name,
      actor: starship,
      body: game.i18n.localize("WWN.Starship.BurntOutHulk"),
    });
  } else {
    ui.notifications?.info?.(game.i18n.localize("WWN.Starship.HulkSaveFailed"));
  }
}
