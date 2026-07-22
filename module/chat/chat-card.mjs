/**
 * Chat card factory — the sole entry point for system chat messages.
 * Every card renders a body partial inside the shared shell template so
 * styling and speaker handling stay consistent. No raw ChatMessage.create
 * calls anywhere else in the system.
 */

const SHELL_TEMPLATE = "systems/wwn/templates/chat/card-shell.hbs";

/**
 * Resolve the speaker for an actor, preferring token aliases.
 * @param {Actor} actor
 * @param {TokenDocument} [token]
 */
export function getWwnSpeaker(actor, token = null) {
  token ??= actor?.token ?? actor?.getActiveTokens?.(true, true)?.[0] ?? null;
  return ChatMessage.getSpeaker({ actor, token });
}

/**
 * Render the shared card shell around a body template.
 * @param {object} options
 * @returns {Promise<string>} HTML
 */
async function renderShell({
  title, subtitle, img, bodyTemplate, context = {}, badge = null, footer = null, rolls = [], defaultHealing = false,
}) {
  const { renderTemplate } = foundry.applications.handlebars;
  const body = bodyTemplate ? await renderTemplate(bodyTemplate, context) : (context.body ?? "");
  // Core only auto-renders dice HTML when content has no custom markup,
  // so the shell embeds each roll's rendered HTML itself.
  let rollsHtml = "";
  for (const roll of rolls) rollsHtml += await roll.render();
  return renderTemplate(SHELL_TEMPLATE, {
    title, subtitle, img, badge, body, footer, rollsHtml, defaultHealing,
  });
}

/**
 * Create a chat message carrying one or more evaluated Rolls.
 *
 * @param {object} options
 * @param {Roll[]} options.rolls          Evaluated Roll instances (native array — DSN works)
 * @param {string} options.kind           Roll kind stamp for the ChatListener
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {string} [options.img]
 * @param {object} [options.badge]        { label, type: "hit"|"miss"|"warn" }
 * @param {string} [options.bodyTemplate] Body partial path
 * @param {object} [options.context]      Body template context
 * @param {Actor} [options.actor]
 * @param {TokenDocument} [options.token]
 * @param {object} [options.flags]        Extra flags merged under flags.wwn
 * @param {boolean} [options.defaultHealing]  Start damage apply cards in healing mode
 * @param {keyof typeof CONFIG.ChatMessage.modes} [options.messageMode]
 */
export async function createRollMessage({
  rolls = [],
  kind = "formula",
  title,
  subtitle,
  img,
  badge,
  bodyTemplate,
  context = {},
  actor,
  token,
  flags = {},
  defaultHealing = false,
  messageMode,
} = {}) {
  const content = await renderShell({
    title, subtitle, img, badge, bodyTemplate, context, rolls, defaultHealing,
  });
  const messageData = {
    speaker: getWwnSpeaker(actor, token),
    rolls,
    content,
    sound: CONFIG.sounds.dice,
    flags: {
      "wwn": { chatCard: true, kind, ...flags },
    },
  };
  ChatMessage.applyMode(messageData, messageMode);
  return ChatMessage.create(messageData);
}

/**
 * Create a non-roll card (item descriptions, power activations, notices).
 */
export async function createCardMessage({
  title,
  subtitle,
  img,
  badge,
  bodyTemplate,
  context = {},
  actor,
  token,
  flags = {},
  whisper,
  messageMode,
} = {}) {
  const content = await renderShell({ title, subtitle, img, badge, bodyTemplate, context });
  const messageData = {
    speaker: getWwnSpeaker(actor, token),
    content,
    whisper,
    flags: {
      "wwn": { chatCard: true, kind: "card", ...flags },
    },
  };
  if (messageMode) ChatMessage.applyMode(messageData, messageMode);
  return ChatMessage.create(messageData);
}
