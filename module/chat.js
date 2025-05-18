/**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {HTMLElement} html    The Chat Message being rendered
 * @param {Array} options       The Array of Context Menu options
 *
 * @return {Array}              The extended options Array including new context choices
 */
export const addChatMessageContextOptions = function (html, options) {
  /**
   * Determines if damage can be applied from this message
   * @param {HTMLElement} li    The chat message element
   * @return {boolean}          Whether damage can be applied
   */
  const canApply = (li) => {
    const message = game.messages.get(li.dataset.messageId);
    if (!canvas.tokens.controlled.length) return false;

    // Check for v13 style rolls
    if (message.rolls?.length) return true;

    // Check for legacy style rolls in content
    if (message.content) {
      return message.content.includes("damage-roll") ||
        message.content.includes("dice-roll");
    }

    return false;
  };

  /**
   * Extracts the damage amount from a chat message
   * @param {ChatMessage} message    The chat message to extract from
   * @return {number|null}           The damage amount, or null if not found
   */
  const getDamageAmount = (message) => {
    // Case 1: Message has rolls (v13)
    if (message.rolls?.length) {
      return message.rolls[0].total;
    }

    // Case 2: Legacy damage roll in content
    if (message.content) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = message.content;

      // Try both damage-roll and dice-roll elements
      const damageRoll = tempDiv.querySelector('.damage-roll .part-total, .dice-roll .dice-total');
      if (damageRoll) {
        return Number(damageRoll.textContent);
      }
    }

    return null;
  };

  // Define the damage application options
  const damageOptions = [
    {
      name: game.i18n.localize("WWN.messages.applyDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      multiplier: 1
    },
    {
      name: game.i18n.localize("WWN.messages.applyHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      multiplier: -1
    },
    {
      name: game.i18n.localize("WWN.messages.applyHalfDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      multiplier: 0.5
    },
    {
      name: game.i18n.localize("WWN.messages.applyHalfHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      multiplier: -0.5
    },
    {
      name: game.i18n.localize("WWN.messages.applyDoubleDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      multiplier: 2
    },
    {
      name: game.i18n.localize("WWN.messages.applyDoubleHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      multiplier: -2
    }
  ];

  // Add each damage option to the context menu
  damageOptions.forEach(opt => {
    options.push({
      name: opt.name,
      icon: opt.icon,
      condition: canApply,
      callback: (li) => {
        const message = game.messages.get(li.dataset.messageId);
        const damage = getDamageAmount(message);
        if (damage !== null) {
          applyChatCardDamage(damage, opt.multiplier);
        }
      }
    });
  });

  return options;
};

/* -------------------------------------------- */

export const addChatMessageButtons = function (msg, html, data) {
  // Hide blind rolls
  let blindable = html.find(".blindable");
  if (
    msg.blind &&
    !game.user.isGM &&
    blindable &&
    blindable.data("blind") === true
  ) {
    blindable.replaceWith(
      "<div class='dice-roll'><div class='dice-result'><div class='dice-formula'>???</div></div></div>"
    );
  }
  // Buttons
  let roll = html.find(".damage-roll");
  if (roll.length > 0) {
    roll.append(
      $(
        `<div class="dice-damage"><button type="button" data-action="apply-damage" title="` +
        game.i18n.localize("WWN.messages.applyDamage") +
        `"><i class="fas fa-tint"></i></button></div>`
      )
    );
  }

  const shockMessage = html.find(".shock-message");
  if (shockMessage.length > 0) {
    shockMessage.append(
      $(
        `<div class="dice-damage"><button type="button" data-action="apply-damage" title="` +
        game.i18n.localize("WWN.messages.applyShockDamage") +
        `"><i class="fas fa-tint"></i></button></div>`
      )
    );
  }
};

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
 *
 * @param {Number} amount        The base damage amount to apply
 * @param {Number} multiplier    A damage multiplier to apply to the rolled damage.
 * @return {Promise}
 */
export async function applyChatCardDamage(amount, multiplier) {
  const targets = canvas.tokens.controlled;

  const title =
    multiplier > 0
      ? `Applied ${Math.floor(amount * multiplier)} damage`
      : `Applied ${Math.floor(amount * multiplier * -1)} healing`;
  const image = multiplier > 0 ? "icons/svg/blood.svg" : "icons/svg/heal.svg";

  const templateData = {
    title: title,
    body: `<ul><li>${targets
      .map((t) => t.name)
      .join("</li><li>")}</li></ul>`,
    image: image
  };

  const template = "systems/wwn/templates/chat/apply-damage.html";
  const html = await renderTemplate(template, templateData);

  const chatData = {
    user: game.user.id,
    content: html
  };

  ChatMessage.create(chatData, {});
  return Promise.all(
    targets.map((t) => {
      const a = t.actor;
      return a.applyDamage(amount, multiplier);
    })
  );
}

/* -------------------------------------------- */
