/**
 * Item-local Active Effect target registry.
 *
 * Used when an item-embedded effect has transfer: false — changes apply to the
 * item itself (weapon/armor mods, magazine size, etc.), not the owning actor.
 *
 * Power buffs use transfer: true on the item and the actor AE registry
 * (ae-targets.mjs), not this item-local registry.
 *
 * valueType: "number" (spinner), "formula" (deterministic roll-data formula)
 */

/** Static groups keyed by item category. */
function staticGroups() {
  return {
    weapon: {
      label: "WWN.Effects.Groups.ItemWeapon",
      targets: {
        "system.bonusMod": {
          label: "WWN.Effects.Item.BonusMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "final",
          itemTypes: ["weapon"],
        },
        "system.damageMod": {
          label: "WWN.Effects.Item.DamageMod",
          modes: ["add", "upgrade"],
          valueType: "formula",
          phase: "final",
          itemTypes: ["weapon"],
        },
        "system.shock.damageMod": {
          label: "WWN.Effects.Item.ShockDamageMod",
          modes: ["add", "upgrade"],
          valueType: "formula",
          phase: "final",
          itemTypes: ["weapon"],
        },
        "system.shock.acMod": {
          label: "WWN.Effects.Item.ShockAcMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "final",
          itemTypes: ["weapon"],
        },
        "system.trauma.ratingMod": {
          label: "WWN.Effects.Item.TraumaRatingMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "final",
          itemTypes: ["weapon"],
          setting: "useTrauma",
        },
        "system.charges.maxMod": {
          label: "WWN.Effects.Item.ChargesMaxMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          itemTypes: ["weapon"],
        },
      },
    },
    armor: {
      label: "WWN.Effects.Groups.ItemArmor",
      targets: {
        "system.acMod": {
          label: "WWN.Effects.Item.AcMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          itemTypes: ["armor"],
        },
        "system.acRangedMod": {
          label: "WWN.Effects.Item.AcRangedMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          itemTypes: ["armor"],
          setting: "separateRangedAC",
        },
        "system.modMod": {
          label: "WWN.Effects.Item.ModMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          itemTypes: ["armor"],
        },
        "system.soakMod": {
          label: "WWN.Effects.Item.SoakMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          itemTypes: ["armor"],
        },
        "system.traumaTargetMod": {
          label: "WWN.Effects.Item.TraumaTargetMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          itemTypes: ["armor"],
          setting: "useTrauma",
        },
      },
    },
    gear: {
      label: "WWN.Effects.Groups.ItemGear",
      targets: {
        "system.charges.maxMod": {
          label: "WWN.Effects.Item.ChargesMaxMod",
          modes: ["add", "override"],
          valueType: "number",
          phase: "initial",
          itemTypes: ["item"],
        },
      },
    },
  };
}

/**
 * Build the complete grouped item-local AE registry.
 * @returns {Record<string, {label: string, targets: Record<string, object>}>}
 */
export function getItemAeTargetGroups() {
  return staticGroups();
}

/**
 * Flattened registry: data path -> target descriptor.
 * @returns {Record<string, object>}
 */
export function getItemAeTargets() {
  const flat = {};
  for (const group of Object.values(getItemAeTargetGroups())) {
    Object.assign(flat, group.targets);
  }
  return flat;
}

/**
 * Filtered groups for the AE editor dropdown on item-embedded effects.
 * @param {object} [options]
 * @param {string} [options.itemType]  Filter out targets not valid for this item type.
 * @returns {Record<string, {label: string, targets: Record<string, object>}>}
 */
export function getFilteredItemAeTargetGroups({ itemType } = {}) {
  const groups = getItemAeTargetGroups();
  const filtered = {};
  for (const [groupId, group] of Object.entries(groups)) {
    const targets = {};
    for (const [path, target] of Object.entries(group.targets)) {
      if (target.setting && !game.settings.get("wwn", target.setting)) continue;
      if (itemType && target.itemTypes && !target.itemTypes.includes(itemType)) continue;
      targets[path] = target;
    }
    if (Object.keys(targets).length) filtered[groupId] = { label: group.label, targets };
  }
  return filtered;
}

/** Localized label for a single item registry target. */
export function localizeItemAeTarget(target) {
  return game.i18n.format(target.label, target.labelData ?? {});
}
