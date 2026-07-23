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
