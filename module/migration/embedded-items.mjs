/** Legacy item types that require recreate / replace. */
const LEGACY_ITEM_TYPES = new Set(["art", "spell", "ability"]);

/**
 * Whether embedded item sources differ enough to require clear+recreate.
 * Compares type, legacy type presence, and system JSON (not only type).
 *
 * @param {object[]} before
 * @param {object[]} after
 * @returns {boolean}
 */
export function embeddedItemsNeedReplace(before, after) {
  if ((before?.length ?? 0) !== (after?.length ?? 0)) return true;
  for (let i = 0; i < after.length; i++) {
    const a = before[i];
    const b = after[i];
    if (!a || !b) return true;
    if (a.type !== b.type) return true;
    if (LEGACY_ITEM_TYPES.has(a.type) || LEGACY_ITEM_TYPES.has(b.type)) return true;
    if (JSON.stringify(a.system ?? {}) !== JSON.stringify(b.system ?? {})) return true;
  }
  return before.some((i) => LEGACY_ITEM_TYPES.has(i.type));
}
