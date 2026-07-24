/**
 * Auto-stabilize when reduced to 0 HP (Die Hard / Regenerator / etc.).
 * Die Hard's Heavy-weapon carve-out is not encoded separately on the AE flag;
 * when source is unknown we still stabilize (mutations have no carve-out).
 */
import { hasAutoStabilize } from "./combat-ae-flags.mjs";
import { createNoticeMessage } from "../chat/chat-card.mjs";

/**
 * @param {Actor} actor
 * @param {object} [_ctx]
 */
export async function onActorZeroHpAutoStabilize(actor, _ctx = {}) {
  if (!hasAutoStabilize(actor)) return;
  if (actor.getFlag("wwn", "stabilized")) return;

  await actor.setFlag("wwn", "stabilized", true);
  await createNoticeMessage({
    title: actor.name,
    body: game.i18n.format("WWN.Chat.AutoStabilized", { name: actor.name }),
    actor,
    flags: { kind: "stabilize" },
  });
}
