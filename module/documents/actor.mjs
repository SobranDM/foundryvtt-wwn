/**
 * WWN Actor document. Data preparation lives in the TypeDataModels and
 * derivations/; this class owns cross-cutting actor behavior: damage
 * application (with module hooks), charge effects, favorites pruning,
 * NPC weapon auto-favoriting, level-up skill point grants, and new-PC seeding.
 */
import { computeLevelUpSkillGrant } from "../helpers/skill-points.mjs";
import { mergeWeaponFavorites } from "../helpers/favorites.mjs";
import { CREATABLE_ACTOR_TYPES, isNpc, isPc } from "../helpers/actor-types.mjs";
import { migrateActorData, migrateActorItems } from "../migration/transforms.mjs";
import { splitSoakDamage } from "../helpers/power-armor-damage.mjs";
import { getPrimarySkillData } from "../helpers/skill-set.mjs";
import { isDuplicateOfItemTransfer } from "../helpers/effect-transfer-dedup.mjs";
import { caseInsensitiveRollData } from "../helpers/roll-data.mjs";

export class WwnActor extends Actor {
  /**
   * Migrate embedded items (art→power, gear→ammo, etc.) and legacy system shapes
   * before schema validation. Actor types stay `character`/`monster` (pc/npc are
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
      // Includes known-name + weapon-linked gear→ammo (power armor, starships, etc.).
      source.items = migrateActorItems(source.items);
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
    const data = typeof this.system.getRollData === "function"
      ? this.system.getRollData()
      : foundry.utils.deepClone(this.system);
    return caseInsensitiveRollData(data);
  }

  /**
   * Foundry v14 yields both `this.effects` and item `transfer` effects.
   * Transferred copies also live on the actor (often in `_source.effects`);
   * applying both stacks add-mode changes (ability mods, HD).
   * Skip actor-side copies of item transfer effects; apply the item effects once.
   * Actor-owned clones (e.g. power on-use AEs) still apply.
   * @override
   * @yields {ActiveEffect}
   */
  *allApplicableEffects() {
    for (const effect of this.effects) {
      if (isDuplicateOfItemTransfer(this, effect)) continue;
      yield effect;
    }
    for (const item of this.items) {
      for (const effect of item.effects) {
        if (effect.transfer) yield effect;
      }
    }
  }

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (isPc(this)) {
      this.updateSource({ prototypeToken: { actorLink: true, disposition: 1 } });
      if (options.wwnSkipSeeding !== true) await this.#seedNewPcItems();
    }
    if (this.type === "project") {
      // Projects are placed as stationary structures/effects; link the token
      // so edits from a placed token's sheet write back to the world Actor
      // (an unlinked token would silently fork into a synthetic copy).
      this.updateSource({ prototypeToken: { actorLink: true } });
    }
    // Per-type default icons (mirrors WwnItem._preCreate).
    if (!data.img || data.img === Actor.DEFAULT_ICON) {
      const icon = CONFIG.WWN.defaultIcons[this.type];
      if (icon) this.updateSource({ img: icon });
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
    const esc = foundry.utils.escapeHTML;
    const body = game.i18n.format("WWN.Skills.LevelUpGrantBody", {
      user: esc(game.user.name),
      name: esc(this.name),
      level: newLevel,
      gained,
      perLevel,
    });
    await createCardMessage({
      actor: this,
      title: game.i18n.localize("WWN.Skills.LevelUpGrant"),
      bodyTemplate: "systems/wwn/templates/chat/notice-body.hbs",
      context: { bodyHtml: `<p>${body}</p>` },
    });
  }

  /**
   * Build starter skills + currency for a brand-new PC and merge them directly
   * into the creation payload via updateSource (called from _preCreate).
   *
   * This intentionally does NOT create the items via a post-creation
   * createEmbeddedDocuments call from _onCreate. That approach seeded exactly
   * once under normal conditions, but _onCreate's `userId === game.user.id`
   * guard only checks "did my logged-in account initiate this" — if the same
   * account is connected from more than one client (two browser tabs/windows
   * open to the same world, a common dev/GM habit), every such client passes
   * that guard independently and each one runs the post-create seeding, so a
   * single actor creation could get its starter skills and currency doubled
   * (observed: 2x Copper/Silver/Gold instead of 1x). Building the items into
   * the creation payload in _preCreate avoids the whole category of bug:
   * _preCreate only ever runs on the single client that actually initiates
   * the `Actor.create()` call, so the actor and its starter items are written
   * to the database together as one atomic create — every other connected
   * client (including a duplicate session of the same account) just receives
   * the already-complete document and never runs this method at all.
   */
  async #seedNewPcItems() {
    const toCreate = [];

    if (!this.items.some((i) => i.type === "skill")) {
      const primary = await getPrimarySkillData();
      for (const data of primary) {
        toCreate.push(foundry.utils.deepClone(data));
      }
    }

    if (!this.items.some((i) => i.type === "currency")) {
      const setKey = game.settings.get("wwn", "defaultCurrencySet") ?? "silver";
      const set = CONFIG.WWN.currencySets[setKey] ?? CONFIG.WWN.currencySets.silver;
      // Items built here are merged straight into the creation payload via
      // updateSource (see below), which bypasses Item#_preCreate — so its
      // per-type default-icon fallback never runs for these. Set img
      // explicitly, same source and fallback as the legacy migration
      // transform (module/migration/transforms.mjs, WWN_CURRENCIES seeding).
      const icon = CONFIG.WWN?.defaultIcons?.currency ?? "icons/svg/coins.svg";
      for (const c of set) {
        toCreate.push({
          type: "currency",
          name: game.i18n.localize(c.name),
          img: icon,
          system: { multiplier: c.multiplier, perSlot: c.perSlot, carried: 0, banked: 0 },
        });
      }
    }

    if (!toCreate.length) return;
    const itemsData = toCreate.map((d) => ({ ...foundry.utils.deepClone(d), _id: foundry.utils.randomID() }));
    this.updateSource({ items: itemsData });
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
    if (this.type === "powerArmor") {
      return this.#applyPowerArmorDamage(amount, multiplier, { source, ignoreSoak });
    }

    let value = Math.floor(amount * multiplier);

    // Starship: Star Captain combat bonus HP absorbs damage first
    if (this.type === "starship" && value > 0) {
      const { applyDamageThroughCombatBonus, remainingCombatBonusHp } = await import(
        "../helpers/starship-combat-hp.mjs"
      );
      const bonus = remainingCombatBonusHp(this);
      const split = applyDamageThroughCombatBonus(value, bonus);
      if (split.bonusTaken > 0 || split.bonusRemaining !== bonus) {
        if (split.bonusRemaining > 0) await this.setFlag("wwn", "combatBonusHp", split.bonusRemaining);
        else await this.unsetFlag("wwn", "combatBonusHp");
      }
      value = split.hullDamage;
    }

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

  /**
   * Modular power armor: deplete suit Soak pool, then apply remainder to linked pilot HP.
   * @private
   */
  async #applyPowerArmorDamage(amount, multiplier = 1, { source = "", ignoreSoak = false } = {}) {
    let value = Math.floor(amount * multiplier);

    let soakTaken = 0;
    let soakRemaining = this.system.soak?.value ?? 0;
    if (value > 0 && !ignoreSoak) {
      const split = splitSoakDamage(value, soakRemaining);
      soakTaken = split.soakTaken;
      soakRemaining = split.soakRemaining;
      value = split.overflow;
    } else if (value < 0) {
      // Healing: apply to pilot HP when linked; otherwise no-op on suit.
      value = value;
    }

    const ctx = {
      amount: value,
      multiplier,
      soaked: soakTaken,
      source,
      powerArmor: true,
    };
    if (Hooks.call("wwn.preApplyDamage", this, ctx) === false) return;
    value = ctx.amount;

    if (soakTaken > 0) {
      await this.update({ "system.soak.value": soakRemaining });
    }

    const emptySuit = !!this.system.derived?.emptySuit?.active;

    // Black Ofuda empty VI suit: overflow damages suit viHp, not the linked pilot.
    if (emptySuit) {
      const hpBefore = this.system.viHp?.value ?? 0;
      const hpMax = this.system.viHp?.max ?? this.system.derived.emptySuit.hp ?? 15;
      let hpAfter = hpBefore;
      if (value !== 0) {
        if (value < 0) hpAfter = Math.min(hpMax, hpBefore - value);
        else hpAfter = Math.max(0, hpBefore - value);
        await this.update({ "system.viHp.value": hpAfter });
      }
      Object.assign(ctx, {
        applied: hpBefore - hpAfter,
        excess: 0,
        hpBefore,
        hpAfter,
        soakRemaining,
        emptySuit: true,
      });
      Hooks.callAll("wwn.applyDamage", this, ctx);
      if (hpAfter === 0 && hpBefore > 0) {
        Hooks.callAll("wwn.actorZeroHp", this, ctx);
      }
      return;
    }

    const pilotUuid = this.system.pilot?.actor;
    const pilot = pilotUuid ? await fromUuid(pilotUuid) : null;

    if (!pilot) {
      Object.assign(ctx, {
        applied: 0,
        excess: Math.max(value, 0),
        hpBefore: 0,
        hpAfter: 0,
        soakRemaining,
      });
      Hooks.callAll("wwn.applyDamage", this, ctx);
      if (value > 0) {
        ui.notifications?.warn?.(game.i18n.localize("WWN.PowerArmor.DamageNoPilot"));
      }
      return;
    }

    if (value === 0) {
      Object.assign(ctx, {
        applied: 0,
        excess: 0,
        hpBefore: pilot.system.hp.value,
        hpAfter: pilot.system.hp.value,
        soakRemaining,
      });
      Hooks.callAll("wwn.applyDamage", this, ctx);
      return;
    }

    const hpBefore = pilot.system.hp?.value ?? 0;
    // Healing (negative) or overflow damage → pilot, ignoring CWN flat soak / personal armor.
    await pilot.applyDamage(value, 1, { source, ignoreSoak: true });
    const hpAfter = pilot.system.hp?.value ?? hpBefore;
    Object.assign(ctx, {
      applied: hpBefore - hpAfter,
      excess: 0,
      hpBefore,
      hpAfter,
      soakRemaining,
      pilotUuid,
    });
    Hooks.callAll("wwn.applyDamage", this, ctx);

    // Backseat Driver: ≥15 after soak split (overflow to pilot), not pre-soak total.
    try {
      const { checkBackseatIncap } = await import("../helpers/power-armor-effects.mjs");
      await checkBackseatIncap(this, value);
    } catch (err) {
      console.warn("WWN | Backseat Driver check failed", err);
    }

    if (hpAfter === 0 && hpBefore > 0) {
      Hooks.callAll("wwn.actorZeroHp", pilot, ctx);
      if (this.system.derived?.capabilities?.traumaStabilizer) {
        try {
          if (!pilot.getFlag("wwn", "stabilized")) {
            await pilot.setFlag("wwn", "stabilized", true);
            ui.notifications?.info?.(game.i18n.localize("WWN.PowerArmor.TraumaStabilized"));
          }
        } catch (err) {
          console.warn("WWN | Trauma Stabilizer flag failed", err);
        }
      }
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
