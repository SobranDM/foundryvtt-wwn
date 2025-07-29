import { WwnDice } from "../dice.js";
import { addEventListener as addCustomEventListener } from "../utils/listener-funcs.js";
import { applyChatCardDamage } from "../chat.js";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class WwnItem extends Item {
  // Replacing default image
  static get defaultIcons() {
    return {
      spell: "/systems/wwn/assets/default/spell.png",
      ability: "/systems/wwn/assets/default/ability.png",
      armor: "/systems/wwn/assets/default/armor.png",
      weapon: "/systems/wwn/assets/default/weapon.png",
      item: "/systems/wwn/assets/default/item.png",
      focus: "/systems/wwn/assets/default/focus.png",
      art: "/systems/wwn/assets/default/art.png",
      effect: ""
    };
  }

  static async create(data, context = {}) {
    if (data.img === undefined) {
      data.img = this.defaultIcons[data.type];
    }
    return super.create(data, context);
  }

  prepareData() {
    super.prepareData();
  }

  async prepareDerivedData() {
    const itemData = this?.system;

    // Rich text description
    itemData.enrichedDescription = await TextEditor.enrichHTML(
      itemData.description,
      { async: true }
    );
  }

  // Add static properties to store bound event handlers
  static _boundClickHandler = null;
  static _boundToggleHandler = null;
  static _boundSelectTokensHandler = null;

  static chatListeners(html) {
    if (!html) {
      console.error("No HTML element provided to attach listeners to");
      return;
    }

    // Handle both jQuery objects and raw HTML strings
    let cards;
    if (html instanceof jQuery) {
      // Old renderChatLog hook - html is a jQuery object
      cards = html.find('.chat-card, .chat-message .save-results, .chat-message .save-header, .chat-message');
      // Convert jQuery object to array for consistent handling
      cards = Array.from(cards);
    } else if (typeof html === 'string') {
      // New renderChatMessageHTML hook - html is a string
      const container = document.createElement('div');
      container.innerHTML = html;
      cards = Array.from(container.querySelectorAll('.chat-card, .chat-message .save-results, .chat-message .save-header, .chat-message'));
    } else {
      // Handle other cases (like HTMLElement)
      const container = html instanceof HTMLElement ? html : document.createElement('div');
      if (!(html instanceof HTMLElement)) {
        container.innerHTML = html;
      }
      cards = Array.from(container.querySelectorAll('.chat-card, .chat-message .save-results, .chat-message .save-header, .chat-message'));
    }

    if (!cards.length) return;

    // Remove existing listeners if they exist
    if (this._boundClickHandler) {
      document.removeEventListener('click', this._boundClickHandler);
    }
    if (this._boundToggleHandler) {
      document.removeEventListener('click', this._boundToggleHandler);
    }
    if (this._boundSelectTokensHandler) {
      document.removeEventListener('click', this._boundSelectTokensHandler);
    }

    // Create new bound handlers
    this._boundClickHandler = this._handleChatCardClick.bind(this);
    this._boundToggleHandler = this._handleChatCardToggle.bind(this);
    this._boundSelectTokensHandler = this._handleTokenSelection.bind(this);

    // Add listeners to the document for event delegation
    document.addEventListener('click', this._boundClickHandler);
    document.addEventListener('click', this._boundToggleHandler);
    document.addEventListener('click', this._boundSelectTokensHandler);
  }

  static _handleChatCardClick(event) {
    // Only handle clicks within chat cards or chat messages
    const card = event.target.closest('.chat-card, .chat-message');
    if (!card) return;

    // Check if the click was on a button within a chat card
    const button = event.target.closest('button, .card-buttons button, .damage-application');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    // Get the message that contains this button
    const message = button.closest('.message, .chat-message');
    if (!message) return;

    // For roll-result messages, we don't need to validate the message object
    // since they don't have data-messageId and aren't stored in game.messages
    if (message.classList.contains('chat-message')) {
      // This is a roll-result message, proceed without message validation
    } else {
      // This is a regular chat card, validate the message
      const messageId = message.dataset.messageId;
      if (!messageId) return;

      const messageObj = game.messages.get(messageId);
      if (!messageObj) return;
    }

    // Handle damage buttons (both types)
    const action = button.dataset.action;

    if (action === 'apply-damage' || action === 'apply-shock') {
      // Check for selected tokens
      const targets = this._getChatCardTargets(card);
      if (!targets.length) {
        ui.notifications.warn("You must have one or more tokens selected to apply damage.");
        return;
      }

      let amount;

      if (action === 'apply-shock') {
        // For shock damage, we can parse the number directly
        amount = parseInt(button.dataset.damage);
      } else {
        // Check if Godbound damage is enabled
        if (game.settings.get("wwn", "godboundDamage")) {
          // GODBOUND DAMAGE HANDLING
          // First, try to parse as a direct number (for roll-result messages)
          amount = parseInt(button.dataset.damage);

          // If that fails, it's HTML content that needs parsing (for item cards)
          if (isNaN(amount)) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = button.dataset.damage;

            // Look for the Godbound damage total in the conversion display
            const godboundValues = tempDiv.querySelectorAll('.godbound-values');
            if (godboundValues.length >= 1) {
              // The first godbound-values element contains "Normal Damage" which is actually Godbound damage
              const normalDamageText = godboundValues[0].textContent;
              // Extract the total from the end of the string (after the = sign)
              const match = normalDamageText.match(/= (\d+)$/);
              if (match) {
                amount = parseInt(match[1]);
              }
            }

            // If we couldn't find Godbound damage, fall back to normal parsing
            if (isNaN(amount)) {
              const diceTotal = tempDiv.querySelector('.dice-total');
              if (diceTotal) {
                amount = parseInt(diceTotal.textContent);
              }
            }
          }
        } else {
          // NORMAL DAMAGE HANDLING (existing code)
          // For regular damage, we need to parse the HTML string
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = button.dataset.damage;
          const diceTotal = tempDiv.querySelector('.dice-total');
          if (diceTotal) {
            amount = parseInt(diceTotal.textContent);
          }
        }
      }

      if (!isNaN(amount)) {
        // Apply the damage multiplier
        const multiplier = parseFloat(button.dataset.damageMultiplier) || 1;
        const finalAmount = Math.floor(amount * multiplier);
        applyChatCardDamage(amount, multiplier);
        return;
      } else {
        console.warn("Failed to parse damage amount:", button.dataset.damage);
      }
    }

    // Handle other button actions
    this._onChatCardAction(event);
  }

  static _handleChatCardToggle(event) {
    // Only handle clicks within chat cards
    const card = event.target.closest('.chat-card');
    if (!card) return;

    // Check if the click was on an item name within a chat card
    const itemName = event.target.closest('.chat-card .item-name');
    if (!itemName) return;

    event.preventDefault();
    event.stopPropagation();
    this._onChatCardToggleContent(event);
  }

  static _onChatCardToggleContent(event) {
    // Get the clicked element (should be the <a> tag inside .item-name)
    const clickedElement = event.target;
    // Find the closest .item-name element (in case we clicked the <a> tag)
    const itemName = clickedElement.closest('.item-name');
    if (!itemName) return;

    // Find the chat card that contains this item name
    const card = itemName.closest('.chat-card');
    if (!card) return;

    const content = card.querySelector('.card-content');
    if (!content) return;

    // Toggle visibility using native methods
    if (content.style.display === 'none') {
      content.style.display = 'block';
    } else {
      content.style.display = 'none';
    }
  }

  static async _onChatCardAction(event) {
    // Get the clicked button
    const button = event.target.closest('button');
    if (!button) return;

    button.disabled = true;

    try {
      // Find the chat card that contains this button
      const card = button.closest('.chat-card');
      if (!card) {
        console.warn("Could not find chat card for button click");
        return;
      }

      // Find the message that contains this card
      const message = card.closest('.message') || card.closest('.chat-message');
      if (!message) {
        console.warn("Could not find message for chat card");
        return;
      }

      const messageId = message.dataset.messageId;
      if (!messageId) {
        console.warn("No message ID found for chat card");
        return;
      }

      const messageObj = game.messages.get(messageId);
      if (!messageObj) {
        console.warn("Could not find message object for ID:", messageId);
        return;
      }

      const action = button.dataset.action;
      if (!action) {
        console.warn("No action specified for button");
        return;
      }

      // Validate permission to proceed with the roll
      const isTargetted = action === "save";
      if (!(isTargetted || game.user.isGM || messageObj.isAuthor)) {
        console.warn("User not authorized to perform this action");
        return;
      }

      // Get the Actor from a synthetic Token
      const actor = this._getChatCardActor(card);
      if (!actor) {
        console.warn("Could not find actor for chat card");
        return;
      }

      // Get the Item
      const item = actor.items.get(card.dataset.itemId);
      if (!item) {
        ui.notifications.error(
          `The requested item ${card.dataset.itemId} no longer exists on Actor ${actor.name}`
        );
        return;
      }

      // Get card targets
      let targets = [];
      let sceneId = null;
      if (isTargetted) {
        targets = this._getChatCardTargets(card);
        // Get scene ID from first token if available
        const firstToken = targets.find(t => t.token)?.token;
        sceneId = firstToken?.scene?.id;
      }

      // Attack and Damage Rolls
      if (action === "damage") await item.rollDamage({ event });
      else if (action === "formula") await item.rollFormula({ event });
      // Saving Throws for card targets
      else if (action === "save") {
        if (!targets.length) {
          ui.notifications.warn(
            `You must have one or more controlled Tokens in order to use this option.`
          );
          return;
        }

        // Create dialog data with token information
        const dialogData = {
          tokens: targets.map(t => ({
            id: t.token?.id || t.id,
            name: t.token?.name || t.name,
            actorId: t.actorId,
            actorLink: t.actorLink
          }))
        };

        // Render the save dialog template
        const template = "systems/wwn/templates/chat/save-dialog.html";
        const html = await renderTemplate(template, dialogData);

        // Create and render the dialog
        const d = new Dialog({
          title: "Selected Token Saves",
          content: html,
          buttons: {
            confirm: {
              icon: '<i class="fas fa-check"></i>',
              label: "Confirm",
              callback: async (html) => {
                const form = html[0].querySelector("form");
                const globalModifierInput = form.querySelector(".save-dialog-global-modifier");
                const globalModifier = parseInt(globalModifierInput.value) || 0;

                // Collect all save results
                const saveResults = [];

                // Process each target's save
                for (const dialogToken of dialogData.tokens) {
                  const individualModifierInput = form.querySelector(`[name="modifier-${dialogToken.id}"]`);
                  const individualModifier = individualModifierInput ? individualModifierInput.value : "";
                  const modifier = individualModifier !== "" ? parseInt(individualModifier) : globalModifier;

                  // Find the matching target actor
                  const target = targets.find(t => (t.token?.id || t.id) === dialogToken.id);
                  if (!target?.actor) continue;

                  // Get the token and create its ID
                  const token = target.token;
                  let fullTokenId = null;

                  if (token) {
                    fullTokenId = `${sceneId}.${token.id}`;
                  } else if (sceneId) {
                    fullTokenId = `${sceneId}.${target.actorId}`;
                  } else {
                    fullTokenId = target.actorId;
                  }

                  // Get the save type and verify it exists
                  const saveType = button.dataset.save;
                  if (!saveType || !target.actor.system?.saves?.[saveType]) continue;

                  // Create save data and roll
                  const saveData = {
                    actor: target.actor,
                    roll: {
                      type: "above",
                      target: target.actor.system.saves[saveType].value,
                      magic: target.actor.type === "character" ? target.actor.system.scores.wis.mod : 0,
                      modifier: modifier
                    }
                  };

                  const rollFormula = `1d20${modifier ? ` + ${modifier}` : ''}`;
                  const roll = await new Roll(rollFormula, saveData).roll();
                  const result = await WwnDice.digestResult(saveData, roll);
                  const rollWWN = await roll.render();

                  saveResults.push({
                    name: dialogToken.name,
                    tokenId: fullTokenId,
                    rollWWN,
                    roll,
                    ...result,
                    target: target.actor.system.saves[saveType].value,
                    modifier: modifier
                  });
                }

                // Sort results by roll total (highest first)
                saveResults.sort((a, b) => b.roll.total - a.roll.total);

                // Separate successful and failed saves
                const successfulSaves = saveResults.filter(r => r.isSuccess);
                const failedSaves = saveResults.filter(r => r.isFailure);

                // Create a single chat message with all rolls
                const templateData = {
                  saveType: game.i18n.localize(`WWN.saves.${button.dataset.save}`),
                  results: saveResults,
                  hasSuccessfulSaves: successfulSaves.length > 0,
                  hasFailedSaves: failedSaves.length > 0
                };

                const content = await renderTemplate("systems/wwn/templates/chat/save-results.html", templateData);

                const chatData = {
                  speaker: { alias: game.i18n.localize("WWN.spells.Save") },
                  sound: CONFIG.sounds.dice,
                  content: content,
                  type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                  user: game.user.id
                };

                // Handle Dice So Nice for all rolls
                if (game.dice3d) {
                  for (const result of saveResults) {
                    await game.dice3d.showForRoll(result.roll, game.user, true);
                  }
                }

                // Create the chat message and initialize listeners
                const message = await ChatMessage.create(chatData);
                if (message) {
                  // Initialize listeners for the new message
                  const html = $(message.element);
                  this.chatListeners(html);
                }
              }
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel",
              callback: () => { }
            }
          },
          default: "confirm"
        });

        d.render(true);
      }
    } catch (error) {
      console.error("Error in chat card action:", error);
      ui.notifications.error("An error occurred while processing the action.");
    } finally {
      // Re-enable the button
      button.disabled = false;
    }
  }

  getChatData(htmlOptions) {
    const itemData = { ...this.system };

    // Item properties
    const props = [];

    if (this.type == "weapon") {
      itemData.tags.forEach((t) => props.push(t.value));
    }
    if (this.type == "spell") {
      props.push(
        `${itemData.class} ${itemData.lvl}`,
        itemData.range,
        itemData.duration
      );
    }
    if (itemData.hasOwnProperty("equipped")) {
      props.push(itemData.equipped ? "Equipped" : "Not Equipped");
    }
    if (itemData.hasOwnProperty("stowed")) {
      props.push(itemData.stowed ? "Stowed" : "Not Stowed");
    }
    if (itemData.hasOwnProperty("prepared")) {
      props.push(itemData.prepared ? "Prepared" : "Not Prepared");
    }

    if (!!itemData.roll) {
      const unevaluatedRoll = new Roll(itemData.roll, {
        ...(this.actor?._getRollData() || {}),
        actor: this.actor,
      });
      itemData.roll = unevaluatedRoll.formula;
    }

    // Filter properties and return
    itemData.properties = props.filter((p) => !!p);
    return itemData;
  }

  async rollSkill(options = {}) {
    const template = "systems/wwn/templates/items/dialogs/roll-skill.html";

    const dialogData = {
      choices: {
        "str": "WWN.scores.str.short",
        "dex": "WWN.scores.dex.short",
        "con": "WWN.scores.con.short",
        "int": "WWN.scores.int.short",
        "wis": "WWN.scores.wis.short",
        "cha": "WWN.scores.cha.short"
      },
      diceChoices: {
        "2d6": "2d6",
        "3d6kh2": "3d6",
        "4d6kh2": "4d6",
        "1d6": "1d6"
      },
      defaultScore: this.system.score,
      dicePool: this.system.skillDice,
      name: this.name,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes
    };
    const newData = {
      actor: this.actor,
      item: this,
      roll: {},
    };

    const data = this.system;
    const skillName = this.name;
    const score = data.score.length ? this.actor.system.scores[data.score] : null;
    const scoreMod = score ? score.mod : 0;

    // Determine if armor penalty applies
    let armorPenalty = 0;
    if (skillName == "Exert") {
      armorPenalty -= this.parent.system.skills.exertPenalty;
    } else if (skillName == "Sneak") {
      armorPenalty -= this.parent.system.skills.sneakPenalty;
    }

    // Determine skill level, taking into account polymath and unskilled penalties
    let skillLevel;
    const poly = this.parent.items.find((i) => i.name == "Polymath");
    if (
      !poly ||
      skillName == "Shoot" ||
      skillName == "Stab" ||
      skillName == "Punch"
    ) {
      skillLevel = data.ownedLevel;
    } else {
      skillLevel = Math.max(poly.system.ownedLevel - 1, data.ownedLevel);
    }

    // Assemble dice pool
    const rollParts = [data.skillDice, scoreMod, skillLevel];
    if (armorPenalty < 0) {
      rollParts.push(armorPenalty);
    }

    if (options.skipDialog) {
      const attrKey = score ? `WWN.scores.${data.score}.short` : null;
      const rollTitle = score ? `${game.i18n.localize(attrKey)}/${this.name}` : this.name;

      let rollData = {
        parts: rollParts,
        data: newData,
        title: rollTitle,
        flavor: null,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        form: null,
        rollTitle: rollTitle,
      };
      return WwnDice.sendRoll(rollData);
    }

    const html = await renderTemplate(template, dialogData);
    const title = `${game.i18n.localize("WWN.Roll")} ${this.name}`;
    const _doRoll = async (html) => {
      const form = html[0].querySelector("form");
      rollParts[0] = form.skillDice.value;
      rollParts[1] = score ? this.actor.system.scores[form.score.value].mod : 0;
      const attrKey = score ? `WWN.scores.${form.score.value}.short` : null;
      const rollTitle = score ? `${game.i18n.localize(attrKey)}/${this.name}` : this.name;
      let rollData = {
        parts: rollParts,
        data: newData,
        title: rollTitle,
        flavor: null,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        form: form,
        rollTitle: rollTitle,
      };
      WwnDice.sendRoll(rollData);
    };

    let buttons = {
      ok: {
        label: title,
        icon: '<i class="fas fa-dice-d20"></i>',
        callback: _doRoll,
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("WWN.Cancel"),
        callback: (html) => { },
      },
    };

    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: "ok",
        close: () => { },
      }).render(true);
    });
  }

  rollWeapon(options = {}) {
    let isNPC = this.actor.type != "character";
    const data = this.system;
    let type = isNPC ? "attack" : "melee";

    const rollData = {
      ...(this.actor?._getRollData() || {}),
      item: this,
      actor: this.actor,
      roll: {
        save: this.system.save,
        target: null,
      },
    };

    if (data.missile && data.melee && !isNPC) {
      // Dialog
      new Dialog({
        title: "Choose Attack Range",
        content: "",
        buttons: {
          melee: {
            icon: '<i class="fas fa-fist-raised"></i>',
            label: "Melee",
            callback: () => {
              this.actor.targetAttack(rollData, "melee", options);
            },
          },
          missile: {
            icon: '<i class="fas fa-bullseye"></i>',
            label: "Missile",
            callback: () => {
              this.actor.targetAttack(rollData, "missile", options);
            },
          },
        },
        default: "melee",
      }).render(true);
      return true;
    } else if (data.missile && !isNPC) {
      type = "missile";
    }
    this.actor.targetAttack(rollData, type, options);
    return true;
  }

  async rollFormula(options = {}) {
    const data = this.system;

    if (!data.roll) {
      console.warn("No roll formula found for item:", this.name);
      throw new Error("This Item does not have a formula to roll!");
    }

    const label = `${this.name}`;
    const rollParts = [data.roll];

    let type = data.rollType;

    const newData = {
      ...(this.actor._getRollData() || {}),
      actor: this.actor,
      item: this,
      roll: {
        type: type,
        target: data.rollTarget,
        blindroll: data.blindroll,
      },
    };

    // Always use sendRoll and let the godbound damage logic handle the conversion
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: newData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.formula", { label: label }),
      title: game.i18n.format("WWN.roll.formula", { label: label }),
    });
  }

  async spendSpell() {
    if (this.actor.system.spells.leveledSlots) {
      if (this.type !== "spell")
        throw new Error(
          "Trying to spend a spell on an item that is not a spell."
        );

      const itemData = this.system;
      if (itemData.cast <= 0) {
        return ui.notifications.error("No slots remaining!");
      }
      await this.update({
        system: {
          cast: itemData.cast - 1,
        },
      });
      await this.show({ skipDialog: true });
    } else {
      const spellsLeft = this.actor.system.spells.perDay.value;
      const spellsMax = this.actor.system.spells.perDay.max;
      if (spellsLeft + 1 > spellsMax)
        return ui.notifications.warn("No spell slots remaining!");
      this.actor
        .update({
          "system.spells.perDay.value": spellsLeft + 1,
        })
        .then(() => {
          this.show({ skipDialog: true });
        });
    }
  }

  spendArt() {
    if (this.system.time) {
      const sourceName = this.system.source;
      if (sourceName === undefined)
        return ui.notifications.warn(
          `Please add class name to the Source field.`
        );

      const currEffort = this.system.effort;
      const sourceVal = this.actor.system.classes[sourceName].value;
      const sourceMax = this.actor.system.classes[sourceName].max;

      if (sourceVal + 1 > sourceMax)
        return ui.notifications.warn("No Effort remaining!");

      this.update({ "system.effort": currEffort + 1 }).then(() => {
        this.show({ skipDialog: true });
      });
    } else {
      this.show({ skipDialog: true });
    }
  }

  getTags() {
    let formatTag = (tag, icon) => {
      if (!tag) return "";
      let fa = "";
      if (icon) {
        fa = `<i class="fas ${icon}"></i> `;
      }
      return `<li class='tag'>${fa}${tag}</li>`;
    };

    const data = this.system;
    switch (this.system.type) {
      case "weapon":
        let wTags = formatTag(data.damage, "fa-tint");
        data.tags.forEach((t) => {
          wTags += formatTag(t.value);
        });
        wTags += formatTag(CONFIG.WWN.saves[data.save], "fa-skull");
        if (data.missile) {
          wTags += formatTag(
            data.range.short + "/" + data.range.long,
            "fa-bullseye"
          );
        }
        return wTags;
      case "armor":
        return `${formatTag(CONFIG.WWN.armor[data.type], "fa-tshirt")}`;
      case "item":
        return "";
      case "focus":
        return "";
      case "ability":
        return "";
      case "spell":
        let sTags = `${formatTag(data.class)}${formatTag(
          data.range
        )}${formatTag(data.duration)}${formatTag(data.roll)}`;
        if (data.save) {
          sTags += formatTag(CONFIG.WWN.saves[data.save], "fa-skull");
        }
        return sTags;
      case "art":
        let roll = "";
        roll += data.roll ? data.roll : "";
        roll += data.rollTarget ? CONFIG.WWN.roll_type[data.rollType] : "";
        roll += data.rollTarget ? data.rollTarget : "";
        return `${formatTag(data.requirements)}${formatTag(roll)}`;
      case "asset":
        return "";
    }
    return "";
  }

  pushTag(values) {
    const data = this.system;
    let update = [];
    if (data.tags) {
      update = duplicate(data.tags);
    }
    let newData = {};
    var regExp = /\(([^)]+)\)/;
    if (update) {
      values.forEach((val) => {
        // Catch infos in brackets
        var matches = regExp.exec(val);
        let title = "";
        if (matches) {
          title = matches[1];
          val = val.substring(0, matches.index).trim();
        } else {
          val = val.trim();
          title = val;
        }
        // Auto fill checkboxes
        switch (val) {
          case CONFIG.WWN.tags.melee:
            newData.melee = true;
            break;
          case CONFIG.WWN.tags.missile:
            newData.missile = true;
            break;
        }
        update.push({ title: title, value: val });
      });
    } else {
      update = values;
    }
    newData.tags = update;
    return this.update({ system: newData });
  }

  popTag(value) {
    const data = this.system;
    let update = data.tags.filter((el) => el.value != value);
    let newData = {
      tags: update,
    };
    return this.update({ system: newData });
  }

  roll() {
    switch (this.type) {
      case "weapon":
        this.rollWeapon();
        break;
      case "spell":
        this.spendSpell();
        break;
      case "art":
        this.spendArt();
        break;
      case "item":
      case "armor":
      case "focus":
      case "ability":
        this.show();
        break;
      case "skill":
        this.rollSkill();
        break;
      case "asset":
        this.rollAsset();
        break;
    }
  }

  /**
   * Show the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async show() {
    // Basic template rendering data
    const token = this.actor.token;
    const templateData = {
      actor: this.actor,
      tokenId: token ? `${token.parent.id}.${token.id}` : null,
      item: foundry.utils.duplicate(this),
      data: this.getChatData(),
      labels: this.labels,
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      isSpell: this.type === "spell",
      hasSave: this.hasSave,
      config: CONFIG.WWN,
    };

    // Render the chat card template
    const template = `systems/wwn/templates/chat/item-card.html`;
    const html = await renderTemplate(template, templateData);

    // Basic chat message data
    const chatData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      content: html,
      speaker: {
        actor: this.actor.id,
        token: this.actor.token,
        alias: this.actor.name,
      },
    };

    // Toggle default roll mode
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    // Create the chat message
    return ChatMessage.create(chatData);
  }

  static _getChatCardActor(card) {
    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId);
      if (!scene) return null;
      const tokenData = scene.getEmbeddedDocument("Token", tokenId);
      if (!tokenData) return null;
      const token = new Token(tokenData);
      return token.actor;
    }

    // Case 2 - use Actor ID directory
    const actorId = card.dataset.actorId;
    return game.actors.get(actorId) || null;
  }

  static _getChatCardTargets(card) {
    const character = game.user.character;
    const controlled = canvas.tokens.controlled;
    const targets = controlled.map(t => {
      // Ensure we have a valid actor
      const actor = t.actor || game.actors.get(t.document.actorId);
      if (!actor) return null;

      return {
        actor: actor,
        token: t,
        name: t.name,
        id: t.id,
        actorId: actor.id,
        actorLink: t.document.actorLink
      };
    }).filter(t => t !== null);

    // Add character if no tokens are controlled
    if (character && controlled.length === 0) {
      targets.push({
        actor: character,
        token: null,
        name: character.name,
        id: character.id,
        actorId: character.id,
        actorLink: false
      });
    }

    return targets;
  }

  /**
   * Asset Methods
   */
  async getAssetAttackRolls(isOffense, attackTarget = null) {
    const data = this.system;
    let hitBonus = 0;
    let damage = isOffense ? data.attackDamage : data.counter;
    if ((damage === "Special" || damage === "None")) {
      if (data.attackSpecial && data.attackSpecial.length > 0) {
        damage = "";
      } else if (isOffense) {
        return null;
      }
    } else if (!damage && isOffense) {
      ui.notifications?.info("No damage to roll for asset");
      return null;
    }
    const attackType = isOffense ? data.attackSource : attackTarget;
    if (!this.actor) {
      ui.notifications?.error("Asset must be associated with a faction");
      return null;
    }
    if (this.actor.type != "faction") {
      ui.notifications?.error("Asset must be associated with a faction");
      return null;
    }
    const actor = this.actor;
    if (attackType) {
      if (attackType === "cunning") {
        hitBonus = actor.system.cunningRating;
      } else if (attackType === "force") {
        hitBonus = actor.system.forceRating;
      } else if (attackType === "wealth") {
        hitBonus = actor.system.wealthRating;
      }
    }
    const rollData = {
      hitBonus,
    };
    const hitRollStr = "1d10 + @hitBonus";
    const hitRoll = await new Roll(hitRollStr, rollData).roll();
    if (!damage || damage === "None" || damage === "Special") {
      damage = "0";
    }
    const damageRoll = await new Roll(damage, rollData).roll();
    return [hitRoll, damageRoll];
  }

  async _assetAttack(isOffense) {
    const attackRolls = await this.getAssetAttackRolls(isOffense);
    if (!attackRolls) {
      return;
    }
    const diceData = Roll.fromTerms([
      foundry.dice.terms.PoolTerm.fromRolls([attackRolls[0], attackRolls[1]]),
    ]);
    const attackKey = isOffense
      ? "WWN.faction.attack-roll"
      : "WWN.faction.counter-roll";

    const assetsWithLocationNotes = this.actor.items.filter(i =>
      i.id != this.id && i.type == "asset" && i.system.location === this.system.location && i.system.locationRoll
    );

    const dialogData = {
      desc: this.system.description,
      name: `${this.actor?.name} - ${this.name}`,
      hitRoll: await attackRolls[0].render(),
      damageRoll: await attackRolls[1].render(),
      attackKey: game.i18n.localize(attackKey),
      attackSpecial: this.system.attackSpecial,
      assetsWithLocationNotes
    };
    const template = "systems/wwn/templates/chat/asset-attack.html";
    const chatContent = await renderTemplate(template, dialogData);

    if (this.actor?.type == "faction") {
      const actor = this.actor;
      //actor.logMessage("Attack Roll", chatContent, null, null);
    } else {
      const chatData = {
        roll: JSON.stringify(diceData),
        content: chatContent,
        type: CONST.CHAT_MESSAGE_STYLES.ROLL,
      };
      getDocumentClass("ChatMessage").applyRollMode(chatData, "gmroll");
      getDocumentClass("ChatMessage").create(chatData);
    }
  }

  // Search other factions for attack targets with targetType
  async _assetSearch(targetType) {
    if (!targetType) {
      ui.notifications?.info(
        "Attacking asset has no target type (cunning/wealth/force)"
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const otherActiveFactions = game.actors?.filter(
      (i) =>
        i.type === "faction" &&
        i.system.active == true &&
        this.actor?.id != i.id
    );
    if (!otherActiveFactions || otherActiveFactions.length == 0) {
      ui.notifications?.info("No other active factions found");
      return;
    }
    // id - > [faction, array of targets]
    const targetFactions = {};
    // id -> name
    const factionIdNames = {};
    for (const fA of otherActiveFactions) {
      const totalAssets = [...fA.system.cunningAssets, ...fA.system.forceAssets, ...fA.system.wealthAssets];
      if (fA.id && totalAssets.length > 0) {
        targetFactions[fA.id] = [fA, totalAssets];
        factionIdNames[fA.id] = fA.name;
      }
    }
    if (Object.keys(targetFactions).length == 0) {
      ui.notifications?.info(
        `${otherActiveFactions.length} other active factions found, but no ${targetType} assets were found`
      );
      return;
    }
    const dialogData = {
      faction: this.actor,
      attackingAsset: this,
      targetFactionsIdNames: factionIdNames,
      targets: targetFactions,
    };
    const template = "systems/wwn/templates/items/dialogs/select-asset-target.html";
    const html = renderTemplate(template, dialogData);

    const _rollAssetForm = async (html) => {
      const form = html[0].querySelector("form");

      const attackedFactionId = ((
        form.querySelector('[name="targetFaction"]')
      ))?.value;
      const attackedFaction = game.actors?.get(attackedFactionId);
      if (!attackedFaction) {
        ui.notifications?.info("Attack faction not selected or not found");
        return;
      }
      const assetFormName = `[name="asset-${attackedFactionId}"]`;
      const attackedAssetId = ((
        form.querySelector(assetFormName)
      ))?.value;
      const attackedAsset = attackedFaction?.getEmbeddedDocument(
        "Item",
        attackedAssetId
      );
      if (!attackedAsset) {
        ui.notifications?.info("Attacked asset not selected or not found");
        return;
      }
      const attackedAssetsWithLocationNotes = attackedFaction.items.filter(i =>
        i.type == "asset" && i.system.location === this.system.location && i.system.locationRoll
      );
      const attackingAssetsWithLocationNotes = this.actor.items.filter(i =>
        i.id != this.id && i.type == "asset" && i.system.location === this.system.location && i.system.locationRoll
      );
      const attackRolls = await this.getAssetAttackRolls(true);
      const defenseRolls = await attackedAsset.getAssetAttackRolls(
        false, this.system.attackTarget
      );
      if (!attackRolls || !defenseRolls) {
        ui.notifications?.error("Unable to roll for asset");
        return;
      }
      const hitRoll = attackRolls[0];
      const defRoll = defenseRolls[0];
      if (
        !hitRoll ||
        hitRoll == undefined ||
        !hitRoll.total ||
        !defRoll.total
      ) {
        return;
      }
      let attackDamage = null;
      let defDamage = null;
      let attackDesc = "";
      if (hitRoll.total > defRoll.total) {
        //attacker hits
        attackDamage = await attackRolls[1].render();
        attackDesc = "<b>Attacker Hits.</b><br>";
      } else if (hitRoll.total < defRoll.total) {
        //defender hits
        defDamage = await defenseRolls[1].render();
        attackDesc = "<b>Defender Hits Counter.</b><br>";
      } else {
        //both hit
        attackDamage = await attackRolls[1].render();
        defDamage = await defenseRolls[1].render();
        attackDesc = "<b>Tie! Both do damage.</b><br>";
      }
      const name = `${this.actor?.name} - ${this.name} attacking ${attackedAsset.name} (${attackedFaction.name})`;
      const dialogData = {
        desc: this.system.description,
        name,
        hitRoll: await hitRoll.render(),
        defRoll: await defRoll.render(),
        attackDamage: attackDamage,
        defDamage: defDamage,
        attackDesc: attackDesc,
        attackKey: game.i18n.localize("attackKey"),
        defenseSpecial: attackedAsset.system.attackSpecial,
        attackSpecial: this.system.attackSpecial,
        attackedAssetsWithLocationNotes,
        attackingAssetsWithLocationNotes,
      };
      const template = "systems/wwn/templates/chat/asset-attack-def.html";
      const chatContent = await renderTemplate(template, dialogData);
      if (this.actor?.type == "faction") {
        const chatData = {
          content: chatContent,
          type: CONST.CHAT_MESSAGE_STYLES.WHISPER,
        };
        getDocumentClass("ChatMessage").applyRollMode(chatData, "gmroll");
        getDocumentClass("ChatMessage").create(chatData);
      }
    };

    this.popUpDialog?.close();
    this.popUpDialog = new Dialog(
      {
        title: `Select asset to attack for ${this.name} (${this.system.location})`,
        content: await html,
        default: "roll",
        buttons: {
          roll: {
            label: game.i18n.localize("WWN.faction.attack"),
            callback: _rollAssetForm,
          },
        },
      },
      {
        classes: ["wwn"],
      }
    );
    this.popUpDialog.render(true);
  }

  async _assetLogAction() {
    // Basic template rendering data
    let content = `<h3> ${this.name} </h3>`;
    if ("description" in this.system) {
      content += `<span class="flavor-text"> ${this.system.description}</span>`;
    } else {
      content += "<span class='flavor-text'> No Description</span>";
    }
    if (this.actor?.type == "faction") {
      const actor = this.actor;
      const gm_ids = ChatMessage.getWhisperRecipients("GM")
        .filter((i) => i)
        .map((i) => i.id)
        .filter((i) => i !== null);

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker(),
        content: content, //${item.data.description}
        type: CONST.CHAT_MESSAGE_STYLES.WHISPER,
        whisper: gm_ids,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async rollAsset(_shiftKey = false) {
    const data = this.system;
    if (data.unusable) {
      ui.notifications?.error("Asset is unusable");
      return;
    }
    if ((data.attackDamage && data.attackDamage !== "") || data.counter) {
      const d = new Dialog(
        {
          title: "Attack with Asset",
          content:
            "<p>Do you want to roll an attack(default), counter, search for an asset to attack, or use asset/chat description?</p>",
          buttons: {
            attack: {
              icon: '<i class="fas fa-check"></i>',
              label: "Attack",
              callback: () => this._assetAttack(true),
            },
            counter: {
              icon: '<i class="fas fa-check"></i>',
              label: "Counter",
              callback: () => this._assetAttack(false),
            },
            search: {
              icon: '<i class="fas fa-check"></i>',
              label: "Search active factions for an asset to attack",
              callback: () => this._assetSearch(data.attackTarget),
            },
            action: {
              icon: '<i class="fas fa-check"></i>',
              label: "Use Action",
              callback: () => this._assetLogAction(),
            },
          },
          default: "attack",
        },
        {
          classes: ["wwn.dialog"],
        }
      );
      d.render(true);
    } else {
      this._assetLogAction();
    }
  }

  /**
   * Get attack rolls for multiple assets simultaneously
   * @param {Array<WwnItem>} assets - Array of asset items to get rolls for
   * @param {boolean} isOffense - Whether these are offensive attacks
   * @returns {Promise<Array<{asset: WwnItem, status: string, value: Array<Roll>|Error}>>}
   */
  static async getMultipleAssetAttackRolls(assets, isOffense) {
    // Create an array of promises for each asset's attack rolls
    const rollPromises = assets.map(async (asset) => {
      try {
        const rolls = await asset.getAssetAttackRolls(isOffense);
        return {
          asset,
          status: 'fulfilled',
          value: rolls
        };
      } catch (error) {
        return {
          asset,
          status: 'rejected',
          value: error
        };
      }
    });

    // Use Promise.allSettled to wait for all rolls to complete
    const results = await Promise.allSettled(rollPromises);

    // Transform the results into a more usable format
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          asset: assets[index],
          status: 'fulfilled',
          value: result.value
        };
      } else {
        return {
          asset: assets[index],
          status: 'rejected',
          value: result.reason
        };
      }
    });
  }

  // Example usage in rollAsset method:
  async rollMultipleAssets(assets, isOffense) {
    const results = await WwnItem.getMultipleAssetAttackRolls(assets, isOffense);

    // Process the results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [hitRoll, damageRoll] = result.value;
        // Handle successful rolls
        console.log(`${result.asset.name} rolled:`, hitRoll.total, damageRoll.total);
      } else {
        // Handle failed rolls
        console.error(`Failed to roll for ${result.asset.name}:`, result.value);
      }
    }

    return results;
  }

  static _handleTokenSelection(event) {
    // Only handle clicks on select-tokens buttons
    const button = event.target.closest('.select-tokens');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    // Get the action and find the appropriate save group
    const action = button.dataset.action;
    if (!action) return;

    const message = button.closest('.chat-message');
    if (!message) return;

    const targetGroup = Array.from(message.querySelectorAll('.save-group'))
      .find(group => {
        const header = group.querySelector('.save-group-header')?.textContent.toLowerCase();
        return (action === 'select-successful' && header?.includes('successful')) ||
          (action === 'select-failed' && header?.includes('failed'));
      });

    if (!targetGroup) return;

    // Get all save items and their token IDs
    const tokenIds = Array.from(targetGroup.querySelectorAll('.save-item'))
      .map(item => item.dataset.tokenId)
      .filter(id => id);

    if (!tokenIds.length) {
      ui.notifications.warn("No tokens found to select");
      return;
    }

    // Find and select the tokens on the canvas
    const tokens = [];
    for (const id of tokenIds) {
      const [sceneId, tokenId] = id.split('.');
      const scene = game.scenes.get(sceneId);
      if (!scene) continue;

      const token = canvas.tokens.placeables.find(t =>
        t.scene.id === sceneId && t.id === tokenId
      );

      if (token) tokens.push(token);
    }

    if (tokens.length) {
      canvas.tokens.releaseAll();
      tokens.forEach(token => token.control({ releaseOthers: false }));
      ui.notifications.info(`Selected ${tokens.length} token${tokens.length === 1 ? '' : 's'}`);
    } else {
      ui.notifications.warn("No tokens found on the current scene");
    }
  }
}



