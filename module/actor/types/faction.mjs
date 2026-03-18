/**
 * Faction-specific actor logic (prepareData).
 */
const HEALTH_TABLE = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 9, 6: 12, 7: 16, 8: 20 };

export function getHealth(level) {
  return level in HEALTH_TABLE ? HEALTH_TABLE[level] : 0;
}

/**
 * Run prepareData for faction (assets, health).
 * @param {import("../../entity.js").WwnActor} actor
 */
export function prepare(actor) {
  if (actor.type !== "faction") return;
  const data = actor.system;
  const assets = actor.items.filter((i) => i.type === "asset");
  const cunningAssets = assets.filter((i) => i.system.assetType === "cunning").sort(sortAssets);
  const forceAssets = assets.filter((i) => i.system.assetType === "force").sort(sortAssets);
  const wealthAssets = assets.filter((i) => i.system.assetType === "wealth").sort(sortAssets);
  data.cunningAssets = cunningAssets;
  data.forceAssets = forceAssets;
  data.wealthAssets = wealthAssets;
  data.health.max =
    getHealth(data.wealthRating) + getHealth(data.forceRating) + getHealth(data.cunningRating);
}

function sortAssets(a, b) {
  if (a.system.baseOfInfluence && !b.system.baseOfInfluence) return -1;
  if (!a.system.baseOfInfluence && b.system.baseOfInfluence) return 1;
  return a.name > b.name ? 1 : -1;
}
