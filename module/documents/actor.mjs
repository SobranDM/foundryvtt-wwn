/**
 * WWN Actor document. Data preparation lives in the TypeDataModels and
 * derivations/; this class owns cross-cutting actor behavior: damage
 * application (with module hooks), charge effects, favorites pruning,
 * NPC weapon auto-favoriting, level-up skill point grants, and new-PC seeding.
 */
import { computeLevelUpSkillGrant } from "../helpers/skill-points.mjs";
import { mergeWeaponFavorites } from "../helpers/favorites.mjs";
import { CREATABLE_ACTOR_TYPES, isNpc, isPc } from "../helpers/actor-types.mjs";
import { migrateActorData, applyEmbeddedItemMigration } from "../migration/transforms.mjs";

export class WwnActor extends Actor {
  /**
   * Migrate embedded items (art→power, etc.) and legacy system shapes before
   * schema validation. Actor types stay `character`/`monster` (pc/npc are
   * reverse aliases only — never remapped here).
   * @override
   */
  static migrateData(source, options) {
    source = super.migrateData(source, options);
    if (!source || typeof source !== "object") return source;

    // Corrupt / half-written embedded items break actor load entirely.
    if (Array.isArray(source.items)) {
      const before = source.items.length;
      source.items = source.items.filter(
        (i) => i && typeof i === "object" && i.name != null && i.type != null && i._id
      );
      if (source.items.length !== before) {
        console.warn(
          `WWN | Dropped ${before - source.items.length} invalid embedded item(s) on actor ${source.name ?? source._id}`
        );
      }
      source.items = source.items.map((i) => applyEmbeddedItemMigration(i));
    }

    // Shape-only migration for PCs/NPCs (preserves stored type).
    if (isPc(source) || isNpc(source)) {
      try {
        const result = migrateActorData(source);
        if (!result) return source;
        if (result.system != null) source.system = result.system;
        if (result.items) source.items = result.items;
        if (result.effects) source.effects = result.effects;
        if (result.img) source.img = result.img;
      } catch (err) {
        console.error(`WWN | Actor.migrateData failed for ${source.name ?? source._id}:`, err);
      }
    }

    return source;
  }

  /**
   * Hide reverse aliases (`pc` / `npc`) from the create dialog.
   * @override
   */
  static async createDialog(data = {}, createOptions = {}, dialogOptions = {}, renderOptions = {}) {
    const types = dialogOptions.types?.length ? dialogOptions.types : [...CREATABLE_ACTOR_TYPES];
    return super.createDialog(data, createOptions, { ...dialogOptions, types }, renderOptions);
  }

  /** @override */
  getRollData() {
    if (typeof this.system.getRollData === "function") {
      return this.system.getRollData();
    }
    return foundry.utils.deepClone(this.system);
  }

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (isPc(this)) {
      this.updateSource({ prototypeToken: { actorLink: true, disposition: 1 } });
    }
  }

  /** @inheritDoc */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if (allowed === false) return false;
    if (!isPc(this)) return;

    const newLevel = foundry.utils.getProperty(changed, "system.details.level");
    if (newLevel === undefined) return;

    const oldLevel = this.system.details?.level ?? 1;
    const { gained, perLevel } = computeLevelUpSkillGrant(this, oldLevel, newLevel);
    if (gained <= 0) return;

    const path = "system.skills.unspent";
    const base = foundry.utils.hasProperty(changed, path)
      ? foundry.utils.getProperty(changed, path)
      : (this.system.skills?.unspent ?? 0);
    foundry.utils.setProperty(changed, path, base + gained);
    options.wwnLevelUpSkillGrant = { newLevel, gained, perLevel };
  }

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    const grant = options.wwnLevelUpSkillGrant;
    if (!grant || userId !== game.user.id) return;
    this.#postLevelUpSkillGrant(grant);
  }

  async #postLevelUpSkillGrant({ newLevel, gained, perLevel }) {
    const { createCardMessage } = await import("../chat/chat-card.mjs");
    await createCardMessage({
      actor: this,
      title: game.i18n.localize("WWN.Skills.LevelUpGrant"),
      context: {
        body: `<p>${game.i18n.format("WWN.Skills.LevelUpGrantBody", {
          user: game.user.name,
          name: this.name,
          level: newLevel,
          gained,
          perLevel,
        })}</p>`,
      },
    });
  }

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (userId !== game.user.id) return;
    if (isPc(this) && options.wwnSkipSeeding !== true) this.#seedNewPc();
  }

  /** Seed core skills and the default currency set onto a brand-new PC. */
  async #seedNewPc() {
    const toCreate = [];

    if (!this.items.some((i) => i.type === "skill")) {
      for (const slug of CONFIG.WWN.coreSkills) {
        toCreate.push({
          type: "skill",
          name: game.i18n.localize(`WWN.Skills.${slug}`),
          system: { ownedLevel: -1, score: "int", skillDice: "2d6", secondary: false, slug },
        });
      }
    }

    if (!this.items.some((i) => i.type === "currency")) {
      const setKey = game.settings.get("wwn", "defaultCurrencySet") ?? "silver";
      const set = CONFIG.WWN.currencySets[setKey] ?? CONFIG.WWN.currencySets.silver;
      for (const c of set) {
        toCreate.push({
          type: "currency",
          name: game.i18n.localize(c.name),
          system: { multiplier: c.multiplier, perSlot: c.perSlot, carried: 0, banked: 0 },
        });
      }
    }

    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate, { wwnSeeding: true });
  }

  /** @inheritDoc */
  _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
    if (collection !== "items" || !isNpc(this) || userId !== game.user.id) return;

    const favorites = mergeWeaponFavorites(this.system.favorites, documents);
    if (favorites) this.update({ "system.favorites": favorites });
  }

  /** @inheritDoc */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
    // Prune deleted items from favorites
    if (collection !== "items" || userId !== game.user.id) return;
    const favorites = this.system.favorites ?? [];
    const pruned = favorites.filter((id) => !ids.includes(id));
    if (pruned.length !== favorites.length) {
      this.update({ "system.favorites": pruned });
    }
  }

  /* -------------------------------------------- */
  /*  Damage application + module hook surface     */
  /* -------------------------------------------- */

  /**
   * Apply damage (or healing, when amount < 0) to this actor's HP.
   *
   * Hook surface for wound-system modules:
   * - "wwn.preApplyDamage" (cancelable; ctx mutable)
   * - "wwn.applyDamage" (after HP update; ctx gains applied/excess/hpBefore/hpAfter)
   * - "wwn.actorZeroHp" (once, on the transition to 0 HP)
   *
   * @param {number} amount       Raw damage (positive) or healing (negative)
   * @param {number} [multiplier] Damage multiplier (0.5, 1, 2)
   * @param {object} [options]
   * @param {string} [options.source]   Description of the damage source
   * @param {boolean} [options.ignoreSoak]
   */
  async applyDamage(amount, multiplier = 1, { source = "", ignoreSoak = false } = {}) {
    let value = Math.floor(amount * multiplier);

    // Armor soak (CWN): flat reduction of incoming damage only
    let soaked = 0;
    if (value > 0 && !ignoreSoak) {
      const soak = this.system.combat?.soak ?? 0;
      soaked = Math.min(soak, value);
      value -= soaked;
    }

    const ctx = { amount: value, multiplier, soaked, source };
    if (Hooks.call("wwn.preApplyDamage", this, ctx) === false) return;
    value = ctx.amount;

    const hpBefore = this.system.hp.value;
    const hpAfter = Math.clamp(hpBefore - value, 0, this.system.hp.max);
    const excess = value > 0 ? Math.max(value - hpBefore, 0) : 0;

    await this.update({ "system.hp.value": hpAfter });

    Object.assign(ctx, { applied: hpBefore - hpAfter, excess, hpBefore, hpAfter });
    Hooks.callAll("wwn.applyDamage", this, ctx);
    if (hpAfter === 0 && hpBefore > 0) {
      Hooks.callAll("wwn.actorZeroHp", this, ctx);
    }
  }

  /* -------------------------------------------- */
  /*  Combat options                              */
  /* -------------------------------------------- */

  /** Apply the one-round Charge effect (+2 all attacks, -2 AC). */
  async applyChargeEffect() {
    const existing = this.effects.find((e) => e.getFlag("wwn", "charge"));
    if (existing) return;
    await this.createEmbeddedDocuments("ActiveEffect", [
      {
        name: game.i18n.localize("WWN.Combat.Charge"),
        img: "icons/svg/combat.svg",
        duration: { rounds: 1 },
        flags: { "wwn": { charge: true } },
        system: {
          changes: [
            { key: "system.combat.allAttack", type: "add", value: 2, phase: "final" },
            { key: "system.combat.ac.mod", type: "add", value: -2, phase: "initial" },
          ],
        },
      },
    ]);
  }

  /* -------------------------------------------- */
  /*  Convenience                                 */
  /* -------------------------------------------- */

  /** Is this actor's favorites list pointing at the given item? */
  isFavorite(itemId) {
    return (this.system.favorites ?? []).includes(itemId);
  }

  async toggleFavorite(itemId) {
    const favorites = [...(this.system.favorites ?? [])];
    const index = favorites.indexOf(itemId);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.push(itemId);
    return this.update({ "system.favorites": favorites });
  }
}
