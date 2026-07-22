import { WwnDice } from "../dice/dice.mjs";
import { createCardMessage } from "../chat/chat-card.mjs";
import { pickCommitmentOption } from "../helpers/commitment-choice.mjs";
import {
  applyStrainToActor,
  parseStrainField,
  resolveStrainAmount,
} from "../helpers/strain.mjs";
import { spendWeaponCounter, tracksWeaponCounter } from "../helpers/weapon-counter.mjs";
import { expendGear } from "../helpers/ammo.mjs";
import { getActorSpellSlotMode } from "../derivations/resource-pools.mjs";
import { WWN } from "../config/index.mjs";
import {
  applySceneDayPowerEffects,
  syncPowerTransferEffects,
} from "../helpers/power-effects.mjs";
import { AssetItemActions } from "../item/asset-actions.mjs";
import { migrateItemData } from "../migration/transforms.mjs";

/**
 * WWN Item document: roll dispatch and power usage flow.
 */
export class WwnItem extends Item {
  /**
   * Remap legacy item types (`art` / `spell` / `ability`) before schema validation.
   * @override
   */
  static migrateData(source, options) {
    source = super.migrateData(source, options);
    if (!source || typeof source !== "object") return source;
    if (!["art", "spell", "ability"].includes(source.type)) return source;
    try {
      const result = migrateItemData(source);
      if (!result) return source;
      Object.assign(source, result);
      source.flags ??= {};
      source.flags.wwn ??= {};
      source.flags.wwn.pendingTypeMigration = true;
    } catch (err) {
      console.error(`WWN | Item.migrateData failed for ${source.name ?? source._id}:`, err);
    }
    return source;
  }

  /** @type {Set<string>} */
  _completedItemAePhases = new Set();

  /** @inheritDoc */
  prepareData() {
    this._completedItemAePhases = new Set();
    super.prepareData();
  }

  /**
   * Apply non-transfer embedded Active Effects to this item.
   * @param {string} phase  "initial" | "final"
   */
  applyItemActiveEffects(phase) {
    const ActiveEffect = foundry.documents.ActiveEffect.implementation;
    if (typeof phase !== "string") return;
    if (this._completedItemAePhases.has(phase)) return;
    this._completedItemAePhases.add(phase);

    const changes = [];
    for (const effect of this.effects) {
      if (effect.transfer || !effect.active) continue;
      for (const change of effect.system.changes) {
        if (!change.key || change.phase !== phase) continue;
        const copy = foundry.utils.deepClone(change);
        copy.effect = effect;
        changes.push(copy);
      }
    }
    changes.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    ActiveEffect._shimChanges?.(changes);

    const replacementData = this.getRollData?.() ?? {};
    for (const change of changes) {
      ActiveEffect.applyChange(this, change, { replacementData });
    }
  }

  /** @inheritDoc */
  prepareEmbeddedDocuments() {
    super.prepareEmbeddedDocuments();
    this.applyItemActiveEffects("initial");
  }

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    // Per-type default icons
    if (!data.img || data.img === Item.DEFAULT_ICON) {
      const icon = CONFIG.WWN.defaultIcons[this.type];
      if (icon) this.updateSource({ img: icon });
    }
  }

  /* -------------------------------------------- */
  /*  Roll dispatch                               */
  /* -------------------------------------------- */

  /**
   * Roll this item: weapons attack, powers activate, skills roll,
   * gear rolls its formula, anything else posts a description card.
   */
  async roll({ skipDialog = false } = {}) {
    const actor = this.actor;
    if (!actor) return;
    switch (this.type) {
      case "weapon": {
        if (tracksWeaponCounter(actor)) await spendWeaponCounter(this);
        return WwnDice.rollAttack(actor, this, { skipDialog });
      }
      case "power":
        return this.usePower({ skipDialog });
      case "skill":
        return WwnDice.rollSkill(actor, this, { skipDialog });
      case "item": {
        if (!(await expendGear(this))) return;
        if (this.system.roll) {
          return WwnDice.rollFormula(actor, this.system.roll, { title: this.name, img: this.img });
        }
        return this.show();
      }
      case "asset":
        return this.rollAsset(skipDialog);
      default:
        return this.show();
    }
  }

  /** Post a description card to chat. */
  async show() {
    return createCardMessage({
      actor: this.actor,
      title: this.name,
      img: this.img,
      bodyTemplate: "systems/wwn/templates/chat/item-card.hbs",
      context: {
        description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          this.system.description ?? "",
          { relativeTo: this, secrets: false }
        ),
      },
    });
  }

  /* -------------------------------------------- */
  /*  Power usage                                 */
  /* -------------------------------------------- */

  /**
   * Use a power: verify pool capacity, spend resource + strain, post the
   * activation card, and make any rolls.
   */
  async usePower({ skipDialog = false } = {}) {
    if (this.type !== "power") return;
    const actor = this.actor;
    const system = this.system;
    const usesShared = system.usesSharedPool;
    const options = system.effectiveCommitmentOptions ?? [];

    /* ---- Prepared spell check ---- */
    if (system.subType === "spell" && !system.prepared) {
      return ui.notifications.warn(
        game.i18n.format("WWN.Power.NotPrepared", { name: this.name })
      );
    }

    /* ---- Use-frequency check ---- */
    if ((system.internalResource?.max ?? 0) > 0) {
      if ((system.internalResource.value ?? 0) >= system.internalResource.max) {
        return ui.notifications.warn(
          game.i18n.format("WWN.Power.UseLimitReached", { name: this.name })
        );
      }
    }

    /* ---- Shared pool commitment choice ---- */
    let chosenOption = null;
    if (usesShared && options.length) {
      chosenOption = await pickCommitmentOption(this, { options, skipDialog });
      if (!chosenOption) return;

      const pool = this.#findPool();
      if (pool && pool.value + chosenOption.cost > pool.max) {
        return ui.notifications.warn(
          game.i18n.format("WWN.Power.PoolEmpty", { name: pool.name })
        );
      }
    }

    /* ---- Caster strain (automatic) ---- */
    const userStrainParsed = parseStrainField(system.userStrain);
    const strainSpend = await resolveStrainAmount(userStrainParsed, {
      title: game.i18n.format("WWN.Power.StrainChoiceTitle", { name: this.name }),
      hintKey: "WWN.Power.StrainChoiceHint",
      labelKey: "WWN.Power.UserStrain",
    });
    if (strainSpend === null) return;
    if (strainSpend > 0 && !(await applyStrainToActor(actor, strainSpend))) return;

    const targetStrainParsed = parseStrainField(system.targetStrain);
    const hasTargetStrain = targetStrainParsed.kind !== "none";
    const targetStrainLabel = String(system.targetStrain ?? "").trim() || null;

    /* ---- Spend ---- */
    const updates = {};
    if ((system.internalResource?.max ?? 0) > 0) {
      updates["system.internalResource.value"] = (system.internalResource.value ?? 0) + 1;
    }
    if (usesShared && chosenOption) {
      const key = chosenOption.length;
      updates[`system.poolCommitted.${key}`] =
        (system.poolCommitted?.[key] ?? 0) + chosenOption.cost;
      if (chosenOption.length === "active") updates["system.isActive"] = true;
    }
    if (Object.keys(updates).length) await this.update(updates);

    const chosenLength = chosenOption?.length ?? null;
    const hasEffects = this.effects.size > 0;
    let hasApplyEffects = false;
    let durationScopeLabel = null;

    if (chosenLength === "active") {
      await syncPowerTransferEffects(this);
    } else if ((chosenLength === "scene" || chosenLength === "day") && hasEffects) {
      durationScopeLabel = game.i18n.localize(`WWN.Commitment.${chosenLength}`);
      if (system.effectApplication === "self") {
        const { applied, skipped } = await applySceneDayPowerEffects(this, actor, {
          durationScope: chosenLength,
        });
        if (applied > 0) {
          ui.notifications.info(
            game.i18n.format("WWN.Power.EffectsApplied", { count: applied, name: this.name })
          );
        } else if (skipped > 0) {
          ui.notifications.warn(game.i18n.localize("WWN.Power.EffectsAlreadyApplied"));
        }
      } else {
        hasApplyEffects = true;
      }
    }

    const commitmentLabel = chosenOption
      ? game.i18n.format("WWN.Power.CommitmentOption", {
          cost: chosenOption.cost,
          length: game.i18n.localize(`WWN.Commitment.${chosenOption.length}`),
        })
      : null;

    /* ---- Card + rolls ---- */
    await createCardMessage({
      actor,
      title: game.i18n.format("WWN.Power.UseTitle", { name: this.name }),
      subtitle: system.displayTypeName,
      img: this.img,
      bodyTemplate: "systems/wwn/templates/chat/power-card.hbs",
      context: {
        description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          system.description ?? "",
          { relativeTo: this, secrets: false }
        ),
        cost: chosenOption?.cost ?? null,
        resourceName: system.resourceName,
        commitment: commitmentLabel,
        strainSpend: strainSpend > 0 ? strainSpend : null,
        hasTargetStrain,
        targetStrainLabel: hasTargetStrain ? targetStrainLabel : null,
        save: system.activation.save || null,
        hasRoll: !!system.activation.roll,
        hasDamage: !!system.damageRoll,
        healing: !!system.healing,
        hasApplyEffects,
        durationScopeLabel,
      },
      flags: {
        itemUuid: this.uuid,
        targetStrain: hasTargetStrain ? targetStrainLabel : null,
        durationScope: hasApplyEffects ? chosenLength : null,
        hasApplyEffects,
      },
    });

    if (system.activation.roll) {
      await WwnDice.rollPowerActivation(actor, this);
    }
    return this;
  }

  /** Roll a power's damageRoll (kind damage — Godbound-eligible). */
  async rollPowerDamage() {
    if (this.type !== "power" || !this.system.damageRoll) return;
    return WwnDice.rollDamage(this.actor, this.system.damageRoll, {
      title: game.i18n.format(
        this.system.healing ? "WWN.Power.HealingTitle" : "WWN.Power.DamageTitle",
        { name: this.name }
      ),
      img: this.img,
      defaultHealing: !!this.system.healing,
    });
  }

  /** Activate a power with an `active` commitment tier, spending pool resources. */
  async activatePower({ skipDialog = false } = {}) {
    if (this.type !== "power" || this.system.isActive) return;
    const actor = this.actor;
    if (!actor) return;
    const system = this.system;
    const options = (system.effectiveCommitmentOptions ?? []).filter(
      (o) => o.cost > 0 && o.length === "active"
    );
    if (!options.length) return;

    const chosenOption = await pickCommitmentOption(this, { options, skipDialog });
    if (!chosenOption) return;

    const pool = this.#findPool();
    if (pool && pool.value + chosenOption.cost > pool.max) {
      return ui.notifications.warn(
        game.i18n.format("WWN.Power.PoolEmpty", { name: pool.name })
      );
    }

    await this.update({
      "system.isActive": true,
      "system.poolCommitted.active": (system.poolCommitted?.active ?? 0) + chosenOption.cost,
    });
    await syncPowerTransferEffects(this);
    return this;
  }

  /** Deactivate a power with `active` commitment, reclaiming its spend. */
  async deactivatePower() {
    if (this.type !== "power" || !this.system.isActive) return;
    const updates = { "system.isActive": false };
    if ((this.system.poolCommitted?.active ?? 0) > 0) {
      updates["system.poolCommitted.active"] = 0;
    }
    await this.update(updates);
    await syncPowerTransferEffects(this);
    return this;
  }

  /** Find this power's derived pool on the owning actor. */
  #findPool() {
    const pools = this.actor?.system.resourcePools ?? [];
    const system = this.system;
    if (system.subType === "spell") {
      if (getActorSpellSlotMode(this.actor) === "leveled") {
        return pools.find(
          (p) => p.name === WWN.SPELL_SLOTS_POOL_NAME && p.level === system.level
        );
      }
      const spellPool = pools.find(
        (p) => p.name === WWN.SPELL_SLOTS_POOL_NAME && p.level == null
      );
      if (spellPool) return spellPool;
    }
    return pools.find((p) => p.name === system.resourceName);
  }

  /** HTML tags for item summaries on actor sheets. */
  getTags() {
    const formatTag = (tag, icon) => {
      if (!tag) return "";
      const fa = icon ? `<i class="fas ${icon}"></i> ` : "";
      return `<li class='tag'>${fa}${tag}</li>`;
    };
    const data = this.system;
    switch (this.type) {
      case "weapon": {
        let wTags = formatTag(data.damage, "fa-tint");
        (data.tags ?? []).forEach((t) => {
          wTags += formatTag(typeof t === "string" ? t : t.value);
        });
        wTags += formatTag(CONFIG.WWN.saves?.[data.save], "fa-skull");
        if (data.missile) {
          wTags += formatTag(
            `${data.range?.short ?? 0}/${data.range?.long ?? 0}`,
            "fa-bullseye"
          );
        }
        return wTags;
      }
      case "armor":
        return `${formatTag(CONFIG.WWN.armor?.[data.type], "fa-tshirt")}`;
      case "power": {
        if (data.subType === "spell") {
          let sTags = `${formatTag(data.source)}${formatTag(data.activation?.range)}${formatTag(data.activation?.duration)}${formatTag(data.activation?.roll)}`;
          if (data.activation?.save) {
            sTags += formatTag(CONFIG.WWN.saves?.[data.activation.save], "fa-skull");
          }
          return sTags;
        }
        if (data.subType === "art") {
          let roll = data.activation?.roll ?? "";
          return `${formatTag(data.source)}${formatTag(roll)}`;
        }
        return formatTag(data.source);
      }
      default:
        return "";
    }
  }
}

/* Mix faction asset actions onto the item prototype */
for (const name of Object.getOwnPropertyNames(AssetItemActions.prototype)) {
  if (name === "constructor") continue;
  Object.defineProperty(
    WwnItem.prototype,
    name,
    Object.getOwnPropertyDescriptor(AssetItemActions.prototype, name)
  );
}
