/**
 * Power armor operations (cells, scene/maint resets, maintenance failure).
 */
import {
  resetMaintFittingState,
  resetSceneFittingState,
  patchFittingState,
} from "./power-armor-fitting-state.mjs";
import {
  pickRandomFittingToDisable,
  resolveMaintenanceFailure,
} from "./power-armor-maintenance.mjs";
/**
 * Consume one Emergency Power Cell fitting and refill suit runtime.
 * @param {Actor} suit powerArmor actor
 * @returns {Promise<boolean>} true if a cell was consumed
 */
export async function useEmergencyPowerCell(suit) {
  if (suit?.type !== "powerArmor") return false;
  if (suit.system.perpetual || suit.system.derived?.perpetual) return false;

  const cell = suit.items.find(
    (i) => i.type === "armorFitting"
      && i.system?.effectId === "emergencyPowerCell"
      && !i.system?.disabled,
  );
  if (!cell) {
    ui.notifications?.warn?.(game.i18n.localize("WWN.PowerArmor.NoEmergencyCell"));
    return false;
  }

  await cell.update({ "system.disabled": true });
  suit.prepareData();
  const max = suit.system.derived?.runtimeMax ?? suit.system.runtime?.max ?? 30;
  await suit.update({
    "system.powered": true,
    "system.runtime.max": max,
    "system.runtime.remaining": max,
  });
  ui.notifications?.info?.(
    game.i18n.format("WWN.PowerArmor.EmergencyCellUsed", { minutes: max }),
  );
  return true;
}

/**
 * Reset scene-scoped fitting state on the suit.
 * @param {Actor} suit
 */
export async function resetPowerArmorScene(suit) {
  if (suit?.type !== "powerArmor") return false;
  const next = resetSceneFittingState(suit.system.fittingState ?? {});
  await suit.update({ "system.fittingState": next });
  ui.notifications?.info?.(game.i18n.localize("WWN.PowerArmor.SceneReset"));
  return true;
}

/**
 * Mark suit maintained: clear skipped counter and maint-scoped fitting locks.
 * @param {Actor} suit
 */
export async function markPowerArmorMaintained(suit) {
  if (suit?.type !== "powerArmor") return false;
  const next = resetMaintFittingState(suit.system.fittingState ?? {});
  // Clear soak-half flag from maintenance failure if stored
  if (next._maint) delete next._maint;
  await suit.update({
    "system.maintenance.skipped": 0,
    "system.fittingState": next,
  });
  ui.notifications?.info?.(game.i18n.localize("WWN.PowerArmor.MarkedMaintained"));
  return true;
}

/**
 * Skip a maintenance interval and roll the failure table.
 * @param {Actor} suit
 */
export async function skipPowerArmorMaintenance(suit) {
  if (suit?.type !== "powerArmor") return false;
  const skipped = (suit.system.maintenance?.skipped ?? 0) + 1;
  const { WwnRoll } = await import("../dice/rolls.mjs");
  const die = await new WwnRoll("1d6", {}, { kind: "formula" }).evaluate();
  const result = resolveMaintenanceFailure(die.total + skipped);
  const updates = { "system.maintenance.skipped": skipped };
  let state = { ...(suit.system.fittingState ?? {}) };

  if (result.apply.cutRuntimeHalf && suit.system.runtime?.remaining != null) {
    updates["system.runtime.remaining"] = Math.max(0, Math.floor(suit.system.runtime.remaining / 2));
  }
  if (result.apply.depower) {
    updates["system.powered"] = false;
  }
  if (result.apply.soakMaxHalf) {
    state = patchFittingState({ fittingState: state }, "_maint", { flags: { soakMaxHalf: true } });
  }
  if (result.apply.disableRandomFitting) {
    const id = pickRandomFittingToDisable([...suit.items]);
    if (id) await suit.items.get(id)?.update({ "system.disabled": true });
  }

  updates["system.fittingState"] = state;
  await suit.update(updates);
  ui.notifications?.warn?.(
    game.i18n.format("WWN.PowerArmor.MaintenanceFailure", { result: result.label }),
  );
  return true;
}
