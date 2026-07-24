/**
 * Disable / destroy ship systems and drive rating.
 */

/**
 * @param {Item} item
 * @returns {Promise<"disabled"|"destroyed"|null>}
 */
export async function disableShipSystem(item) {
  if (!item) return null;
  if (item.system?.destroyed) return "destroyed";
  if (item.system?.disabled) {
    await item.update({ "system.destroyed": true, "system.disabled": true });
    return "destroyed";
  }
  await item.update({ "system.disabled": true });
  return "disabled";
}

/**
 * @param {Item} item
 */
export async function repairDisabledShipSystem(item) {
  if (!item) return false;
  if (item.system?.destroyed) return false;
  if (!item.system?.disabled) return true;
  await item.update({ "system.disabled": false });
  return true;
}

/**
 * Degrade spike drive by 1; destroy engines if rating would go below 0.
 * @param {Actor} starship
 * @returns {Promise<{ drive: number, destroyed: boolean }>}
 */
export async function degradeDrive(starship) {
  const drive = Number(starship.system.drive) || 0;
  const next = drive - 1;
  if (next < 0) {
    await starship.update({
      "system.drive": 0,
      "flags.wwn.enginesDestroyed": true,
    });
    return { drive: 0, destroyed: true };
  }
  await starship.update({ "system.drive": next });
  return { drive: next, destroyed: false };
}

/**
 * @param {Actor} starship
 */
export function enginesDestroyed(starship) {
  return !!starship?.getFlag?.("wwn", "enginesDestroyed") || (Number(starship?.system?.drive) || 0) < 0;
}

/**
 * Restore +1 drive or clear enginesDestroyed if repairing drive.
 * @param {Actor} starship
 */
export async function repairDriveStep(starship) {
  if (starship.getFlag("wwn", "enginesDestroyed")) {
    await starship.update({
      "system.drive": 0,
      "flags.wwn.enginesDestroyed": false,
    });
    return { drive: 0 };
  }
  const drive = Number(starship.system.drive) || 0;
  await starship.update({ "system.drive": drive + 1 });
  return { drive: drive + 1 };
}

/**
 * Does the ship have Hardened Polyceramic Overlay (not disabled/destroyed)?
 * @param {Actor} starship
 */
export function hasHardenedPolyceramic(starship) {
  return (starship.items ?? []).some(
    (i) =>
      i.type === "shipDefense" &&
      !i.system?.disabled &&
      !i.system?.destroyed &&
      /hardened\s*polyceramic/i.test(i.name ?? ""),
  );
}

/**
 * @param {Actor} starship
 * @param {RegExp} nameRe
 */
export function hasActiveDefenseNamed(starship, nameRe) {
  return (starship.items ?? []).some(
    (i) =>
      i.type === "shipDefense" &&
      !i.system?.disabled &&
      !i.system?.destroyed &&
      nameRe.test(i.name ?? ""),
  );
}

/**
 * Point Defense Lasers active?
 * @param {Actor} starship
 */
export function hasPointDefense(starship) {
  return hasActiveDefenseNamed(starship, /point\s*defense/i);
}

/**
 * Burst ECM Generator present?
 * @param {Actor} starship
 */
export function hasBurstEcm(starship) {
  return hasActiveDefenseNamed(starship, /burst\s*ecm/i);
}

/**
 * Grav Eddy Displacer present?
 * @param {Actor} starship
 */
export function hasGravEddy(starship) {
  return hasActiveDefenseNamed(starship, /grav\s*eddy/i);
}

/**
 * Pick a random disable-able weapon/fitting (not destroyed).
 * @param {Actor} starship
 * @returns {Item|null}
 */
export function randomDisableTarget(starship) {
  const candidates = disableTargetCandidates(starship);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Systems that Target Systems / System Damage can disable.
 * @param {Actor} starship
 * @returns {Item[]}
 */
export function disableTargetCandidates(starship) {
  return (starship.items ?? []).filter(
    (i) =>
      (i.type === "shipWeapon" || i.type === "shipFitting" || i.type === "shipDefense") &&
      !i.system?.destroyed,
  );
}
