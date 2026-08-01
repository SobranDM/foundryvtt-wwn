/**
 * Resolve a weapon's linked skill on the pilot (skills live on the pilot, not the suit).
 * Pure helper — safe for Node unit tests.
 *
 * @param {Actor|null} pilot
 * @param {Item|object} weapon
 * @returns {Item|null}
 */
export function resolvePilotWeaponSkill(pilot, weapon) {
  if (!pilot || !weapon) return null;
  const sys = weapon.system ?? {};
  if (sys.skillId) {
    const byId = pilot.items.get?.(sys.skillId);
    if (byId?.type === "skill") return byId;
  }
  let name = "";
  if (typeof sys.skillFallback === "string" && sys.skillFallback) {
    name = sys.skillFallback;
  } else if (typeof sys.linkedSkill === "string" && sys.linkedSkill) {
    name = sys.linkedSkill;
  } else if (sys.linkedSkill?.name) {
    name = sys.linkedSkill.name;
  }
  if (!name) return null;
  return pilot.items.find(
    (i) => i.type === "skill" && i.name.toLowerCase() === name.toLowerCase(),
  ) ?? null;
}
