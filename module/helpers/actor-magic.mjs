/**
 * Whether an actor should show the Magic/Powers sheet tab.
 * Driven by owned powers (spell/art) or a Spell Slots classEdge — not a Tweaks flag.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function actorHasMagic(actor) {
  if (!actor?.items) return false;
  const spellSlotsName = CONFIG.WWN?.SPELL_SLOTS_POOL_NAME ?? "Spell Slots";
  return actor.items.some((item) => {
    if (item.type === "power") {
      const sub = item.system?.subType;
      return sub === "spell" || sub === "art";
    }
    if (item.type === "classEdge") {
      const grantName = item.system?.poolGrant?.name ?? "";
      return grantName === spellSlotsName || /spell/i.test(grantName);
    }
    // Legacy item types during partial migration
    return item.type === "spell" || item.type === "art";
  });
}
