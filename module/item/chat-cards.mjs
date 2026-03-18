/**
 * Chat card click/toggle and save-dialog handling for WwnItem.
 * Attaches document-level listeners and routes actions to item methods.
 */
import { WwnDice } from "../dice.js";
import { applyChatCardDamage } from "../chat.js";
import { WwnDialog } from "../dialog/wwn-dialog.js";

let _boundClickHandler = null;
let _boundToggleHandler = null;
let _boundSelectTokensHandler = null;

function getChatCardActor(card) {
  const tokenKey = card.dataset?.tokenId;
  if (tokenKey) {
    const [sceneId, tokenId] = tokenKey.split(".");
    const scene = game.scenes.get(sceneId);
    if (!scene) return null;
    const tokenData = scene.getEmbeddedDocument("Token", tokenId);
    if (!tokenData) return null;
    const token = new Token(tokenData);
    return token.actor;
  }
  const actorId = card.dataset?.actorId;
  return game.actors.get(actorId) || null;
}

function getChatCardTargets(card) {
  const character = game.user.character;
  const controlled = canvas.tokens?.controlled ?? [];
  const targets = controlled.map((t) => {
    const actor = t.actor ?? game.actors.get(t.document?.actorId);
    if (!actor) return null;
    return {
      actor,
      token: t,
      name: t.name,
      id: t.id,
      actorId: actor.id,
      actorLink: t.document?.actorLink,
    };
  }).filter((t) => t !== null);

  if (character && controlled.length === 0) {
    targets.push({
      actor: character,
      token: null,
      name: character.name,
      id: character.id,
      actorId: character.id,
      actorLink: false,
    });
  }
  return targets;
}

function onChatCardToggleContent(event) {
  const clickedElement = event.target;
  const itemName = clickedElement.closest(".item-name");
  if (!itemName) return;
  const card = itemName.closest(".chat-card");
  if (!card) return;
  const content = card.querySelector(".card-content");
  if (!content) return;
  content.style.display = content.style.display === "none" ? "block" : "none";
}

async function onChatCardAction(event) {
  const button = event.target.closest("button");
  if (!button) return;
  button.disabled = true;

  try {
    const card = button.closest(".chat-card");
    if (!card) return;

    const message = card.closest(".message") ?? card.closest(".chat-message");
    if (!message) return;

    const messageId = message.dataset?.messageId;
    if (!messageId) return;

    const messageObj = game.messages.get(messageId);
    if (!messageObj) return;

    const action = button.dataset?.action;
    if (!action) return;

    const isTargetted = action === "save";
    if (!(isTargetted || game.user.isGM || messageObj.isAuthor)) return;

    const actor = getChatCardActor(card);
    if (!actor) return;

    const item = actor.items.get(card.dataset?.itemId);
    if (!item) {
      ui.notifications.error(`The requested item no longer exists on Actor ${actor.name}`);
      return;
    }

    let targets = [];
    let sceneId = null;
    if (isTargetted) {
      targets = getChatCardTargets(card);
      sceneId = targets.find((t) => t.token)?.token?.scene?.id;
    }

    if (action === "damage") {
      await item.rollDamage({ event });
      return;
    }
    if (action === "formula") {
      await item.rollFormula({ event });
      return;
    }
    if (action === "save") {
      if (!targets.length) {
        ui.notifications.warn("You must have one or more controlled Tokens in order to use this option.");
        return;
      }

      const blindRoll = !!messageObj.blind;
      const dialogData = {
        tokens: targets.map((t) => ({
          id: t.token?.id ?? t.id,
          name: t.token?.name ?? t.name,
          actorId: t.actorId,
          actorLink: t.actorLink,
        })),
      };

      const template = "systems/wwn/templates/chat/save-dialog.hbs";
      const html = await renderTemplate(template, dialogData);

      const runConfirm = async (formEl) => {
        if (!formEl) return;
        const globalModifierInput = formEl.querySelector(".save-dialog-global-modifier");
        const globalModifier = parseInt(globalModifierInput?.value, 10) || 0;
        const saveResults = [];

        for (const dialogToken of dialogData.tokens) {
          const individualModifierInput = formEl.querySelector(`[name="modifier-${dialogToken.id}"]`);
          const individualModifier = individualModifierInput?.value ?? "";
          const modifier = individualModifier !== "" ? parseInt(individualModifier, 10) : globalModifier;

          const target = targets.find((t) => (t.token?.id ?? t.id) === dialogToken.id);
          if (!target?.actor) continue;

          const token = target.token;
          const fullTokenId = token ? `${sceneId}.${token.id}` : (sceneId ? `${sceneId}.${target.actorId}` : target.actorId);

          const saveType = button.dataset.save;
          if (!saveType || !target.actor.system?.saves?.[saveType]) continue;

          const saveData = {
            actor: target.actor,
            roll: {
              type: "above",
              target: target.actor.system.saves[saveType].value,
              magic: target.actor.type === "character" ? target.actor.system.scores.wis.mod : 0,
              modifier,
            },
          };

          const rollFormula = `1d20${modifier ? ` + ${modifier}` : ""}`;
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
            modifier,
          });
        }

        saveResults.sort((a, b) => b.roll.total - a.roll.total);
        const successfulSaves = saveResults.filter((r) => r.isSuccess);
        const failedSaves = saveResults.filter((r) => r.isFailure);

        const templateData = {
          saveType: game.i18n.localize(`WWN.saves.${button.dataset.save}`),
          results: saveResults,
          hasSuccessfulSaves: successfulSaves.length > 0,
          hasFailedSaves: failedSaves.length > 0,
          blindroll: blindRoll,
        };

        const content = await renderTemplate("systems/wwn/templates/chat/save-results.hbs", templateData);
        const chatData = {
          speaker: { alias: game.i18n.localize("WWN.spells.Save") },
          sound: CONFIG.sounds.dice,
          content,
          type: blindRoll ? (CONST.CHAT_MESSAGE_TYPES?.ROLL ?? CONST.CHAT_MESSAGE_STYLES?.OTHER) : CONST.CHAT_MESSAGE_STYLES?.OTHER,
          user: game.user.id,
        };
        if (blindRoll) {
          chatData.whisper = ChatMessage.getWhisperRecipients("GM");
          chatData.blind = true;
          chatData.rolls = saveResults.map((r) => r.roll);
        }
        if (game.dice3d) {
          for (const result of saveResults) {
            await game.dice3d.showForRoll(result.roll, game.user, true);
          }
        }
        const msg = await ChatMessage.create(chatData);
        if (msg?.element) chatListeners(msg.element);
      };

      await WwnDialog.wait({
        title: "Selected Token Saves",
        content: html,
        buttons: [
          {
            action: "confirm",
            icon: "fa-solid fa-check",
            label: "Confirm",
            default: true,
            callback: async (_ev, _btn, dialog) => {
              const formEl = dialog?.element?.querySelector?.("form") ?? dialog?.element;
              const form = (formEl?.length ? formEl[0] : formEl)?.querySelector?.("form") ?? formEl;
              await runConfirm(form);
            },
          },
          { action: "cancel", icon: "fa-solid fa-times", label: "Cancel" },
        ],
      });
    }
  } catch (err) {
    console.error("Error in chat card action:", err);
    ui.notifications.error("An error occurred while processing the action.");
  } finally {
    button.disabled = false;
  }
}

function handleChatCardClick(event) {
  const card = event.target.closest(".chat-card, .chat-message");
  if (!card) return;
  const button = event.target.closest("button, .card-buttons button, .damage-application");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();

  const message = button.closest(".message, .chat-message");
  if (!message) return;

  if (!message.classList.contains("chat-message")) {
    const messageId = message.dataset?.messageId;
    if (!messageId) return;
    if (!game.messages.get(messageId)) return;
  }

  const action = button.dataset?.action;

  if (action === "apply-damage" || action === "apply-shock") {
    const targets = getChatCardTargets(card);
    if (!targets.length) {
      ui.notifications.warn("You must have one or more tokens selected to apply damage.");
      return;
    }
    let amount;
    if (action === "apply-shock") {
      amount = parseInt(button.dataset.damage, 10);
    } else {
      if (game.settings.get("wwn", "godboundDamage")) {
        amount = parseInt(button.dataset.damage, 10);
        if (Number.isNaN(amount)) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = button.dataset.damage ?? "";
          const godboundValues = tempDiv.querySelectorAll(".godbound-values");
          if (godboundValues.length >= 1) {
            const match = godboundValues[0].textContent.match(/= (\d+)$/);
            if (match) amount = parseInt(match[1], 10);
          }
          if (Number.isNaN(amount)) {
            const diceTotal = tempDiv.querySelector(".dice-total");
            if (diceTotal) amount = parseInt(diceTotal.textContent, 10);
          }
        }
      } else {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = button.dataset.damage ?? "";
        const diceTotal = tempDiv.querySelector(".dice-total");
        amount = diceTotal ? parseInt(diceTotal.textContent, 10) : parseInt(button.dataset.damage, 10);
      }
    }
    if (!Number.isNaN(amount)) {
      const multiplier = parseFloat(button.dataset.damageMultiplier) || 1;
      applyChatCardDamage(amount, multiplier);
      return;
    }
  }

  onChatCardAction(event);
}

function handleChatCardToggle(event) {
  const card = event.target.closest(".chat-card");
  if (!card) return;
  if (!event.target.closest(".chat-card .item-name")) return;
  event.preventDefault();
  event.stopPropagation();
  onChatCardToggleContent(event);
}

function handleTokenSelection(event) {
  const button = event.target.closest(".select-tokens");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const action = button.dataset?.action;
  if (!action) return;
  const message = button.closest(".chat-message");
  if (!message) return;

  const targetGroup = Array.from(message.querySelectorAll(".save-group")).find((group) => {
    const header = group.querySelector(".save-group-header")?.textContent?.toLowerCase();
    return (action === "select-successful" && header?.includes("successful")) || (action === "select-failed" && header?.includes("failed"));
  });
  if (!targetGroup) return;

  const tokenIds = Array.from(targetGroup.querySelectorAll(".save-item"))
    .map((item) => item.dataset?.tokenId)
    .filter((id) => id);
  if (!tokenIds.length) {
    ui.notifications.warn("No tokens found to select");
    return;
  }

  const tokens = [];
  for (const id of tokenIds) {
    const [sceneId, tokenId] = id.split(".");
    const scene = game.scenes.get(sceneId);
    if (!scene) continue;
    const token = canvas.tokens?.placeables?.find((t) => t.scene?.id === sceneId && t.id === tokenId);
    if (token) tokens.push(token);
  }
  if (tokens.length) {
    canvas.tokens.releaseAll();
    tokens.forEach((token) => token.control({ releaseOthers: false }));
    ui.notifications.info(`Selected ${tokens.length} token${tokens.length === 1 ? "" : "s"}`);
  } else {
    ui.notifications.warn("No tokens found on the current scene");
  }
}

/**
 * Attach document-level chat card listeners. Call from Hooks (renderChatLog, renderChatMessageHTML).
 * @param {HTMLElement|jQuery|string} html
 */
export function chatListeners(html) {
  if (!html) {
    console.error("No HTML element provided to attach listeners to");
    return;
  }

  const root = html instanceof jQuery ? html[0] : html;
  const container = root instanceof HTMLElement ? root : (() => {
    const div = document.createElement("div");
    if (typeof html === "string") div.innerHTML = html;
    return div;
  })();
  const cards = Array.from(container.querySelectorAll?.(".chat-card, .chat-message .save-results, .chat-message .save-header, .chat-message") ?? []);
  if (!cards.length) return;

  if (_boundClickHandler) document.removeEventListener("click", _boundClickHandler);
  if (_boundToggleHandler) document.removeEventListener("click", _boundToggleHandler);
  if (_boundSelectTokensHandler) document.removeEventListener("click", _boundSelectTokensHandler);

  _boundClickHandler = handleChatCardClick;
  _boundToggleHandler = handleChatCardToggle;
  _boundSelectTokensHandler = handleTokenSelection;

  document.addEventListener("click", _boundClickHandler);
  document.addEventListener("click", _boundToggleHandler);
  document.addEventListener("click", _boundSelectTokensHandler);
}

export { getChatCardActor, getChatCardTargets };
