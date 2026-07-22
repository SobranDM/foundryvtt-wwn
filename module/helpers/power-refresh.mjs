import { COMMITMENT_KEYS } from "../config/power-subtypes.mjs";
import { shouldReclaimCommitment } from "./commitment.mjs";
import { expireScopedPowerEffects, syncPowerTransferEffects } from "./power-effects.mjs";

/**
 * Scene/day refresh for committed resources: Power poolCommitted + internalResource,
 * Focus internalResource.
 */

/**
 * Refresh an actor's committed resources.
 * @param {Actor} actor
 * @param {"scene"|"day"} scope
 */
export async function refreshPowers(actor, scope) {
  const itemUpdates = [];
  for (const item of actor.items) {
    if (item.type === "power") {
      const system = item.system;
      const update = { _id: item.id };
      let changed = false;

      for (const length of COMMITMENT_KEYS) {
        const val = system.poolCommitted?.[length] ?? 0;
        if (val > 0 && shouldReclaimCommitment(scope, length, system.isActive)) {
          update[`system.poolCommitted.${length}`] = 0;
          changed = true;
        }
      }

      const useVal = system.internalResource?.value ?? 0;
      if (
        useVal > 0
        && shouldReclaimCommitment(scope, system.internalCommitment, system.isActive)
      ) {
        update["system.internalResource.value"] = 0;
        changed = true;
      }

      if (scope === "day" && system.isActive) {
        update["system.isActive"] = false;
        changed = true;
      }

      if (changed) itemUpdates.push(update);
    } else if (item.type === "focus") {
      const commitment = item.system.resourceLength;
      if (!shouldReclaimCommitment(scope, commitment, false)) continue;
      if ((item.system.internalResource?.value ?? 0) > 0) {
        itemUpdates.push({ _id: item.id, "system.internalResource.value": 0 });
      }
    }
  }

  if (itemUpdates.length) {
    await actor.updateEmbeddedDocuments("Item", itemUpdates);
    for (const update of itemUpdates) {
      const item = actor.items.get(update._id);
      if (item?.type === "power") await syncPowerTransferEffects(item);
    }
  }

  await expireScopedPowerEffects(actor, scope);

  ui.notifications.info(
    game.i18n.format(scope === "day" ? "WWN.Power.RefreshedDay" : "WWN.Power.RefreshedScene", {
      name: actor.name,
    })
  );
}
