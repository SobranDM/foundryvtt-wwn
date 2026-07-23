/**
 * Read captain / navigator focus bonuses from crewed PCs.
 */

/**
 * @param {Actor|null|undefined} actor
 * @returns {{
 *   commandPointsBonus: number,
 *   combatBonusHpPercent: number,
 *   spikeDrillAutoSucceedDiff: number,
 *   spikeDrillDoublePilot: boolean,
 *   spikeDriveLevelBonus: number,
 * }}
 */
export function starshipFocusBonusesFromActor(actor) {
  const empty = {
    commandPointsBonus: 0,
    combatBonusHpPercent: 0,
    spikeDrillAutoSucceedDiff: 0,
    spikeDrillDoublePilot: false,
    spikeDriveLevelBonus: 0,
  };
  if (!actor?.system?.starship) return empty;
  const s = actor.system.starship;
  return {
    commandPointsBonus: Number(s.commandPointsBonus) || 0,
    combatBonusHpPercent: Number(s.combatBonusHpPercent) || 0,
    spikeDrillAutoSucceedDiff: Number(s.spikeDrillAutoSucceedDiff) || 0,
    spikeDrillDoublePilot: !!s.spikeDrillDoublePilot && s.spikeDrillDoublePilot !== "false",
    spikeDriveLevelBonus: Number(s.spikeDriveLevelBonus) || 0,
  };
}

/**
 * Merge focus bonuses (sum numeric, OR booleans, max auto-succeed diff).
 * @param {...ReturnType<typeof starshipFocusBonusesFromActor>} parts
 */
export function mergeStarshipFocusBonuses(...parts) {
  const out = starshipFocusBonusesFromActor(null);
  for (const p of parts) {
    if (!p) continue;
    out.commandPointsBonus += Number(p.commandPointsBonus) || 0;
    out.combatBonusHpPercent = Math.max(out.combatBonusHpPercent, Number(p.combatBonusHpPercent) || 0);
    out.spikeDrillAutoSucceedDiff = Math.max(
      out.spikeDrillAutoSucceedDiff,
      Number(p.spikeDrillAutoSucceedDiff) || 0,
    );
    out.spikeDrillDoublePilot = out.spikeDrillDoublePilot || !!p.spikeDrillDoublePilot;
    out.spikeDriveLevelBonus += Number(p.spikeDriveLevelBonus) || 0;
  }
  return out;
}

/**
 * @param {Actor} starship
 * @param {string} stationKey
 * @returns {Promise<Actor|null>}
 */
export async function resolveStarshipStationActor(starship, stationKey) {
  const uuid = starship.system.stations?.[stationKey]?.actor;
  if (!uuid) return null;
  try {
    return await fromUuid(uuid);
  } catch {
    return null;
  }
}

/**
 * Resolve the captain station actor on a starship (if linked).
 * @param {Actor} starship
 * @returns {Promise<Actor|null>}
 */
export async function resolveStarshipCaptain(starship) {
  return resolveStarshipStationActor(starship, "captain");
}

/**
 * Combined focus bonuses from captain + bridge crew.
 * @param {Actor} starship
 */
export async function starshipFocusBonusesForShip(starship) {
  const captain = await resolveStarshipStationActor(starship, "captain");
  const bridge = await resolveStarshipStationActor(starship, "bridge");
  return mergeStarshipFocusBonuses(
    starshipFocusBonusesFromActor(captain),
    starshipFocusBonusesFromActor(bridge),
  );
}

/**
 * Effective NPC/PC command points for a starship including captain focus bonus.
 * @param {Actor} starship
 * @returns {Promise<number>}
 */
export async function effectiveStarshipCommandPoints(starship) {
  const base = Number(starship.system.npcCp) || 0;
  const bonuses = await starshipFocusBonusesForShip(starship);
  return base + bonuses.commandPointsBonus;
}
