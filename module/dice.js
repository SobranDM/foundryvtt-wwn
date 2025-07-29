export class WwnDice {
  static async digestResult(data, roll) {
    let result = {
      isSuccess: false,
      isFailure: false,
      target: data.roll.target,
      total: roll.total,
    };
    let die = roll.terms[0].total;
    if (data.roll.type == "above") {
      // SAVING THROWS
      if (roll.total >= result.target) {
        result.isSuccess = true;
      } else {
        result.isFailure = true;
      }
    } else if (data.roll.type == "below") {
      // MORALE, EXPLORATION
      if (roll.total <= result.target) {
        result.isSuccess = true;
      } else {
        result.isFailure = true;
      }
    } else if (data.roll.type == "check") {
      // SCORE CHECKS (1s and 20s)
      if (die == 1 || (roll.total <= result.target && die < 20)) {
        result.isSuccess = true;
      } else {
        result.isFailure = true;
      }
    } else if (data.roll.type == "skill") {
    } else if (data.roll.type == "table") {
      // Reaction
      let table = data.roll.table;
      let output = "";
      for (let i = 0; i <= roll.total; i++) {
        if (table[i]) {
          output = table[i];
        }
      }
      result.details = output;
    } else if (data.roll.type == "instinct") {
      // SAVING THROWS
      if (roll.total >= result.target) {
        result.isSuccess = true;
      } else {
        result.isFailure = true;
        // Pull result from linked instinct table
        const iL = data.actor.system.details.instinctTable.table;
        // RegEx expression to chop up iL into the chunks needed
        const pattern = /\[(.+)\.([\w]+)\]/;
        const iA = iL.match(pattern);
        const type = iA[1];
        const id = iA[2];
        let tablePromise;

        if (type === "RollTable") {
          tablePromise = Promise.resolve(game.tables.get(id))
        } else if (type === "wwn.instinct") {
          const pack = game.packs.get('wwn.instinct');
          tablePromise = pack.getDocument(id);
        } else {
          tablePromise = Promise.reject("not an instinct table")
        }
        if (game.settings.get("wwn", "hideInstinct")) {
          tablePromise.then(table => table.draw({ rollMode: "gmroll" }));
        } else {
          tablePromise.then(table => table.draw());
        }
      }
    }
    return result;
  }

  static async sendRoll({
    parts = [],
    data = {},
    title = null,
    flavor = null,
    speaker = null,
    form = null,
    rollTitle = null
  } = {}) {
    const template = "systems/wwn/templates/chat/roll-result.html";

    let chatData = {
      user: game.user.id,
      speaker: speaker,
    };

    const templateData = {
      title: title,
      flavor: flavor,
      data: data,
      rollTitle: rollTitle
    };

    // Optionally include a situational bonus
    if (form !== null && form.bonus.value) {
      parts.push(form.bonus.value);
    }

    const roll = await new Roll(parts.join("+"), data).roll();

    // Convert the roll to a chat message and return the roll
    let rollMode = game.settings.get("core", "rollMode");
    rollMode = form ? form.rollMode.value : rollMode;

    // Force blind roll (art formulas)
    if (data.roll.blindroll) {
      rollMode = game.user.isGM ? "selfroll" : "blindroll";
    }

    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") {
      chatData["blind"] = true;
      data.roll.blindroll = true;
    }

    templateData.result = await WwnDice.digestResult(data, roll);

    // Handle godbound damage if enabled
    let godboundRoll = null;
    if (game.settings.get("wwn", "godboundDamage")) {
      // If there's no dmg data but we have roll parts, treat the roll as damage
      if (!data.roll.dmg && parts.length > 0) {
        data.roll.dmg = parts;
      }

      if (data.roll.dmg) {
        const godboundResult = await WwnDice.rollGodboundDamage(data);
        // Create a synthetic roll object for the godbound damage to maintain compatibility
        godboundRoll = {
          total: godboundResult.straight.total,
          straightTotal: godboundResult.godbound.total,
          isGodbound: true,
          godboundData: godboundResult,
          terms: godboundResult.straight.roll.terms,
          dice: godboundResult.straight.roll.dice,
          render: async () => {
            const inputString = godboundResult.godbound.input.join(' + ');
            const outputString = godboundResult.godbound.output.join(' + ');

            // Get all terms including modifiers
            const normalTerms = godboundResult.straight.roll.terms.map(term => {
              if (term instanceof DiceTerm) {
                return term.results.map(r => r.result).join(' + ');
              }
              return term.total.toString();
            }).filter(term => {
              // Filter out zero terms, empty strings, and operator strings
              return term !== '0' && term !== '' && term !== ' + ' && term !== '+' && term !== ' - ' && term !== '-';
            });

            const normalInput = normalTerms.join(' + ');
            return `<div class="dice-roll">
            <div class="dice-result">
              <h4 class="dice-total">${godboundResult.godbound.total}</h4>
              <div class="dice-formula">${godboundResult.godbound.formula}</div>
              <div class="dice-tooltip">
                <div class="dice">
                  <ol class="dice-rolls">
                    <li class="roll godbound-conversion">
                      <div class="godbound-details">
                        <div class="godbound-label">Normal Damage</div>
                        <div class="godbound-values">${inputString} → ${outputString} = ${godboundResult.godbound.total}</div>
                      </div>
                    </li>
                    <li class="roll godbound-conversion">
                      <div class="godbound-details">
                        <div class="godbound-label">Straight Damage</div>
                        <div class="godbound-values">${normalInput} = ${godboundResult.straight.total}</div>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>`;
          }
        };
      }
    }

    return new Promise((resolve) => {
      roll.render().then((r) => {
        templateData.rollWWN = r;
        if (godboundRoll) {
          godboundRoll.render().then((gr) => {
            templateData.rollWWN = gr;
            templateData.straightDamage = godboundRoll.total;
            templateData.rollDamage = godboundRoll.straightTotal;
            renderTemplate(template, templateData).then((content) => {
              chatData.content = content;
              // Dice So Nice
              if (game.dice3d) {
                game.dice3d
                  .showForRoll(
                    roll,
                    game.user,
                    true,
                    chatData.whisper,
                    chatData.blind
                  )
                  .then((displayed) => {
                    ChatMessage.create(chatData);
                    resolve(roll);
                  });
              } else {
                chatData.sound = CONFIG.sounds.dice;
                ChatMessage.create(chatData);
                resolve(roll);
              }
            });
          });
        } else {
          renderTemplate(template, templateData).then((content) => {
            chatData.content = content;
            // Dice So Nice
            if (game.dice3d) {
              game.dice3d
                .showForRoll(
                  roll,
                  game.user,
                  true,
                  chatData.whisper,
                  chatData.blind
                )
                .then((displayed) => {
                  ChatMessage.create(chatData);
                  resolve(roll);
                });
            } else {
              chatData.sound = CONFIG.sounds.dice;
              ChatMessage.create(chatData);
              resolve(roll);
            }
          });
        }
      });
    });
  }

  static digestAttackResult(data, roll) {
    let result = {
      isSuccess: false,
      isFailure: false,
      target: "",
      total: roll.total,
    };
    result.target = data.roll.thac0;
    const targetAac = data.roll.target
      ? data.roll.target.actor.system.aac.value
      : 0;
    result.victim = data.roll.target ? data.roll.target.name : null;

    if (roll.total < targetAac) {
      result.details = game.i18n.format(
        "WWN.messages.AttackAscendingFailure",
        {
          bonus: result.target,
        }
      );
      return result;
    }
    result.details = game.i18n.format("WWN.messages.AttackAscendingSuccess", {
      result: roll.total,
    });
    result.isSuccess = true;

    return result;
  }

  static spendAmmo(attData) {
    const isNPC = attData.actor.type !== "character";
    const ammo = attData.item.system.ammo;
    if (isNPC || !ammo) return;
    const ammoItem = attData.actor.items.find(item => item.name.toLowerCase().includes(ammo.toLowerCase()) && item.system.charges.value != null);
    ammoItem.update({ "system.charges.value": ammoItem.system.charges.value - 1 });
  }

  static async rollGodboundDamage(data) {
    function mapDieDamage(dieResult) {
      if (dieResult <= 1) {
        return 0;
      }
      if (dieResult <= 5) {
        return 1;
      }
      if (dieResult <= 9) {
        return 2;
      }
      return 4;
    }

    function applyModifierToRoll(results, modifier) {
      const { delta, index } = results.reduce((bestDelta, result, thisIndex) => {
        const newDelta = mapDieDamage(result + modifier) - mapDieDamage(result);
        if (newDelta > bestDelta.delta) {
          return { delta: newDelta, index: thisIndex };
        }
        return bestDelta;
      }, { delta: -10, index: 0 });
      return { index, delta };
    }

    const rollFormula = new Roll(data.roll.dmg.join("+"), data);
    const roll = await rollFormula.evaluate();
    const inputArray = [];
    const outputArray = [];
    const results = roll.dice.reduce((acc, rolls) => [...acc, ...rolls.results], []);
    const dieTotal = results.reduce((total, r) => total + r.result, 0);
    const modifier = roll.total - dieTotal;

    let total = 0;
    results.forEach((x) => {
      const die = mapDieDamage(x.result);
      total += die;
      inputArray.push(x.result);
      outputArray.push(die);
    });
    if (!!modifier) {
      const { index, delta } = applyModifierToRoll(inputArray, modifier)
      total += delta;
      outputArray[index] = mapDieDamage(inputArray[index] + modifier);
      inputArray[index] = inputArray[index] + modifier;
    }

    return {
      godbound: {
        total: total,
        input: inputArray,
        output: outputArray,
        formula: data.roll.dmg.join("+")
      },
      straight: {
        total: roll.total,
        formula: data.roll.dmg.join("+"),
        roll: roll  // Pass the actual roll object
      }
    };
  }

  static async sendAttackRoll({
    parts = [],
    data = {},
    title = null,
    flavor = null,
    speaker = null,
    form = null,
    rollTitle = null,
    dmgTitle = null
  } = {}) {
    const template = "systems/wwn/templates/chat/roll-attack.html";

    let chatData = {
      user: game.user.id,
      speaker: speaker,
    };

    // Include charge bonus
    if (form !== null && form.charge.checked) {
      parts.push("2");
      rollTitle += " +2 (charge)";

      const actor = game.actors.get(speaker.actor);
      const token = game.canvas.tokens.get(speaker.token).document.delta;
      const linked = game.canvas.tokens.get(speaker.token).document.actorLink;
      const effectTarget = linked ? actor : token;
      const acTarget = actor.type === "character" ? "system.aac.mod" : "system.aac.value";

      effectTarget.createEmbeddedDocuments("ActiveEffect", [
        {
          name: "Charge",
          icon: "icons/environment/people/charge.webp",
          origin: `Actor.${speaker.actor}`,
          "duration.rounds": 1,
          "changes": [
            {
              key: acTarget,
              mode: 2,
              value: "-2"
            },
            {
              key: "system.thac0.bba",
              mode: 2,
              value: 2
            }
          ]
        }
      ])
    }

    // Optionally include a situational bonus
    if (form !== null && form.bonus.value) parts.push(form.bonus.value);

    let templateData = {
      title: title,
      flavor: flavor,
      data: data,
      config: CONFIG.WWN,
      rollTitle: rollTitle,
      dmgTitle: dmgTitle
    };

    const roll = await new Roll(parts.join("+"), data).roll();
    let dmgRoll;
    if (game.settings.get("wwn", "godboundDamage")) {
      const godboundResult = await WwnDice.rollGodboundDamage(data);
      // Create a synthetic roll object for the godbound damage to maintain compatibility
      dmgRoll = {
        total: godboundResult.straight.total,
        straightTotal: godboundResult.godbound.total,
        isGodbound: true,
        godboundData: godboundResult,
        terms: godboundResult.straight.roll.terms,
        dice: godboundResult.straight.roll.dice,
        render: async () => {
          const inputString = godboundResult.godbound.input.join(' + ');
          const outputString = godboundResult.godbound.output.join(' + ');

          // Get all terms including modifiers
          const normalTerms = godboundResult.straight.roll.terms.map(term => {
            if (term instanceof DiceTerm) {
              return term.results.map(r => r.result).join(' + ');
            }
            return term.total.toString();
          }).filter(term => {
            // Filter out zero terms, empty strings, and operator strings
            return term !== '0' && term !== '' && term !== ' + ' && term !== '+' && term !== ' - ' && term !== '-';
          });

          const normalInput = normalTerms.join(' + ');
          return `<div class="dice-roll">
            <div class="dice-result">
              <h4 class="dice-total">${godboundResult.straight.total}</h4>
              <div class="dice-formula">${godboundResult.godbound.formula}</div>
              <div class="dice-tooltip">
                <div class="dice">
                  <ol class="dice-rolls">
                    <li class="roll godbound-conversion">
                      <div class="godbound-details">
                        <div class="godbound-label">Normal Damage</div>
                        <div class="godbound-values">${inputString} → ${outputString} = ${godboundResult.godbound.total}</div>
                      </div>
                    </li>
                    <li class="roll godbound-conversion">
                      <div class="godbound-details">
                        <div class="godbound-label">Straight Damage</div>
                        <div class="godbound-values">${normalInput} = ${godboundResult.straight.total}</div>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>`;
        }
      };
    } else {
      dmgRoll = await new Roll(data.roll.dmg.join("+"), data).roll();
    }

    // Convert the roll to a chat message and return the roll
    let rollMode = game.settings.get("core", "rollMode");
    rollMode = form ? form.rollMode.value : rollMode;

    // Force blind roll (art formulas)
    if (data.roll.blindroll) {
      rollMode = game.user.isGM ? "selfroll" : "blindroll";
    }

    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") {
      chatData["blind"] = true;
      data.roll.blindroll = true;
    }

    templateData.result = WwnDice.digestAttackResult(data, roll);

    return new Promise((resolve) => {
      roll.render().then((r) => {
        templateData.rollWWN = r;
        if (dmgRoll.isGodbound) {
          dmgRoll.render().then((dr) => {
            templateData.rollDamage = dr;
            templateData.straightDamage = dmgRoll.total;
            renderTemplate(template, templateData).then((content) => {
              chatData.content = content;
              // 2 Step Dice So Nice
              if (game.dice3d) {
                game.dice3d
                  .showForRoll(
                    roll,
                    game.user,
                    true,
                    chatData.whisper,
                    chatData.blind
                  )
                  .then(() => {
                    if (templateData.result.isSuccess) {
                      templateData.result.dmg = dmgRoll.total;
                      game.dice3d
                        .showForRoll(
                          dmgRoll,
                          game.user,
                          true,
                          chatData.whisper,
                          chatData.blind
                        )
                        .then(() => {
                          ChatMessage.create(chatData);
                          resolve(roll);
                        });
                    } else {
                      ChatMessage.create(chatData);
                      resolve(roll);
                    }
                  });
              } else {
                chatData.sound = CONFIG.sounds.dice;
                ChatMessage.create(chatData);
                resolve(roll);
              }
              this.spendAmmo(data);
            });
          });
        } else {
          dmgRoll.render().then((dr) => {
            templateData.rollDamage = dr;
            renderTemplate(template, templateData).then((content) => {
              chatData.content = content;
              // Dice So Nice
              if (game.dice3d) {
                game.dice3d
                  .showForRoll(
                    roll,
                    game.user,
                    true,
                    chatData.whisper,
                    chatData.blind
                  )
                  .then(() => {
                    if (templateData.result.isSuccess) {
                      templateData.result.dmg = dmgRoll.total;
                      game.dice3d
                        .showForRoll(
                          dmgRoll,
                          game.user,
                          true,
                          chatData.whisper,
                          chatData.blind
                        )
                        .then(() => {
                          ChatMessage.create(chatData);
                          resolve(roll);
                        });
                    } else {
                      ChatMessage.create(chatData);
                      resolve(roll);
                    }
                  });
              } else {
                chatData.sound = CONFIG.sounds.dice;
                ChatMessage.create(chatData);
                resolve(roll);
              }
              this.spendAmmo(data);
            });
          });
        }
      });
    });
  }

  static async RollSave({
    parts = [],
    data = {},
    skipDialog = false,
    speaker = null,
    flavor = null,
    title = null,
  } = {}) {
    let rolled = false;
    const template = "systems/wwn/templates/chat/roll-dialog.html";
    let dialogData = {
      formula: parts.join(" "),
      data: data,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
    };

    let rollData = {
      parts: parts,
      data: data,
      title: title,
      flavor: flavor,
      speaker: speaker,
    };
    if (skipDialog) { return WwnDice.sendRoll(rollData); }

    let buttons = {
      ok: {
        label: game.i18n.localize("WWN.Roll"),
        icon: '<i class="fas fa-dice-d20"></i>',
        callback: (html) => {
          rolled = true;
          rollData.form = html[0].querySelector("form");
          roll = WwnDice.sendRoll(rollData);
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("WWN.Cancel"),
        callback: (html) => { },
      },
    };

    const html = await renderTemplate(template, dialogData);
    let roll;

    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: "ok",
        close: () => {
          resolve(rolled ? roll : false);
        },
      }).render(true);
    });
  }

  static async Roll({
    parts = [],
    data = {},
    skipDialog = false,
    speaker = null,
    flavor = null,
    title = null,
    rollTitle = null,
    dmgTitle = null,
  } = {}) {
    let rolled = false;
    const template = "systems/wwn/templates/chat/roll-dialog.html";
    let dialogData = {
      formula: parts.join(" "),
      data: data,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
    };

    let rollData = {
      parts: parts,
      data: data,
      title: title,
      flavor: flavor,
      speaker: speaker,
      rollTitle: rollTitle,
      dmgTitle: dmgTitle
    };
    if (skipDialog) {
      return ["melee", "missile", "attack"].includes(data.roll.type)
        ? WwnDice.sendAttackRoll(rollData)
        : WwnDice.sendRoll(rollData);
    }

    let buttons = {
      ok: {
        label: game.i18n.localize("WWN.Roll"),
        icon: '<i class="fas fa-dice-d20"></i>',
        callback: (html) => {
          rolled = true;
          rollData.form = html[0].querySelector("form");
          roll = ["melee", "missile", "attack"].includes(data.roll.type)
            ? WwnDice.sendAttackRoll(rollData)
            : WwnDice.sendRoll(rollData);
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("WWN.Cancel"),
        callback: (html) => { },
      },
    };

    const html = await renderTemplate(template, dialogData);
    let roll;

    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: "ok",
        close: () => {
          resolve(rolled ? roll : false);
        },
      }).render(true);
    });
  }
}
