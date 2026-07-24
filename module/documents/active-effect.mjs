/**
 * WWN ActiveEffect implementation.
 *
 * Extends core change application so string values can be full deterministic
 * formulas (e.g. "@item.ownedLevel - 1" for Polymath's skill floor), not just
 * single "@" references. Core already resolves "@" refs via replacementData;
 * we additionally evaluate simple arithmetic and expose "@item" data for
 * effects transferred from items.
 */
import { BOOLEAN_COMBAT_AE_KEYS, coerceAeBoolean } from "../helpers/combat-ae-flags.mjs";

export class WwnActiveEffect extends foundry.documents.ActiveEffect {
  /**
   * Suppress transfer effects on unequipped weapons/armor (and similar).
   * @override
   */
  get isSuppressed() {
    if (super.isSuppressed) return true;
    const item = this.parent;
    if (item?.documentName !== "Item") return false;
    if (!this.transfer) return false;
    if (["weapon", "armor"].includes(item.type)) {
      return !item.system?.equipped;
    }
    // Armor fittings: off when disabled, depowered, or over-budget (inert).
    if (item.type === "armorFitting") {
      if (item.system?.disabled) return true;
      const actor = item.parent;
      if (actor?.type === "powerArmor") {
        if (!actor.system?.powered || actor.system?.overBudget) return true;
      }
    }
    return false;
  }

  /** @override */
  get isExpiryTrackable() {
    const scope = this.getFlag("wwn", "durationScope");
    if (scope === "scene" || scope === "day") return false;
    const parent = this.parent;
    if (parent?.documentName === "Item" && parent.type === "power") return false;
    return super.isExpiryTrackable;
  }

  /** @override */
  get isTemporary() {
    const scope = this.getFlag("wwn", "durationScope");
    if (scope === "scene" || scope === "day") return true;
    return super.isTemporary;
  }

  /** @override */
  _prepareDuration(duration, context) {
    const scope = this.getFlag("wwn", "durationScope");
    if (scope === "scene" || scope === "day") {
      duration ??= this.duration;
      const label = game.i18n.localize(`WWN.Commitment.${scope}`);
      return Object.assign(duration, {
        expired: false,
        remaining: Infinity,
        secondsRemaining: Infinity,
        label,
      });
    }
    return super._prepareDuration(duration, context);
  }

  /** @override */
  static _applyChangeUnguided(targetDoc, change, changes, options = {}) {
    if (typeof change.value === "string" && change.value.includes("@")) {
      const replacementData = { ...(options.replacementData ?? {}) };
      const parentItem = change.effect?.parent;
      if (parentItem?.documentName === "Item") {
        replacementData.item = parentItem.getRollData?.() ?? parentItem.system;
      }
      const originUuid = change.effect?.origin;
      if (originUuid && !replacementData.item) {
        try {
          const originItem = foundry.utils.fromUuidSync(originUuid);
          if (originItem?.documentName === "Item") {
            replacementData.item = originItem.getRollData?.() ?? originItem.system;
          }
        } catch (_err) {
          // Origin may be unresolved; leave replacementData unchanged.
        }
      }
      try {
        const replaced = foundry.dice.Roll.replaceFormulaData(change.value, replacementData, { missing: "0" });
        const evaluated = foundry.dice.Roll.safeEval(replaced);
        if (Number.isFinite(evaluated)) {
          change = { ...change, value: evaluated };
        }
      } catch (err) {
        // Leave the raw value; core will warn if it cannot resolve it.
      }
    }

    // Ephemeral boolean combat/starship flags: Foundry's unguided !!raw makes
    // "false" truthy. Coerce before apply when the key or current value is boolean.
    const current = foundry.utils.getProperty(targetDoc, change.key);
    const needsBool =
      BOOLEAN_COMBAT_AE_KEYS.has(change.key) || typeof current === "boolean";
    if (needsBool && change.type === "override") {
      change = { ...change, value: coerceAeBoolean(change.value) };
    }

    return super._applyChangeUnguided(targetDoc, change, changes, options);
  }
}
