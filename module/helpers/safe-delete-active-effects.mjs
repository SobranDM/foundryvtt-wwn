/**
 * Delete actor-owned ActiveEffects by id without throwing when an id is already
 * gone (common after item deletes remove transferred effects, or ForcedReplace races).
 * @param {Actor} actor
 * @param {string[]} ids
 * @returns {Promise<string[]>} ids successfully deleted
 */
export async function safeDeleteActorActiveEffects(actor, ids) {
  if (!actor || !ids?.length) return [];
  const deleted = [];
  for (const id of ids) {
    if (!id) continue;
    const inSource = (actor._source?.effects ?? []).some((e) => e._id === id);
    if (!inSource) continue;
    if (!actor.effects?.get?.(id) && !actor.effects?.has?.(id)) continue;
    try {
      await actor.deleteEmbeddedDocuments("ActiveEffect", [id]);
      deleted.push(id);
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (/does not exist/i.test(msg)) {
        console.warn(`WWN | ActiveEffect ${id} already absent on ${actor.name}; skipping.`);
        continue;
      }
      throw err;
    }
  }
  return deleted;
}
