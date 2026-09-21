/**
 * `fromUuidSync`, guarded against both a target that no longer resolves
 * (deleted actor/item -- returns null rather than throwing) and running
 * before `fromUuidSync` itself exists yet (early world-load ordering, e.g.
 * a Party/PowerArmor actor's own `prepareDerivedData` running before the
 * Actors collection is fully populated) -- a throw there would fail that
 * actor's construction and can take the whole Actors collection down with
 * it. Shared by every "this UUID reference might be stale" resolution spot
 * (Party roster members, power armor pilot).
 * @param {string} uuid
 * @returns {any|null}
 */
export function safeFromUuidSync(uuid) {
  try {
    return typeof fromUuidSync === "function" ? fromUuidSync(uuid) : null;
  } catch {
    return null;
  }
}
