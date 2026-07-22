import { isNpc } from "../helpers/actor-types.mjs";
/**
 * Random HP for unlinked NPC tokens dropped on a scene.
 */
export function registerRandomHpHook() {
  Hooks.on("preCreateToken", (tokenDocument, _data, _options, _userId) => {
    if (!game.settings.get("wwn", "randomHP")) return;
    const actor = tokenDocument.actor;
    if (!actor || !isNpc(actor) || tokenDocument.actorLink) return;
    const hd = String(actor.system.hd || "1d8");
    try {
      const roll = new Roll(hd);
      roll.evaluateSync({ strict: false });
      tokenDocument.updateSource({
        delta: { system: { hp: { value: roll.total, max: roll.total } } },
      });
    } catch (err) {
      console.warn(`WWN | Could not roll random HP for ${actor.name}: ${err.message}`);
    }
  });
}
