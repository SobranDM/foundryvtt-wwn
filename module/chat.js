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
  let canApply = (li) =>
    canvas.tokens.controlled.length && li.find(".dice-roll").length;
  options.push(
    {
      name: game.i18n.localize("WWN.messages.applyDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, 1, 1),
    },
    {
      name: game.i18n.localize("WWN.messages.applyHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, -1, 1),
    },
    {
      name: game.i18n.localize("WWN.messages.applyHalfDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, 0.5, 1),
    },
    {
      name: game.i18n.localize("WWN.messages.applyHalfHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, -0.5, 1),
    },
    {
      name: game.i18n.localize("WWN.messages.applyDoubleDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, 2, 1),
    },
    {
      name: game.i18n.localize("WWN.messages.applyDoubleHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, -2, 1),
    }
  );
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
    let total = roll.find(".dice-total");
    let value = total.text();
    roll.append(
      $(
        `<div class="dice-damage"><button type="button" data-action="apply-damage" title="` +
          game.i18n.localize("WWN.messages.applyDamage") +
          `"><i class="fas fa-tint"></i></button></div>`
      )
    );
    roll.find('button[data-action="apply-damage"]').click((ev) => {
      ev.preventDefault();
      applyChatCardDamage(roll, 1, 0);
    });
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
    shockMessage.find('button[data-action="apply-damage"]').click((ev) => {
      ev.preventDefault();
      applyChatCardDamage(shockMessage, 1, 0);
    });
  }
};

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
 *
 * @param {HTMLElement} roll    The chat entry which contains the roll data
 * @param {Number} multiplier   A damage multiplier to apply to the rolled damage.
 * @return {Promise}
 */
async function applyChatCardDamage(roll, multiplier, index) {
  const diceTotals = roll.find(".dice-total");
  const targets =
    Array.from(game.user.targets).length > 0
      ? Array.from(game.user.targets)
      : canvas.tokens.controlled;
  const amount =
    diceTotals.length > 1
      ? Number(diceTotals[index].textContent)
      : Number(diceTotals[0].textContent);
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
    user: game.user_id,
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
