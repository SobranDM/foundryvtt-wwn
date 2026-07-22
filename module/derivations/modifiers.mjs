/**
 * Attribute modifier derivation (WWN or B/X table per setting).
 */

function valueFromTable(table, val) {
  let output = 0;
  for (let i = 0; i <= val; i++) {
    if (table[i] !== undefined) output = table[i];
  }
  return output;
}

/**
 * Derive `mod` for each ability from its score plus its AE-adjustable baseMod.
 * @param {object} abilities  The pc system.abilities object (mutated)
 */
export function deriveAbilityMods(abilities) {
  const tableKey = game.settings.get("wwn", "attributeModType") ?? "wwn";
  const table = CONFIG.WWN.modifierTables[tableKey] ?? CONFIG.WWN.modifierTables.wwn;
  for (const ability of Object.values(abilities)) {
    ability.mod = valueFromTable(table, ability.value) + (ability.baseMod ?? 0);
  }
}
