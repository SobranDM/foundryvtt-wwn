import { WwnDice } from "../dice.js";
import { WwnItem } from "../item/entity.js";

export class WwnActor extends Actor {
  /**
   * Extends data from base Actor class
   */

  prepareData() {
    super.prepareData();

    // Compute modifiers from actor scores
    this.computeModifiers();
    this.computeAC();
    this.computeEncumbrance();
    this._calculateMovement();
    this.computeResources();
    this.computeTreasure();
    this.enableSpellcasting();
    this.computeEffort();
    this.computeSaves();
    this.computeTotalSP();
    this.setXP();
    this.computePrepared();
    this.computeInit();
  }

  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    if (!game.user.isGM && !this.isOwner) return;
    data.map((item) => {
      if (item.img === undefined) {
        item.img = WwnItem.defaultIcons[item.type];
      }
    });
    super.createEmbeddedDocuments(embeddedName, data, context);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  getExperience(value, options = {}) {
    if (this.type != "character") {
      return;
    }
    let modified = Math.floor(
      value + (this.system.details.xp.bonus * value) / 100
    );
    return this.update({
      "system.details.xp.value": modified + this.system.details.xp.value,
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
    const data = this.system;
    if (this.type == "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    } else if (this.type == "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    }
  }

  getBank(value, options = {}) {
    if (this.type != "character") {
      return;
    }
    return this.update({
      "system.currency.bank": value + this.system.currency.bank,
    }).then(() => {
      const speaker = ChatMessage.getSpeaker({ actor: this });
      ChatMessage.create({
        content: game.i18n.format("WWN.messages.GetCurrency", {
          name: this.name,
          value,
        }),
        speaker,
      });
    });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  rollHP(options = {}) {
    const roll = new Roll(this.system.hp.hd).roll({ async: false });
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
      actor: this.system,
      roll: {
        type: "above",
        target: this.system.saves[save].value,
        magic: this.type === "character" ? this.system.scores.wis.mod : 0,
      },
      details: game.i18n.format("WWN.roll.details.save", { save: label }),
    };

    let skip = options.event && options.event.ctrlKey;

    const rollMethod =
      this.type == "character" ? WwnDice.RollSave : WwnDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.save", { save: label }),
      title: game.i18n.format("WWN.roll.save", {
        save: this.name + " - " + label,
      }),
    });
  }

  rollMorale(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this.system,
      roll: {
        type: "below",
        target: this.system.details.morale,
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
      actor: this.system,
      roll: {
        type: "instinct",
        target: this.system.details.instinct,
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
      actor: this.system,
      roll: {
        type: "below",
        target: this.system.retainer.loyalty,
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
      actor: this.system,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("WWN.reaction.Hostile", {
            name: this.name,
          }),
          3: game.i18n.format("WWN.reaction.Unfriendly", {
            name: this.name,
          }),
          6: game.i18n.format("WWN.reaction.Neutral", {
            name: this.name,
          }),
          9: game.i18n.format("WWN.reaction.Indifferent", {
            name: this.name,
          }),
          12: game.i18n.format("WWN.reaction.Friendly", {
            name: this.name,
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
      actor: this.system,
      roll: {
        type: "check",
        target: this.system.scores[score].value,
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
    const rollParts = new Array(this.system.details.level || 1).fill(
      this.system.hp.hd
    );
    if (this.type == "character") {
      rollParts.push(
        `${this.system.scores.con.mod * this.system.details.level}[CON]`
      );
    }

    const data = {
      actor: this.system,
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
      rollParts.push(this.system.details.appearing.w);
      label = "(wilderness)";
    } else {
      rollParts.push(this.system.details.appearing.d);
      label = "(dungeon)";
    }
    const data = {
      actor: this.system,
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

  rollMonsterSkill(options = {}) {
    const label = game.i18n.localize(`WWN.skill`);
    const rollParts = ["2d6"];

    const data = {
      actor: this.system,
      roll: {
        type: "skill",
        target: this.system.details.skill,
      },

      details: game.i18n.format("WWN.roll.details.attribute", {
        score: label,
      }),
    };

    rollParts.push(this.system.details.skill);
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
    const data = this.system;

    const rollData = {
      actor: this.system,
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
    const data = this.system;
    const rollParts = ["1d20"];
    const dmgParts = [];
    const rollLabels = [];
    const dmgLabels = [];
    const weaponShock = attData.item.system.shock.damage;
    let statAttack, skillAttack, statValue, skillValue;
    if (data.character) {
      statAttack = attData.item.system.score;
      skillAttack = attData.item.system.skill;
      skillValue = this.items.find(
        (item) => item.type === "skill" && item.name.toLowerCase() === skillAttack.toLowerCase()
      ).system.ownedLevel;
      statValue = this.system.scores[statAttack].mod;
    }

    let readyState = "";
    let label = game.i18n.format("WWN.roll.attacks", {
      name: this.name,
    });
    if (!attData.item) {
      dmgParts.push("1d6");
    } else {
      if (data.character) {
        if (attData.item.system.equipped) {
          readyState = game.i18n.format("WWN.roll.readied");
        } else if (attData.item.system.stowed) {
          readyState = game.i18n.format("WWN.roll.stowed");
        } else {
          readyState = game.i18n.format("WWN.roll.notCarried");
        }
      }
      label = game.i18n.format("WWN.roll.attacksWith", {
        name: attData.item.name,
        readyState: readyState,
      });
      dmgParts.push(attData.item.system.damage);
    }

    if (data.character) {
      if (data.warrior) {
        const levelRoundedUp = Math.ceil(this.system.details.level / 2);
        attData.item.system.shockTotal =
          statValue + weaponShock + levelRoundedUp;
      } else {
        attData.item.system.shockTotal = statValue + weaponShock;
      }
      if (attData.item.system.skillDamage) {
        attData.item.system.shockTotal =
          attData.item.system.shockTotal + skillValue;
      }
    } else {
      attData.item.system.shockTotal =
        Number(this.system.damageBonus) +
        Number(attData.item.system.shock.damage);
    }
    rollParts.push(data.thac0.bba.toString());
    rollLabels.push(`+${data.thac0.bba} (attack bonus)`);

    // TODO: Add range selector in dialogue if missile attack.
    /* if (options.type == "missile") {
      rollParts.push(
        
      );
    } */
    if (data.character) {
      const unskilledAttack = attData.item.system.tags.find(
        (weapon) => weapon.title === "CB"
      )
        ? 0
        : -2;
      rollParts.push(statValue);
      rollLabels.push(`+${statValue} (${statAttack})`);
      if (skillValue == -1) {
        rollParts.push(unskilledAttack);
        rollLabels.push(`${unskilledAttack} (unskilled penalty)`);
      } else {
        rollParts.push(skillValue);
        rollLabels.push(`+${skillValue} (${skillAttack})`);
      }
    }

    if (attData.item && attData.item.system.bonus) {
      rollParts.push(attData.item.system.bonus);
      rollLabels.push(`+${attData.item.system.bonus} (weapon bonus)`);
    }
    let thac0 = data.thac0.value;

    if (data.character) {
      dmgParts.push(statValue);
      dmgLabels.push(`+${statValue} (${statAttack})`);
      if (data.warrior) {
        const levelRoundedUp = Math.ceil(data.details.level / 2);
        dmgParts.push(levelRoundedUp);
        dmgLabels.push(`+${levelRoundedUp} (warrior bonus)`);
      }
      if (attData.item.system.skillDamage) {
        dmgParts.push(skillValue);
        dmgLabels.push(`+${skillValue} (${skillAttack})`);
      }
    } else {
      dmgParts.push(this.system.damageBonus);
      dmgLabels.push(`+${this.system.damageBonus.toString()} (damage bonus)`);
    }

    const rollTitle = `1d20 ${rollLabels.join(" ")}`;
    const dmgTitle = `${dmgParts[0]} ${dmgLabels.join(" ")}`;

    const rollData = {
      ...(this._getRollData() || {}),
      actor: this,
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
      rollTitle: rollTitle,
      dmgTitle: dmgTitle,
    });
  }

  async applyDamage(amount = 0, multiplier = 1) {
    amount = Math.floor(parseInt(amount) * multiplier);
    const hp = this.system.hp;

    // Remaining goes to health
    const dh = Math.clamped(hp.value - amount, 0, hp.max);

    // Update the Actor
    return this.update({
      "system.hp.value": dh,
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

  computeInit() {
    let initValue = 0;
    if (game.settings.get("wwn", "initiative") != "group") {
      if (this.type == "character") {
        initValue = this.system.scores.dex.mod + this.system.initiative.mod;
      } else {
        initValue = this.system.initiative.mod;
      }
    }
    this.system.initiative.value = initValue;
  }

  setXP() {
    if (this.type != "character") {
      return;
    }
    const data = this.system;
    let xpRate = [];
    let level = data.details.level - 1;

    // Retrieve XP Settings
    switch (game.settings.get("wwn", "xpConfig")) {
      case "xpSlow":
        xpRate = [6, 15, 24, 36, 51, 69, 87, 105, 139];
        break;
      case "xpFast":
        xpRate = [3, 6, 12, 18, 27, 39, 54, 72, 93];
        break;
      case "xpCustom":
        xpRate = game.settings.get("wwn", "xpCustomList").split(",");
        break;
    }

    // Set character's XP to level
    this.system.details.xp.next = xpRate[level];
  }

  computePrepared() {
    const spells = this.items.filter((i) => i.type == "spell");
    if (spells.length === 0) return;

    // Initialize data and variables
    let spellsPrepared = 0;

    spells.forEach((s) => {
      if (s.system.prepared) {
        spellsPrepared++;
      }
    });
    this.system.spells.prepared.value = spellsPrepared;
  }

  computeEncumbrance() {
    if (this.type != "character") return;
    const data = this.system;

    // Compute encumbrance
    let totalReadied = 0;
    let totalStowed = 0;
    let maxReadied = Math.floor(data.scores.str.value / 2);
    let maxStowed = data.scores.str.value;
    const weapons = this.items.filter((w) => w.type == "weapon");
    const armors = this.items.filter((a) => a.type == "armor");
    const items = this.items.filter((i) => i.type == "item");

    weapons.forEach((w) => {
      if (
        (w.system.weightless === "whenReadied" && w.system.equipped) ||
        (w.system.weightless === "whenStowed" && w.system.stowed)
      )
        return;
      if (w.system.equipped) {
        totalReadied += Math.ceil(w.system.weight * w.system.quantity);
      } else if (w.system.stowed) {
        totalStowed += Math.ceil(w.system.weight * w.system.quantity);
      }
    });
    armors.forEach((a) => {
      if (
        (a.system.weightless === "whenReadied" && a.system.equipped) ||
        (a.system.weightless === "whenStowed" && a.system.stowed)
      )
        return;
      if (a.system.equipped) {
        totalReadied += a.system.weight;
      } else if (a.system.stowed) {
        totalStowed += a.system.weight;
      }
    });
    items.forEach((i) => {
      if (
        (i.system.weightless === "whenReadied" && i.system.equipped) ||
        (i.system.weightless === "whenStowed" && i.system.stowed)
      )
        return;
      let itemWeight;
      if (i.system.charges.value || i.system.charges.max) {
        if (
          i.system.charges.value <= i.system.charges.max ||
          !i.system.charges.value
        ) {
          itemWeight = i.system.weight;
        } else if (!i.system.charges.max) {
          itemWeight = i.system.charges.value * i.system.weight;
        } else {
          itemWeight = i.system.charges.value / i.system.charges.max * i.system.weight;
        }
      } else {
        itemWeight = i.system.weight * i.system.quantity;
      }
      if (i.system.equipped) {
        totalReadied += Math.ceil(itemWeight);
      } else if (i.system.stowed) {
        totalStowed += Math.ceil(itemWeight);
      }
    });

    if (game.settings.get("wwn", "currencyTypes") == "currencybx") {
      const coinWeight =
        (data.currency.cp +
          data.currency.sp +
          data.currency.ep +
          data.currency.gp +
          data.currency.pp) /
        100;
      totalStowed += coinWeight;
    } else {
      const coinWeight =
        (data.currency.cp + data.currency.sp + data.currency.gp) / 100;
      totalStowed += coinWeight;
    }

    this.system.encumbrance = {
      readied: { max: maxReadied, value: totalReadied.toFixed(2) },
      stowed: { max: maxStowed, value: totalStowed.toFixed(2) },
    };
  }

  _calculateMovement() {
    if (this.type != "character") return;

    const data = this.system;

    if (data.config.movementAuto) {
      let newBase = data.movement.base;
      const readiedValue = data.encumbrance.readied.value;
      const readiedMax = data.encumbrance.readied.max;
      const stowedValue = data.encumbrance.stowed.value;
      const stowedMax = data.encumbrance.stowed.max;
      const bonus = data.movement.bonus;

      let systemBase = [];
      game.settings.get("wwn", "movementRate") == "movebx"
        ? (systemBase = [40, 30, 20])
        : (systemBase = [30, 20, 15]);

      if (readiedValue <= readiedMax && stowedValue <= stowedMax) {
        newBase = systemBase[0] + bonus;
      } else if (readiedValue <= readiedMax + 2 && stowedValue <= stowedMax) {
        newBase = systemBase[1] + bonus;
      } else if (readiedValue <= readiedMax && stowedValue <= stowedMax + 4) {
        newBase = systemBase[1] + bonus;
      } else if (
        readiedValue <= readiedMax + 2 &&
        stowedValue <= stowedMax + 4
      ) {
        newBase = systemBase[2] + bonus;
      } else if (readiedValue <= readiedMax + 4 && stowedValue <= stowedMax) {
        newBase = systemBase[2] + bonus;
      } else if (readiedValue <= readiedMax && stowedValue <= stowedMax + 8) {
        newBase = systemBase[2] + bonus;
      } else {
        newBase = 0;
      }
      this.system.movement = {
        base: newBase,
        exploration: newBase * 3,
        overland: newBase / 5,
        bonus,
      };
    }
  }

  // Calculate Resources
  computeResources() {
    if (this.type != "character") return;
    let totalOil = 0;
    let totalTorches = 0;
    let totalRations = 0;

    // Collect resource arrays
    const oilArray = this.items.filter(
      (i) =>
        i.name.toLowerCase() === "oil, one pint" ||
        i.name.toLowerCase() === "oil"
    );
    const torchArray = this.items.filter(
      (i) => i.name.toLowerCase() === "torch"
    );
    const rationsArray = this.items.filter((i) =>
      i.name.toLowerCase().includes("rations")
    );

    // Calculate resource totals
    oilArray.forEach((i) => (totalOil += i.system.charges.value));
    torchArray.forEach((i) => (totalTorches += i.system.charges.value));
    rationsArray.forEach((i) => (totalRations += i.system.charges.value));

    // Update resources
    this.system.details.resources = {
      oil: totalOil,
      torches: totalTorches,
      rations: totalRations,
    };
  }

  // Enable spell sheet and relevant sections
  enableSpellcasting() {
    if (this.type === "faction") return;
    const arts = this.items.filter(i => i.type === "art");
    const spells = this.items.filter(i => i.type === "spell");
    if (arts.length > 0 || spells.length > 0) {
      this.system.spells.enabled = true;
    }
    arts.length > 0
      ? this.system.spells.artsEnabled = true
      : this.system.spells.artsEnabled = false;
    spells.length > 0
      ? this.system.spells.spellsEnabled = true
      : this.system.spells.spellsEnabled = false;
  }

  // Compute Total Wealth
  computeTotalSP() {
    const data = this.system;
    if (this.type != "character") return;
    let newTotal =
      data.currency.cp * 0.1 +
      data.currency.sp +
      data.currency.gp * 10 +
      data.currency.pp * 100 +
      data.currency.ep * 5 +
      data.currency.bank +
      data.treasure;
    this.system.currency.total = newTotal;
  }

  // Compute Effort
  computeEffort() {
    const arts = this.items.filter((a) => a.type == "art");
    if (arts.length === 0) {
      this.system.classes = {}
      return;
    };

    // Initialize data
    const data = this.system;

    const classPools = {}

    arts.forEach((a) => {
      if (!classPools[a.system.source]) {
        classPools[a.system.source] = { value: a.system.effort, max: data.classes[a.system.source]?.max || 1 };
      } else {
        classPools[a.system.source].value += a.system.effort;
      }
    });

    this.system.classes = classPools;
  }

  computeTreasure() {
    if (this.type != "character") {
      return;
    }
    const data = this.system;
    // Compute treasure
    let total = 0;
    const treasures = this.items.filter(
      (i) => i.type == "item" && i.system.treasure
    );
    treasures.forEach((item) => {
      total += item.system.quantity * item.system.price;
    });
    this.system.treasure = total;
  }

  computeAC() {
    if (this.type != "character") {
      return;
    }

    const data = this.system;

    // Compute AC
    let baseAac = 10;
    let AacShieldMod = 0;
    let AacShieldNaked = 0;
    let naked = baseAac + data.scores.dex.mod + data.aac.mod;
    let exertPenalty = 0;
    let sneakPenalty = 0;

    const armors = this.items.filter((i) => i.type == "armor");
    armors.forEach((a) => {
      if (!a.system.equipped) {
        return;
      }
      if (a.system.type != "shield") {
        baseAac = a.system.aac.value + a.system.aac.mod;
        // Check if armor is medium or heavy and apply appropriate Sneak/Exert penalty
        if (a.system.type === "medium" && a.system.weight > sneakPenalty) {
          sneakPenalty = a.system.weight;
        }
        if (a.system.type === "heavy" && a.system.weight > sneakPenalty) {
          sneakPenalty = a.system.weight;
        }
        if (a.system.type === "heavy" && a.system.weight > exertPenalty) {
          exertPenalty = a.system.weight;
        }
      } else if (a.system.type == "shield") {
        AacShieldMod = 1 + a.system.aac.mod;
        AacShieldNaked = a.system.aac.value + a.system.aac.mod;
      }
    });
    if (AacShieldMod > 0) {
      let shieldOnly = AacShieldNaked + data.scores.dex.mod + data.aac.mod;
      let shieldBonus =
        baseAac + data.scores.dex.mod + data.aac.mod + AacShieldMod;
      if (shieldOnly > shieldBonus) {
        this.system.aac = {
          value: shieldOnly,
          shield: 0,
          naked,
          mod: data.aac.mod,
        };
      } else {
        this.system.aac = {
          value: shieldBonus,
          shield: AacShieldMod,
          naked,
          mod: data.aac.mod,
        };
      }
    } else {
      this.system.aac = {
        value: baseAac + data.scores.dex.mod + data.aac.mod,
        naked,
        shield: 0,
        mod: data.aac.mod,
      };
    }
    this.system.skills.sneakPenalty = sneakPenalty;
    this.system.skills.exertPenalty = exertPenalty;
  }

  computeModifiers() {
    if (this.type != "character") return;

    const data = this.system;
    const scores = data.scores;

    const standard = {
      0: -2,
      3: -2,
      4: -1,
      8: 0,
      14: 1,
      18: 2,
    };

    Object.keys(scores).map((score) => {
      let newMod =
        this.system.scores[score].tweak +
        WwnActor._valueFromTable(standard, scores[score].value);
      this.system.scores[score].mod = newMod;
    });

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
  }

  computeSaves() {
    if (this.type === "faction") return;
    const data = this.system;
    const saves = data.saves;
    Object.keys(saves).forEach((s) => {
      if (!saves[s].mod) {
        saves[s].mod = 0;
      }
    });

    if (this.type != "character") {
      const monsterHD = data.hp.hd.toLowerCase().split("d");
      Object.keys(saves).forEach(
        (s) =>
          (saves[s].value =
            Math.max(15 - Math.floor(monsterHD[0] / 2), 2) + saves[s].mod)
      );
    } else {
      let charLevel = data.details.level;
      let evasionVal =
        16 -
        Math.max(data.scores.int.mod, data.scores.dex.mod) -
        charLevel +
        data.saves.evasion.mod;
      let physicalVal =
        16 -
        Math.max(data.scores.con.mod, data.scores.str.mod) -
        charLevel +
        data.saves.physical.mod;
      let mentalVal =
        16 -
        Math.max(data.scores.wis.mod, data.scores.cha.mod) -
        charLevel +
        data.saves.mental.mod;
      let luckVal = 16 - charLevel + data.saves.luck.mod;
      this.system.saves.evasion.value = evasionVal;
      this.system.saves.physical.value = physicalVal;
      this.system.saves.mental.value = mentalVal;
      this.system.saves.luck.value = luckVal;
    }
  }

  _getRollData() {
    if (this.type === "faction") {
      // for now, no roll data for factions
      // but something to look at in the future maybe?
      return {};
    }

    const data = {};
    data.atk = this.system.thac0?.bba;

    if (this.type === "monster") {
      // no skills to use, but let's set @level to be = hd total.

      // just in case the hit dice field is wonky, default to 1
      data.level = 1;

      // parse out the first digit via a regex. might be hacky.
      const diceRegex = this.system.hp.hd.match(/([0-9]+)d[0-9]+/);
      if (!!diceRegex) {
        data.level = parseInt(diceRegex[1]);
      }
    } else {
      const skillMods = this.items
        .filter((i) => i.type === "skill")
        .map((s) => ({ name: toCamelCase(s.name), mod: s.system.ownedLevel }));

      skillMods.forEach((sm) => (data[sm.name] = sm.mod));

      data.level = this.system.details.level;
      data.str = this.system.scores.str.mod + this.system.scores.str.tweak;
      data.dex = this.system.scores.dex.mod + this.system.scores.dex.tweak;
      data.con = this.system.scores.con.mod + this.system.scores.con.tweak;
      data.wis = this.system.scores.wis.mod + this.system.scores.wis.tweak;
      data.int = this.system.scores.int.mod + this.system.scores.int.tweak;
      data.cha = this.system.scores.cha.mod + this.system.scores.cha.tweak;
    }
    return data;
  }

  // Creates a list of skills based on the following list. Was used to generate
  // the initial skills list to populate a compendium
  async createSkillsManually(data, options, user) {
    const skillList = [
      "administer",
      "connect",
      "convince",
      "craft",
      "exert",
      "heal",
      "know",
      "lead",
      "magic",
      "notice",
      "perform",
      "pray",
      "punch",
      "ride",
      "sail",
      "shoot",
      "sneak",
      "stab",
      "survive",
      "trade",
      "work",
      "biopsionics",
      "metapsionics",
      "precognition",
      "telekinesis",
      "telepathy",
      "teleportation",
    ];
    const skills = skillList.map((el) => {
      const skillKey = `WWN.skills.${el}`;
      const skillDesc = `WWN.skills.desc.${el}`;
      const imagePath = `/systems/wwn/assets/skills/${el}.png`;
      return {
        type: "skill",
        name: game.i18n.localize(skillKey),
        data: {
          ownedLevel: -1,
          score: "int",
          description: game.i18n.localize(skillDesc),
          skillDice: "2d6",
          secondary: false,
        },
        img: imagePath,
      };
    });

    if (data.type === "character") {
      await this.createEmbeddedDocuments("Item", skills);
    }
  }

  /** @override*/
  async _onCreate(data, options, user) {
    await super._onCreate(data, options, user);
    // Add primary skills from compendium
    if (data.type === "character" && game.userId == user) {
      // If there are no skills, add ones from compendium
      if (!data.items.filter((i) => i.type == "skill").length) {
        let skillPack = game.packs.get("wwn.skills");
        let toAdd = await skillPack.getDocuments();
        let primarySkills = toAdd
          .filter((i) => i.system.secondary == false)
          .map((item) => item.toObject());
        await this.createEmbeddedDocuments("Item", primarySkills);
      }
    }
  }
}

function toCamelCase(text) {
  const split = text.split(" ").map((t) => t.titleCase());
  split[0] = split[0].toLowerCase();
  return split.join();
}
