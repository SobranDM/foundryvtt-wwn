import { RollParts } from "./roll-parts.mjs";
import { WwnRoll, WwnAttackRoll, WwnSkillRoll, WwnDamageRoll } from "./rolls.mjs";
import { showWwnDialog, rollButton, cancelButton } from "../applications/wwn-dialog.mjs";
import { createRollMessage, createCardMessage } from "../chat/chat-card.mjs";
import { hitDiceRollFormula } from "../derivations/hit-dice.mjs";
import { getFocusSkillDiceBonus } from "../helpers/focus-skill-dice.mjs";
import { spendAttackAmmo } from "../helpers/ammo.mjs";
import { isPc, isNpc } from "../helpers/actor-types.mjs";

/**
 * WwnDice: the roll pipeline.
 *
 * Every roll flows through: assemble (pure) -> prompt (dialog factory,
 * optional) -> evaluate (typed Roll) -> consume -> message (chat factory).
 * Roll kinds are explicit; Godbound conversion only ever touches
 * kind "damage" rolls.
 */
export class WwnDice {
  /* -------------------------------------------- */
  /*  Prompt step                                 */
  /* -------------------------------------------- */

  /**
   * Standard situational-modifier prompt.
   * @returns {Promise<{modifier: number}|null>} null = cancelled
   */
  static async promptModifier({ title, skipDialog = false } = {}) {
    if (skipDialog) return { modifier: 0 };
    const result = await showWwnDialog({
      modifier: "roll-options",
      title,
      template: "systems/wwn/templates/dialog/roll-options.hbs",
      context: {},
      buttons: [rollButton(), cancelButton()],
    });
    if (!result || result === "cancel") return null;
    return { modifier: Number(result.modifier) || 0 };
  }

  /* -------------------------------------------- */
  /*  Attribute check (roll-under)                */
  /* -------------------------------------------- */

  static async rollCheck(actor, abilityKey, { skipDialog = false } = {}) {
    const ability = actor.system.abilities?.[abilityKey];
    if (!ability) return;
    const label = game.i18n.localize(CONFIG.WWN.abilities[abilityKey]);
    const prompt = await this.promptModifier({
      title: game.i18n.format("WWN.Roll.CheckTitle", { ability: label }),
      skipDialog,
    });
    if (!prompt) return;

    const parts = new RollParts().add("1d20", game.i18n.localize("WWN.Roll.Die"));
    parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));
    const roll = await new WwnRoll(parts.formula(), actor.getRollData(), { kind: "check" }).evaluate();
    const success = roll.total <= ability.value;

    return createRollMessage({
      rolls: [roll],
      kind: "check",
      actor,
      title: game.i18n.format("WWN.Roll.CheckTitle", { ability: label }),
      subtitle: game.i18n.format("WWN.Roll.CheckTarget", { target: ability.value }),
      badge: {
        label: game.i18n.localize(success ? "WWN.Roll.Success" : "WWN.Roll.Failure"),
        type: success ? "hit" : "miss",
      },
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: { breakdown: parts.breakdown() },
    });
  }

  /* -------------------------------------------- */
  /*  Saving throws                               */
  /* -------------------------------------------- */

  static async rollSave(actor, saveId, { skipDialog = false } = {}) {
    const save = actor.system.saves?.[saveId];
    if (!save) return;
    const label = game.i18n.localize(save.label ?? saveId);
    const prompt = await this.promptModifier({
      title: game.i18n.format("WWN.Roll.SaveTitle", { save: label }),
      skipDialog,
    });
    if (!prompt) return;

    const parts = new RollParts().add("1d20", game.i18n.localize("WWN.Roll.Die"));
    parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));
    const roll = await new WwnRoll(parts.formula(), actor.getRollData(), { kind: "save" }).evaluate();
    const success = roll.total >= save.value;

    return createRollMessage({
      rolls: [roll],
      kind: "save",
      actor,
      title: game.i18n.format("WWN.Roll.SaveTitle", { save: label }),
      subtitle: game.i18n.format("WWN.Roll.SaveTarget", { target: save.value }),
      badge: {
        label: game.i18n.localize(success ? "WWN.Roll.Success" : "WWN.Roll.Failure"),
        type: success ? "hit" : "miss",
      },
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: { breakdown: parts.breakdown() },
    });
  }

  /** Effective skill level honoring the AE skill floor (non-combat only). */
  static effectiveSkillLevel(actor, skill) {
    const owned = skill.system.ownedLevel ?? -1;
    const slug = skill.system.slug || skill.name.slugify({ strict: true }).replace(/-/g, "");
    if (CONFIG.WWN.combatSkills.includes(slug)) return owned;
    const floor = actor.system.skills?.floor ?? -1;
    return Math.max(owned, floor);
  }

  static async rollSkill(actor, skill, { skipDialog = false, abilityKey = null } = {}) {
    abilityKey ??= skill.system.score ?? "int";
    const ability = actor.system.abilities?.[abilityKey];
    const prompt = await this.promptModifier({
      title: game.i18n.format("WWN.Roll.SkillTitle", { skill: skill.name }),
      skipDialog,
    });
    if (!prompt) return;

    const slug = skill.system.slug || "";
    const parts = new RollParts();
    const { extraDice, dropLowest } = getFocusSkillDiceBonus(actor, slug);
    if (extraDice > 0) {
      const totalDice = 2 + extraDice;
      parts.add(`${totalDice}d6dl${dropLowest}`, game.i18n.localize("WWN.Roll.SkillDice"));
    } else {
      parts.add(skill.system.skillDice || "2d6", game.i18n.localize("WWN.Roll.SkillDice"));
    }
    parts.add(this.effectiveSkillLevel(actor, skill), skill.name);
    parts.add(ability?.mod ?? 0, game.i18n.localize(CONFIG.WWN.abilityAbbreviations[abilityKey] ?? abilityKey));

    // Armor penalties
    if (slug === "sneak") parts.add(-(actor.system.skills?.sneakPenalty ?? 0), game.i18n.localize("WWN.Roll.ArmorPenalty"));
    if (slug === "exert") parts.add(-(actor.system.skills?.exertPenalty ?? 0), game.i18n.localize("WWN.Roll.ArmorPenalty"));
    parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

    const roll = await new WwnSkillRoll(parts.formula(), actor.getRollData(), { kind: "skill" }).evaluate();

    return createRollMessage({
      rolls: [roll],
      kind: "skill",
      actor,
      img: skill.img,
      title: game.i18n.format("WWN.Roll.SkillTitle", { skill: skill.name }),
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: { breakdown: parts.breakdown() },
    });
  }

  /* -------------------------------------------- */
  /*  Attacks                                     */
  /* -------------------------------------------- */

  /** NPC damage bonus (fixed + optional half-HD); not AE-derived. */
  static #npcDamageBonus(actor) {
    if (!isNpc(actor)) return 0;
    const { damageBonus = 0, damageBonusHalfLevel = false } = actor.system.combat ?? {};
    return damageBonus + (damageBonusHalfLevel ? (actor.getRollData().halfLevel ?? 0) : 0);
  }

  /**
   * Whether shock damage applies on a miss against the given target (WWN melee shock rule).
   * @param {Actor} attacker
   * @param {Actor} targetActor
   * @param {Item} weapon
   * @param {string} attackKind
   * @returns {{ applies: boolean, effectiveTargetAc: number, threshold: number }}
   */
  static shockAppliesOnMiss(attacker, targetActor, weapon, attackKind) {
    const threshold = weapon.system.shockAcValue ?? weapon.system.shock?.ac ?? 0;
    if (attackKind !== "melee" || !weapon.system.shock?.damage) {
      return { applies: false, effectiveTargetAc: 0, threshold };
    }
    if (targetActor.system.combat?.immuneToShock) {
      return { applies: false, effectiveTargetAc: 0, threshold };
    }
    const effectiveTargetAc = attacker.system.combat?.treatAllMeleeAsAcTen
      ? 10
      : (targetActor.system.combat?.ac?.melee?.value ?? 10);
    return {
      applies: effectiveTargetAc <= threshold,
      effectiveTargetAc,
      threshold,
    };
  }

  /**
   * Resolve a combat damage/shock modifier that may be a formula string.
   * @param {number|string} value
   * @param {object} rollData
   * @returns {number|string}
   */
  static #resolveCombatFormula(value, rollData) {
    if (typeof value !== "string" || !value.includes("@")) return value;
    try {
      const replaced = foundry.dice.Roll.replaceFormulaData(value, rollData, { missing: "0" });
      const evaluated = foundry.dice.Roll.safeEval(replaced);
      if (Number.isFinite(evaluated)) return evaluated;
    } catch (_err) {
      // Fall through to raw formula for Roll evaluation.
    }
    return value;
  }

  /**
   * Pure assembly of attack/damage/shock parts.
   * @returns {{attack: RollParts, damage: RollParts, shock: RollParts|null, attackKind: string}}
   */
  static assembleAttack(actor, weapon, { attackKind, modifier = 0, burst = false } = {}) {
    const system = actor.system;
    const combat = system.combat;
    const isMelee = attackKind === "melee";
    const skill = weapon.system.linkedSkill;
    const abilityKey = weapon.system.score ?? "str";
    const abilityMod = system.abilities?.[abilityKey]?.mod ?? 0;
    const abilityLabel = game.i18n.localize(CONFIG.WWN.abilityAbbreviations[abilityKey] ?? abilityKey);

    const attack = new RollParts().add("1d20", game.i18n.localize("WWN.Roll.Die"));
    attack.add(combat.ab ?? 0, game.i18n.localize("WWN.Roll.AttackBonus"));
    attack.add(combat.allAttack ?? 0, game.i18n.localize("WWN.Effects.AttackAll"));
    attack.add(isMelee ? combat.meleeAttack ?? 0 : combat.rangeAttack ?? 0,
      game.i18n.localize(isMelee ? "WWN.Effects.AttackMelee" : "WWN.Effects.AttackRanged"));
    if (isPc(actor)) {
      attack.add(abilityMod, abilityLabel);
      const skillLevel = skill ? this.effectiveSkillLevel(actor, skill) : -2;
      attack.add(skillLevel, skill?.name ?? game.i18n.localize("WWN.Roll.Unskilled"));
    } else {
      attack.add(system.skill ?? 0, game.i18n.localize("WWN.Roll.NpcSkill"));
    }
    attack.add(weapon.system.bonusValue ?? weapon.system.bonus ?? 0, game.i18n.localize("WWN.Roll.WeaponBonus"));
    if (burst) attack.add(2, game.i18n.localize("WWN.Roll.Burst"));
    attack.add(modifier, game.i18n.localize("WWN.Roll.Situational"));

    const damage = new RollParts().add(
      weapon.system.damage || "1d6",
      game.i18n.localize("WWN.Roll.WeaponDamage")
    );
    const damageMod = weapon.system.damageMod;
    if (damageMod !== null && damageMod !== undefined && damageMod !== "" && damageMod !== 0) {
      damage.add(damageMod, game.i18n.localize("WWN.Effects.Item.DamageMod"));
    }
    if (isPc(actor)) {
      damage.add(abilityMod, abilityLabel);
      if (weapon.system.skillDamage && skill) {
        damage.add(this.effectiveSkillLevel(actor, skill), skill.name);
      }
    }
    const npcBonus = this.#npcDamageBonus(actor);
    if (npcBonus) damage.add(npcBonus, game.i18n.localize("WWN.Npc.DamageBonus"));
    if (combat.allDamage) {
      damage.add(
        this.#resolveCombatFormula(combat.allDamage, actor.getRollData()),
        game.i18n.localize("WWN.Effects.DamageAll")
      );
    }
    const modeDamage = isMelee ? combat.meleeDamage : combat.rangeDamage;
    if (modeDamage) {
      damage.add(
        this.#resolveCombatFormula(modeDamage, actor.getRollData()),
        game.i18n.localize(isMelee ? "WWN.Effects.DamageMelee" : "WWN.Effects.DamageRanged")
      );
    }
    if (burst) damage.add(2, game.i18n.localize("WWN.Roll.Burst"));

    let shock = null;
    const shockBase = weapon.system.shock?.damage;
    if (shockBase) {
      shock = new RollParts().add(shockBase, game.i18n.localize("WWN.Roll.ShockBase"));
      const shockDamageMod = weapon.system.shock?.damageMod;
      if (shockDamageMod !== null && shockDamageMod !== undefined && shockDamageMod !== "" && shockDamageMod !== 0) {
        shock.add(shockDamageMod, game.i18n.localize("WWN.Effects.Item.ShockDamageMod"));
      }
      if (isPc(actor)) shock.add(abilityMod, abilityLabel);
      if (npcBonus) shock.add(npcBonus, game.i18n.localize("WWN.Npc.DamageBonus"));
      if (combat.allShock) shock.add(combat.allShock, game.i18n.localize("WWN.Effects.ShockAll"));
      const modeShock = isMelee ? combat.meleeShock : combat.rangeShock;
      if (modeShock) {
        shock.add(modeShock, game.i18n.localize(isMelee ? "WWN.Effects.ShockMelee" : "WWN.Effects.ShockRanged"));
      }
    }

    return { attack, damage, shock, attackKind };
  }

  /**
   * Full attack flow: options dialog, rolls, target comparison, ammo
   * consumption, sectioned attack card.
   */
  static async rollAttack(actor, weapon, { skipDialog = false } = {}) {
    // Determine melee/ranged
    let attackKind = weapon.system.melee ? "melee" : "ranged";
    const canChoose = weapon.system.melee && weapon.system.missile;

    let options = { modifier: 0, burst: false, charge: false, attackKind };
    if (!skipDialog || canChoose) {
      const result = await showWwnDialog({
        modifier: "attack-options",
        title: game.i18n.format("WWN.Roll.AttackTitle", { weapon: weapon.name }),
        template: "systems/wwn/templates/dialog/attack-options.hbs",
        context: {
          canChoose,
          attackKind,
          canBurst: weapon.system.burst,
          isPc: isPc(actor),
        },
        buttons: [rollButton(), cancelButton()],
      });
      if (!result || result === "cancel") return;
      options = {
        modifier: Number(result.modifier) || 0,
        burst: !!result.burst,
        charge: !!result.charge,
        attackKind: result.attackKind ?? attackKind,
      };
    }
    attackKind = options.attackKind;

    if (options.charge) await actor.applyChargeEffect();

    // Ammo / charges consumption
    if (!(await spendAttackAmmo(weapon, { burst: options.burst }))) return;

    const rollData = actor.getRollData();
    const { attack, damage, shock } = this.assembleAttack(actor, weapon, options);

    const attackRoll = await new WwnAttackRoll(attack.formula(), rollData, { kind: "attack" }).evaluate();
    const damageRoll = await new WwnDamageRoll(damage.formula(), rollData, { kind: "damage" }).evaluate();
    const rolls = [attackRoll, damageRoll];

    let shockTotal = null;
    let shockLabelAc = weapon.system.shockAcValue ?? weapon.system.shock?.ac;
    let shockTargetAc = null;
    if (shock) {
      const target = game.user.targets.first() ?? null;
      let shouldRollShock = true;
      if (target?.actor) {
        const { applies, effectiveTargetAc, threshold } = this.shockAppliesOnMiss(
          actor,
          target.actor,
          weapon,
          attackKind
        );
        shockLabelAc = threshold;
        shockTargetAc = effectiveTargetAc;
        shouldRollShock = applies;
      }
      if (shouldRollShock) {
        const shockRoll = await new WwnDamageRoll(shock.formula(), rollData, { kind: "damage" }).evaluate();
        shockTotal = shockRoll.total;
        rolls.push(shockRoll);
      }
    }

    // Target comparison (melee/ranged AC per setting)
    const separateRanged = game.settings.get("wwn", "separateRangedAC");
    const target = game.user.targets.first() ?? null;
    let badge = null;
    let targetName = null;
    let hit = true;
    if (target?.actor) {
      targetName = target.name;
      const tc = target.actor.system.combat;
      const targetAC = attackKind === "ranged" && separateRanged ? tc.ac.ranged.value : tc.ac.melee.value;
      hit = attackRoll.total >= targetAC;
      badge = {
        label: game.i18n.localize(hit ? "WWN.Roll.Hit" : "WWN.Roll.Miss"),
        type: hit ? "hit" : "miss",
      };
    }

    // Trauma (on hit, when enabled)
    const useTrauma = game.settings.get("wwn", "useTrauma");
    let trauma = null;
    if (useTrauma && weapon.system.trauma?.die && hit && target?.actor) {
      const traumaRoll = await new WwnRoll(weapon.system.trauma.die, rollData, { kind: "formula" }).evaluate();
      rolls.push(traumaRoll);
      const traumaTarget = target.actor.system.trauma?.value ?? 6;
      const traumatic = traumaRoll.total >= traumaTarget;
      trauma = {
        die: weapon.system.trauma.die,
        result: traumaRoll.total,
        target: traumaTarget,
        rating: weapon.system.traumaRatingValue ?? weapon.system.trauma?.rating ?? 2,
        traumatic,
        multiplied: traumatic
          ? damageRoll.total * (weapon.system.traumaRatingValue ?? weapon.system.trauma?.rating ?? 2)
          : null,
      };
    }

    // Godbound conversion (damage rolls only)
    const godbound = game.settings.get("wwn", "godboundDamage");
    let damageValue = damageRoll.total;
    let straightValue = null;
    if (godbound) {
      const conversion = damageRoll.godboundTotal;
      straightValue = damageRoll.total;
      damageValue = conversion.total;
    }

    // Apply rows for the card
    const applyRows = [];
    if (hit) {
      applyRows.push({
        id: "damage",
        label: game.i18n.localize("WWN.Roll.Damage"),
        value: damageValue,
        altValue: straightValue,
        altLabel: straightValue !== null ? game.i18n.format("WWN.Roll.Straight", { value: straightValue }) : null,
      });
    }
    if (shockTotal !== null) {
      const shockLabel = shockTargetAc !== null
        ? game.i18n.format("WWN.Roll.ShockVsTarget", {
          value: shockTotal,
          threshold: shockLabelAc,
          targetAc: shockTargetAc,
        })
        : game.i18n.format("WWN.Roll.ShockVs", {
          value: shockTotal,
          ac: shockLabelAc,
        });
      applyRows.push({
        id: "shock",
        label: shockLabel,
        value: shockTotal,
      });
    }
    if (trauma?.traumatic) {
      applyRows.push({
        id: "trauma",
        label: game.i18n.format("WWN.Roll.TraumaDamage", { rating: trauma.rating }),
        value: trauma.multiplied,
      });
    }

    return createRollMessage({
      rolls,
      kind: "attack",
      actor,
      img: weapon.img,
      title: game.i18n.format("WWN.Roll.AttackTitle", { weapon: weapon.name }),
      subtitle: targetName ? game.i18n.format("WWN.Roll.VsTarget", { target: targetName }) : null,
      badge,
      bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
      context: {
        attackBreakdown: attack.breakdown(),
        damageBreakdown: damage.breakdown(),
        applyRows,
        trauma,
        save: weapon.system.save || null,
        hit,
      },
      flags: { applyRows, save: weapon.system.save || null },
    });
  }

  /* -------------------------------------------- */
  /*  Standalone damage                           */
  /* -------------------------------------------- */

  static async rollDamage(actor, formula, { title, img, defaultHealing = false } = {}) {
    const npcBonus = WwnDice.#npcDamageBonus(actor);
    const rollFormula = npcBonus ? `(${formula}) + ${npcBonus}` : formula;
    const roll = await new WwnDamageRoll(rollFormula, actor.getRollData(), { kind: "damage" }).evaluate();
    const godbound = game.settings.get("wwn", "godboundDamage");
    let value = roll.total;
    let altValue = null;
    if (godbound) {
      altValue = roll.total;
      value = roll.godboundTotal.total;
    }
    return createRollMessage({
      rolls: [roll],
      kind: "damage",
      actor,
      img,
      title: title ?? game.i18n.localize("WWN.Roll.Damage"),
      defaultHealing,
      bodyTemplate: "systems/wwn/templates/chat/attack-card.hbs",
      context: {
        applyRows: [{
          id: "damage",
          label: game.i18n.localize("WWN.Roll.Damage"),
          value,
          altValue,
          altLabel: altValue !== null ? game.i18n.format("WWN.Roll.Straight", { value: altValue }) : null,
        }],
        hit: true,
        defaultHealing,
      },
      flags: {
        applyRows: [{ id: "damage", value, altValue }],
      },
    });
  }

  /* -------------------------------------------- */
  /*  Generic formula (never damage-converted)    */
  /* -------------------------------------------- */

  static async rollFormula(actor, formula, { title, img, kind = "formula" } = {}) {
    const roll = await new WwnRoll(formula, actor.getRollData(), { kind }).evaluate();
    return createRollMessage({
      rolls: [roll],
      kind,
      actor,
      img,
      title: title ?? game.i18n.localize("WWN.Roll.Formula"),
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
    });
  }

  /**
   * Power activation roll with optional above/below target comparison.
   * @param {Actor} actor
   * @param {Item} power
   */
  static async rollPowerActivation(actor, power) {
    const activation = power.system.activation;
    const formula = activation?.roll;
    if (!formula?.trim()) return;

    const roll = await new WwnRoll(formula, actor.getRollData(), { kind: "formula" }).evaluate();
    const target = Number(activation.rollTarget) || 0;
    const rollType = activation.rollType ?? "result";
    let badge = null;
    let subtitle = null;

    if (target > 0 && rollType !== "result") {
      const success = rollType === "above" ? roll.total > target : roll.total < target;
      subtitle = game.i18n.format("WWN.Roll.VsTarget", { target });
      badge = {
        label: game.i18n.localize(success ? "WWN.Roll.Success" : "WWN.Roll.Failure"),
        type: success ? "hit" : "miss",
      };
    }

    return createRollMessage({
      rolls: [roll],
      kind: "formula",
      actor,
      img: power.img,
      title: game.i18n.format("WWN.Power.RollTitle", { name: power.name }),
      subtitle,
      badge,
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
    });
  }

  /* -------------------------------------------- */
  /*  Hit dice (PC) and HP (NPC)                  */
  /* -------------------------------------------- */

  static async rollHitDice(actor) {
    const formula = hitDiceRollFormula(actor);
    const roll = await new WwnRoll(formula, actor.getRollData(), { kind: "formula" }).evaluate();
    return createRollMessage({
      rolls: [roll],
      kind: "hitDice",
      actor,
      title: game.i18n.localize("WWN.Roll.HitDice"),
      subtitle: actor.system.hitDice.display,
      bodyTemplate: "systems/wwn/templates/chat/hit-dice-card.hbs",
      context: { total: roll.total, currentMax: actor.system.hp.max },
      flags: { hitDiceTotal: roll.total, actorUuid: actor.uuid },
    });
  }

  static async rollNpcHp(actor) {
    const formula = String(actor.system.hd || "1d8");
    const roll = await new WwnRoll(formula, actor.getRollData(), { kind: "formula" }).evaluate();
    await actor.update({ "system.hp.value": roll.total, "system.hp.max": roll.total });
    return createRollMessage({
      rolls: [roll],
      kind: "npcHp",
      actor,
      title: game.i18n.localize("WWN.Roll.NpcHp"),
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
    });
  }

  /* -------------------------------------------- */
  /*  NPC utility rolls                           */
  /* -------------------------------------------- */

  static async rollMorale(actor) {
    const roll = await new WwnRoll("2d6", {}, { kind: "check" }).evaluate();
    const morale = actor.system.details?.morale ?? 7;
    const failed = roll.total > morale;
    return createRollMessage({
      rolls: [roll],
      kind: "morale",
      actor,
      title: game.i18n.localize("WWN.Roll.Morale"),
      subtitle: game.i18n.format("WWN.Roll.MoraleTarget", { target: morale }),
      badge: {
        label: game.i18n.localize(failed ? "WWN.Roll.MoraleFail" : "WWN.Roll.MoraleHold"),
        type: failed ? "miss" : "hit",
      },
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
    });
  }

  static async rollReaction(actor) {
    const roll = await new WwnRoll("2d6", {}, { kind: "check" }).evaluate();
    return createRollMessage({
      rolls: [roll],
      kind: "reaction",
      actor,
      title: game.i18n.localize("WWN.Roll.Reaction"),
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
    });
  }

  static async rollNpcSkill(actor, { skipDialog = false } = {}) {
    const skill = actor.system.skill ?? 0;
    const prompt = await this.promptModifier({
      title: game.i18n.localize("WWN.Roll.NpcSkillTitle"),
      skipDialog,
    });
    if (!prompt) return;

    const parts = new RollParts().add("2d6", game.i18n.localize("WWN.Roll.SkillDice"));
    parts.add(skill, game.i18n.localize("WWN.Roll.NpcSkill"));
    parts.add(prompt.modifier, game.i18n.localize("WWN.Roll.Situational"));

    const roll = await new WwnSkillRoll(parts.formula(), actor.getRollData(), { kind: "skill" }).evaluate();

    return createRollMessage({
      rolls: [roll],
      kind: "skill",
      actor,
      title: game.i18n.localize("WWN.Roll.NpcSkillTitle"),
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: { breakdown: parts.breakdown() },
    });
  }

  static async rollInstinct(actor) {
    const instinct = actor.system.details?.instinct ?? 0;
    const roll = await new WwnRoll("1d10", {}, { kind: "check" }).evaluate();
    const triggered = roll.total <= instinct;
    const message = await createRollMessage({
      rolls: [roll],
      kind: "instinct",
      actor,
      title: game.i18n.localize("WWN.Roll.Instinct"),
      subtitle: game.i18n.format("WWN.Roll.InstinctTarget", { target: instinct }),
      badge: {
        label: game.i18n.localize(triggered ? "WWN.Roll.InstinctTriggered" : "WWN.Roll.InstinctSteady"),
        type: triggered ? "miss" : "hit",
      },
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
      messageMode: game.settings.get("wwn", "hideInstinct") ? "gm" : undefined,
    });
    // Explicit follow-up step (never a side effect of result formatting)
    if (triggered && actor.system.details?.instinctTable) {
      const table = await fromUuid(actor.system.details.instinctTable);
      if (table) await table.draw();
    }
    return message;
  }

  static async rollAppearing(actor, which = "d") {
    const formula = which === "w" ? actor.system.details?.appearing?.w : actor.system.details?.appearing?.d;
    if (!formula) return;
    const roll = await new WwnRoll(formula, {}, { kind: "formula" }).evaluate();
    return createRollMessage({
      rolls: [roll],
      kind: "appearing",
      actor,
      title: game.i18n.localize(which === "w" ? "WWN.Roll.AppearingWilderness" : "WWN.Roll.AppearingDungeon"),
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
    });
  }
}

export { createCardMessage };
