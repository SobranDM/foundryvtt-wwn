/**
 * Reduce derived System Strain maximum from installed cyberware / custom powers.
 * Active Effects on system.strain.max still apply afterward (final phase).
 * @param {Actor} actor
 */
export function applyInstalledPermanentStrain(actor) {
  let reduction = 0;
  for (const item of actor.items) {
    if (item.type !== "power") continue;
    const system = item.system;
    const subType = system.subType;
    if (subType !== "cyberware" && subType !== "custom") continue;
    if (!system.installed) continue;
    reduction += Math.max(Number(system.permanentStrain) || 0, 0);
  }
  if (reduction <= 0) return;
  actor.system.strain.max = Math.max(0, (actor.system.strain.max ?? 0) - reduction);
}
