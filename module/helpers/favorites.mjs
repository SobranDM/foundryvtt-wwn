/** Append weapon item ids to an actor favorites list when missing. */

export function mergeWeaponFavorites(favorites, items) {
  const weaponIds = [];
  for (const item of items ?? []) {
    if (item.type !== "weapon") continue;
    const id = item.id ?? item._id;
    if (id) weaponIds.push(id);
  }
  if (!weaponIds.length) return null;

  const next = [...(favorites ?? [])];
  let changed = false;
  for (const id of weaponIds) {
    if (!next.includes(id)) {
      next.push(id);
      changed = true;
    }
  }
  return changed ? next : null;
}
