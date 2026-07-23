/**
 * Chat Log context-menu options for applying damage from roll messages.
 *
 * @param {HTMLElement} html    The Chat Message being rendered
 * @param {Array} options       The Array of Context Menu options
 * @return {Array}              The extended options Array including new context choices
 */
export const addChatMessageContextOptions = function (html, options) {
  const canApply = (li) => {
    const message = game.messages.get(li.dataset.messageId);
    return !!canvas.tokens.controlled.length && !!message?.rolls?.length;
  };

  const getDamageAmount = (message) => {
    if (message.rolls?.length) return message.rolls[0].total;
    return null;
  };

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

/**
 * Apply rolled dice damage to the currently controlled tokens.
 *
 * @param {Number} amount        The base damage amount to apply
 * @param {Number} multiplier    A damage multiplier (negative for healing)
 * @return {Promise}
 */
export async function applyChatCardDamage(amount, multiplier) {
  const targets = canvas.tokens.controlled;

  const title =
    multiplier > 0
      ? `Applied ${Math.floor(amount * multiplier)} damage`
      : `Applied ${Math.floor(amount * multiplier * -1)} healing`;
  const image = multiplier > 0 ? "icons/svg/blood.svg" : "icons/svg/heal.svg";

  const { createNoticeMessage } = await import("./chat/chat-card.mjs");
  await createNoticeMessage({
    title,
    img: image,
    list: targets.map((t) => t.name),
    flags: { kind: "apply-damage" },
  });
  return Promise.all(
    targets.map((t) => {
      const a = t.actor;
      return a.applyDamage(amount, multiplier);
    })
  );
}
