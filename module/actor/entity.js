import { WwnDice } from "../dice.js";
import { WwnItem } from "../item/entity.js";

export class WwnActor extends Actor {
  /**
   * Extends data from base Actor class
   */

  prepareData() {
    super.prepareData();
    const data = this.data.data;

    // Compute modifiers from actor scores
    this.computeModifiers();
    this.computeAC();
    this.computeEncumbrance();
    this.computeTreasure();
    this.computeEffort();
    this.computeSaves();
    this.computeTotalSP();

    // Determine Initiative
    if (game.settings.get("wwn", "initiative") != "group") {
      data.initiative.value = data.initiative.mod;
      if (this.data.type == "character") {
        data.initiative.value += data.scores.dex.mod;
      }
    } else {
      data.initiative.value = 0;
    }
  }

  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    data.map((item) => {
      if (item.img === undefined) {
        item.img = WwnItem.defaultIcons[item.type];
      }
    });
    return super.createEmbeddedDocuments(embeddedName, data, context);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  getExperience(value, options = {}) {
    if (this.data.type != "character") {
      return;
    }
    let modified = Math.floor(
      value + (this.data.data.details.xp.bonus * value) / 100
    );
    return this.update({
      "data.details.xp.value": modified + this.data.data.details.xp.value,
    }).then(() => {
      const speaker = ChatMessage.getSpeaker({ actor: this });
      ChatMessage.create({
        content: game.i18n.format("WWN.messages.GetExperience", {
          name: this.name,
          value: modified,
        }),
        speaker,
      });
    });
  }

  isNew() {
    const data = this.data.data;
    if (this.data.type == "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    } else if (this.data.type == "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    }
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  rollHP(options = {}) {
    let roll = new Roll(this.data.data.hp.hd).roll({async: false});
    return this.update({
      data: {
        hp: {
          max: roll.total,
          value: roll.total,
        },
      },
    });
  }

  rollSave(save, options = {}) {
    const label = game.i18n.localize(`WWN.saves.${save}`);
    const rollParts = ["1d20"];

    const data = {
      actor: this.data,
      roll: {
        type: "above",
        target: this.data.data.saves[save].value,
        magic:
          this.data.type === "character" ? this.data.data.scores.wis.mod : 0,
      },
      details: game.i18n.format("WWN.roll.details.save", { save: label }),
    };

    let skip = options.event && options.event.ctrlKey;

    const rollMethod =
      this.data.type == "character" ? WwnDice.RollSave : WwnDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.save", { save: label }),
      title: game.i18n.format("WWN.roll.save", { save: this.name + " - " +  label }),
    });
  }

  rollMorale(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this.data,
      roll: {
        type: "below",
        target: this.data.data.details.morale,
      },
    };

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: false,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("WWN.roll.morale"),
      title: game.i18n.localize("WWN.roll.morale"),
    });
  }

  rollInstinct(options = {}) {
    const rollParts = ["1d10"];

    const data = {
      actor: this.data,
      roll: {
        type: "above",
        target: this.data.data.details.instinct,
      },
    };

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: false,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("WWN.roll.instinct"),
      title: game.i18n.localize("WWN.roll.instinct"),
    });
  }

  rollLoyalty(options = {}) {
    const label = game.i18n.localize(`WWN.roll.loyalty`);
    const rollParts = ["2d6"];

    const data = {
      actor: this.data,
      roll: {
        type: "below",
        target: this.data.data.retainer.loyalty,
      },
    };

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollReaction(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this.data,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("WWN.reaction.Hostile", {
            name: this.data.name,
          }),
          3: game.i18n.format("WWN.reaction.Unfriendly", {
            name: this.data.name,
          }),
          6: game.i18n.format("WWN.reaction.Neutral", {
            name: this.data.name,
          }),
          9: game.i18n.format("WWN.reaction.Indifferent", {
            name: this.data.name,
          }),
          12: game.i18n.format("WWN.reaction.Friendly", {
            name: this.data.name,
          }),
        },
      },
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("WWN.reaction.check"),
      title: game.i18n.localize("WWN.reaction.check"),
    });
  }

  rollCheck(score, options = {}) {
    const label = game.i18n.localize(`WWN.scores.${score}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this.data,
      roll: {
        type: "check",
        target: this.data.data.scores[score].value,
      },

      details: game.i18n.format("WWN.roll.details.attribute", {
        score: label,
      }),
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.attribute", { attribute: label }),
      title: game.i18n.format("WWN.roll.attribute", { attribute: label }),
    });
  }

  rollHitDice(options = {}) {
    const label = game.i18n.localize(`WWN.roll.hd`);
    const rollParts = new Array(this.data.data.details.level || 1).fill(this.data.data.hp.hd);
    if (this.data.type == "character") {
      rollParts.push(`${this.data.data.scores.con.mod * this.data.data.details.level}[CON]`);
    }

    const data = {
      actor: this.data,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollAppearing(options = {}) {
    const rollParts = [];
    let label = "";
    if (options.check == "wilderness") {
      rollParts.push(this.data.data.details.appearing.w);
      label = "(lair/wilderness)";
    } else {
      rollParts.push(this.data.data.details.appearing.d);
      label = "(dungeon)";
    }
    const data = {
      actor: this.data,
      roll: {
        type: {
          type: "appearing",
        },
      },
    };

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.appearing", { type: label }),
      title: game.i18n.format("WWN.roll.appearing", { type: label }),
    });
  }

  rollSkills(expl, options = {}) {
    let selectedStat = this.data.data.score;
    let combatSkill = false;
    const poly = this.data.items.filter((p) => p.name == "Polymath");
    const label = game.i18n.localize(`WWN.skills.${expl}`);
    const statLabel = game.i18n.localize(`WWN.scores.${selectedStat}.long`);

    const data = {
      actor: this.data,
      roll: {
        type: "skill",
        target: this.data.data.skills[expl].value,
      },
      details: game.i18n.format("WWN.roll.details.skills", {
        expl: label,
      }),
    };
    if (expl == "shoot" || expl == "stab" || expl == "punch") {
      combatSkill = true;
    }
    const rollParts = [this.data.data.skills[expl].dice];
    if (poly.length > 0 && !combatSkill) {
      rollParts.push(Math.max(this.data.data.skills[expl].value, poly[0].data.data.ownedLevel -1));
    } else {
      rollParts.push(this.data.data.skills[expl].value);
    }
    rollParts.push(this.data.data.scores[selectedStat].mod);

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.skills", { skills: statLabel + " / " + label }),
      title: game.i18n.format("WWN.roll.skills", { skills: statLabel + " / " + label }),
    });
  }

  rollMonsterSkill(skill, options = {}) {
    const label = game.i18n.localize(`WWN.skill`);
    const rollParts = ["2d6"];

    const data = {
      actor: this.data,
      roll: {
        type: "skill",
        target: this.data.data.details.skill,
      },

      details: game.i18n.format("WWN.roll.details.attribute", {
        score: label,
      }),
    };

    rollParts.push(this.data.data.details.skill);
    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.attribute", { attribute: label }),
      title: game.i18n.format("WWN.roll.attribute", { attribute: label }),
    });
  }

  rollDamage(attData, options = {}) {
    const data = this.data.data;

    const rollData = {
      actor: this.data,
      item: attData.item,
      roll: {
        type: "damage",
      },
    };

    let dmgParts = [];
    if (!attData.roll.dmg) {
      dmgParts.push("1d6");
    } else {
      dmgParts.push(attData.roll.dmg);
    }

    // Add Str to damage
    if (attData.roll.type == "melee") {
      dmgParts.push(data.scores.str.mod);
    }

    // Damage roll
    WwnDice.Roll({
      event: options.event,
      parts: dmgParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${attData.label} - ${game.i18n.localize("WWN.Damage")}`,
      title: `${attData.label} - ${game.i18n.localize("WWN.Damage")}`,
    });
  }

  async targetAttack(data, type, options) {
    if (game.user.targets.size > 0) {
      for (let t of game.user.targets.values()) {
        data.roll.target = t;
        await this.rollAttack(data, {
          type: type,
          skipDialog: options.skipDialog,
        });
      }
    } else {
      this.rollAttack(data, { type: type, skipDialog: options.skipDialog });
    }
  }

  rollAttack(attData, options = {}) {
    const data = this.data.data;
    const rollParts = ["1d20"];
    const dmgParts = [];
    let label = game.i18n.format("WWN.roll.attacks", {
      name: this.data.name,
    });
    if (!attData.item) {
      dmgParts.push("1d6");
    } else {
      label = game.i18n.format("WWN.roll.attacksWith", {
        name: attData.item.name,
      });
      dmgParts.push(attData.item.data.damage);
    }

    if (data.character) {
      let statAttack = attData.item.data.score;
      let skillAttack = attData.item.data.skill;
      if (data.warrior) {
        let levelRoundedUp = Math.ceil(this.data.data.details.level / 2);
        attData.item.data.shockTotal =
          this.data.data.scores[statAttack].mod +
          attData.item.data.shock.damage +
          levelRoundedUp;
      } else {
        attData.item.data.shockTotal =
          this.data.data.scores[statAttack].mod +
          attData.item.data.shock.damage;
      }
      if (attData.item.data.skillDamage) {
        attData.item.data.shockTotal = attData.item.data.shockTotal + this.data.data.skills[skillAttack].value;
      }
    }

    rollParts.push(data.thac0.bba.toString());

    // TODO: Add range selector in dialogue if missile attack.
    /* if (options.type == "missile") {
      rollParts.push(
        
      );
    } */
    if (data.character) {
      let statAttack = attData.item.data.score;
      let skillAttack = attData.item.data.skill;
      let unskilledAttack = -2;
      rollParts.push(this.data.data.scores[statAttack].mod.toString());
      if (data.skills[skillAttack].value == -1) {
        rollParts.push(unskilledAttack.toString());
      } else {
        rollParts.push(data.skills[skillAttack].value.toString());
      }
    }

    if (attData.item && attData.item.data.bonus) {
      rollParts.push(attData.item.data.bonus);
    }
    let thac0 = data.thac0.value;

    if (data.character) {
      let statAttack = attData.item.data.score;
      let skillAttack = attData.item.data.skill;
      dmgParts.push(data.scores[statAttack].mod);
      if (data.warrior) {
        let levelRoundedUp = Math.ceil(data.details.level / 2);
        dmgParts.push(levelRoundedUp);
      }
      if (attData.item.data.skillDamage) {
        dmgParts.push(this.data.data.skills[skillAttack].value);
      }
    } else {
      dmgParts.push(this.data.data.damageBonus);
    }

    const rollData = {
      actor: this.data,
      item: attData.item,
      roll: {
        type: options.type,
        thac0: thac0,
        dmg: dmgParts,
        save: attData.roll.save,
        target: attData.roll.target,
      },
    };

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  async applyDamage(amount = 0, multiplier = 1) {
    amount = Math.floor(parseInt(amount) * multiplier);
    const hp = this.data.data.hp;

    // Remaining goes to health
    const dh = Math.clamped(hp.value - amount, 0, hp.max);

    // Update the Actor
    return this.update({
      "data.hp.value": dh,
    });
  }

  static _valueFromTable(table, val) {
    let output;
    for (let i = 0; i <= val; i++) {
      if (table[i] != undefined) {
        output = table[i];
      }
    }
    return output;
  }

  computeEncumbrance() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;

    // Compute encumbrance
    let totalReadied = 0;
    let totalStowed = 0;
    let maxReadied = Math.floor(data.scores.str.value / 2);
    let maxStowed = data.scores.str.value;
    const weapons = this.data.items.filter((w) => w.type == "weapon");
    const armors = this.data.items.filter((a) => a.type == "armor");
    const items = this.data.items.filter((i) => i.type == "item");
    
    weapons.forEach((w) => {
      if (w.data.data.equipped) {
        totalReadied += w.data.data.weight * w.data.data.quantity;
      } else if (w.data.data.stowed) {
        totalStowed += w.data.data.weight * w.data.data.quantity;
      }
    });
    armors.forEach((a) => {
      if (a.data.data.equipped) {
        totalReadied += a.data.data.weight;
      } else if (a.data.data.stowed) {
        totalStowed += a.data.data.weight;
      }
    });
    items.forEach((i) => {
      if (i.data.data.equipped) {
        totalReadied += i.data.data.weight * i.data.data.quantity;
      } else if (i.data.data.stowed) {
        totalStowed += i.data.data.weight * i.data.data.quantity;
      }
    });
    
    if (game.settings.get("wwn", "currencyTypes") == "currencybx") {
      let coinWeight = ( data.currency.cp + data.currency.sp + data.currency.ep + data.currency.gp + data.currency.pp) / 100;
      totalStowed += coinWeight;
    } else {
      let coinWeight = ( data.currency.cp + data.currency.sp + data.currency.gp ) / 100;
      totalStowed += coinWeight;
    }
    data.encumbrance.readied.max = maxReadied;
    data.encumbrance.stowed.max = maxStowed;
    data.encumbrance.readied.value = totalReadied.toFixed(2);
    data.encumbrance.stowed.value = totalStowed.toFixed(2);
    this._calculateMovement();
  }

  _calculateMovement() {
    const data = this.data.data;
    if (data.config.movementAuto) {
      if (isNaN(data.movement.bonus)) { 
        data.movement.bonus = 0;
      }
      if (game.settings.get("wwn", "movementRate") == "movebx") {
        if (data.encumbrance.readied.value <= data.encumbrance.readied.max
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max) {
          data.movement.base = 40 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max +2
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max) {
          data.movement.base = 30 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max +4) {
          data.movement.base = 30 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max +2
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max +4) {
          data.movement.base = 20 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max +4
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max) {
          data.movement.base = 20 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max + 8) {
          data.movement.base = 20 + data.movement.bonus;
        } else {
          data.movement.base = 0;
        }
        data.movement.exploration = data.movement.base * 3;
        data.movement.overland = data.movement.exploration / 5;
      }
      else if (game.settings.get("wwn", "movementRate") == "movewwn") {
        if (data.encumbrance.readied.value <= data.encumbrance.readied.max
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max) {
          data.movement.base = 30 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max +2
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max) {
          data.movement.base = 20 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max +4) {
          data.movement.base = 20 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max +2
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max +4) {
          data.movement.base = 15 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max +4
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max) {
          data.movement.base = 15 + data.movement.bonus;
        } else if (data.encumbrance.readied.value <= data.encumbrance.readied.max
          && data.encumbrance.stowed.value <= data.encumbrance.stowed.max + 8) {
          data.movement.base = 15 + data.movement.bonus;
        } else {
          data.movement.base = 0;
        }
        data.movement.exploration = data.movement.base * 3;
        data.movement.overland = data.movement.base;
      }
    }
  }

  // Compute Total Wealth
  computeTotalSP() {
    const data = this.data.data;
    if (this.data.type != "character") {
      return;
    } else {
      data.currency.total = data.currency.cp * 0.1 + data.currency.sp + data.currency.gp * 10 + data.currency.pp * 100 + data.currency.ep * 5 + data.currency.bank + data.treasure;
    }

  }

  // Compute Effort
  computeEffort() {
    const data = this.data.data;
    if (data.spells.enabled != true) {
      return;
    }
    let effortOne = 0;
    let effortTwo = 0;
    let effortThree = 0;
    let effortType1 = data.classes.effort1.name;
    let effortType2 = data.classes.effort2.name;
    let effortType3 = data.classes.effort3.name;
    const arts = this.data.items.filter((a) => a.type == "art");
    arts.forEach((a) => {
      if (effortType1 == a.data.data.source) {
        effortOne += a.data.data.effort;
      }
      if (effortType2 == a.data.data.source) {
        effortTwo += a.data.data.effort;
      }
      if (effortType3 == a.data.data.source) {
        effortThree += a.data.data.effort;
      }
    });

    data.classes.effort1.value = effortOne;
    data.classes.effort2.value = effortTwo;
    data.classes.effort3.value = effortThree;
  }

  computeTreasure() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;
    // Compute treasure
    let total = 0;
    let treasure = this.data.items.filter(
      (i) => i.type == "item" && i.data.data.treasure
    );
    treasure.forEach((item) => {
      total += item.data.data.quantity * item.data.data.price;
    });
    data.treasure = total;
  }

  computeAC() {
    if (this.data.type != "character") {
      return;
    }
    // Compute AC
    let baseAac = 10;
    let AacShieldMod = 0;
    let AacShieldNaked = 0;
    const data = this.data.data;
    data.aac.naked = baseAac + data.scores.dex.mod + data.aac.mod;
    const armors = this.data.items.filter((i) => i.type == "armor");
    armors.forEach((a) => {
      if (a.data.data.equipped && a.data.data.type != "shield") {
        baseAac = a.data.data.aac.value + a.data.data.aac.mod;
      } else if (a.data.data.equipped && a.data.data.type == "shield") {
        AacShieldMod = 1 + a.data.data.aac.mod;
        AacShieldNaked = a.data.data.aac.value + a.data.data.aac.mod;
      }
    });
    if (AacShieldMod > 0) {
      let shieldOnly = AacShieldNaked + data.scores.dex.mod + data.aac.mod;
      let shieldBonus = baseAac + data.scores.dex.mod + data.aac.mod + AacShieldMod;
      if (shieldOnly > shieldBonus) {
        data.aac.value = shieldOnly;
      } else {
        data.aac.value = shieldBonus;
        data.aac.shield = AacShieldMod;
      }
    } else {
      data.aac.value = baseAac + data.scores.dex.mod + data.aac.mod;
    }
  }

  computeModifiers() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;

    const standard = {
      0: -2,
      3: -2,
      4: -1,
      8: 0,
      14: 1,
      18: 2,
    };
    data.scores.str.mod =
      data.scores.str.tweak +
      WwnActor._valueFromTable(standard, data.scores.str.value);
    data.scores.int.mod =
      data.scores.int.tweak +
      WwnActor._valueFromTable(standard, data.scores.int.value);
    data.scores.dex.mod =
      data.scores.dex.tweak +
      WwnActor._valueFromTable(standard, data.scores.dex.value);
    data.scores.cha.mod =
      data.scores.cha.tweak +
      WwnActor._valueFromTable(standard, data.scores.cha.value);
    data.scores.wis.mod =
      data.scores.wis.tweak +
      WwnActor._valueFromTable(standard, data.scores.wis.value);
    data.scores.con.mod =
      data.scores.con.tweak +
      WwnActor._valueFromTable(standard, data.scores.con.value);

    const capped = {
      0: -2,
      3: -2,
      4: -1,
      6: -1,
      9: 0,
      13: 1,
      16: 1,
      18: 2,
    };
    data.scores.dex.init = data.scores.dex.mod;
    data.scores.cha.npc = WwnActor._valueFromTable(
      capped,
      data.scores.cha.value
    );
    data.scores.cha.retain = data.scores.cha.mod + 4;
    data.scores.cha.loyalty = data.scores.cha.mod + 7;

    const literacy = {
      0: "",
      3: "WWN.Illiterate",
      6: "WWN.LiteracyBasic",
      9: "WWN.Literate",
    };
    data.languages.literacy = WwnActor._valueFromTable(
      literacy,
      data.scores.int.value
    );

    data.langTotal = data.skills.connect.value + data.skills.know.value + 2;
    data.languages.spoken = "WWN.NativePlus";
  }

  computeSaves() {
    const data = this.data.data;
    if (!data.saves.evasion.mod) {
      data.saves.evasion.mod = 0;
    }
    if (!data.saves.physical.mod) {
      data.saves.physical.mod = 0;
    }
    if (!data.saves.mental.mod) {
      data.saves.mental.mod = 0;
    }
    if (!data.saves.luck.mod) {
      data.saves.luck.mod = 0;
    }
    
    if (this.data.type != "character") {
      let monsterHD = data.hp.hd.toLowerCase().split('d');
      data.saves.evasion.value = Math.max(15 - Math.floor(monsterHD[0] / 2),2) + data.saves.evasion.mod;
      data.saves.physical.value = Math.max(15 - Math.floor(monsterHD[0] / 2),2) + data.saves.physical.mod;
      data.saves.mental.value = Math.max(15 - Math.floor(monsterHD[0] / 2),2) + data.saves.mental.mod;
      data.saves.luck.value = Math.max(15 - Math.floor(monsterHD[0] / 2),2) + data.saves.luck.mod;
    } else {
    let evasionMod = Math.max(data.scores.int.mod,data.scores.dex.mod);
    let physicalMod = Math.max(data.scores.con.mod,data.scores.str.mod);
    let mentalMod = Math.max(data.scores.wis.mod,data.scores.cha.mod);
    let charLevel = data.details.level;

    data.saves.evasion.value = 16 - evasionMod - charLevel + data.saves.evasion.mod;
    data.saves.physical.value = 16 - physicalMod - charLevel + data.saves.physical.mod;
    data.saves.mental.value = 16 - mentalMod - charLevel + data.saves.mental.mod;
    data.saves.luck.value = 16 - charLevel + data.saves.luck.mod;
    }
  }
}
