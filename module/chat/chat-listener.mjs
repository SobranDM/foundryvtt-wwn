/**
 * Delegated chat card action wiring (replaces WWN's jQuery delegation).
 * Toggle/multiplier are card-local UI state stored as data- attributes on
 * the card root — no message re-render, no persistence.
 */
import {
  applyStrainToActor,
  parseStrainField,
  resolveStrainAmount,
} from "../helpers/strain.mjs";
import { applyPowerEffectsToActor } from "../helpers/power-effects.mjs";

export class ChatListener {
  /** Attach the delegated listener to the chat log. */
  static activate() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
      html.addEventListener("click", (event) => {
        const target = event.target.closest("[data-action]");
        if (!target || !html.contains(target)) return;
        ChatListener.#onAction(event, target, message);
      });
    });
  }

  static async #onAction(event, target, message) {
    event.preventDefault();
    const action = target.dataset.action;
    const card = target.closest(".wwn-chat-card") ?? target.closest(".message-content");
    switch (action) {
      case "toggleHeal": {
        const healing = card.dataset.heal === "true";
        card.dataset.heal = String(!healing);
        card.classList.toggle("wwn-heal-mode", !healing);
        target.classList.toggle("active", !healing);
        break;
      }
      case "setMultiplier": {
        card.dataset.multiplier = target.dataset.value;
        for (const btn of card.querySelectorAll('[data-action="setMultiplier"]')) {
          btn.classList.toggle("active", btn === target);
        }
        break;
      }
      case "applyRow":
      case "applyStraight": {
        const flags = message.getFlag("wwn", "applyRows") ?? [];
        const row = flags.find((r) => r.id === target.dataset.rowId);
        if (!row) return;
        const raw = action === "applyStraight" ? row.altValue : row.value;
        const multiplier = Number(card?.dataset.multiplier ?? 1);
        const sign = card?.dataset.heal === "true" ? -1 : 1;
        await ChatListener.#applyToTokens(raw * sign, multiplier);
        break;
      }
      case "rollCardSave": {
        const saveId = target.dataset.save;
        for (const actor of ChatListener.#actorTargets()) {
          await game.wwn.WwnDice.rollSave(actor, saveId, { skipDialog: true });
        }
        break;
      }
      case "applyHitDice": {
        const actorUuid = message.getFlag("wwn", "actorUuid");
        const total = message.getFlag("wwn", "hitDiceTotal");
        const actor = await fromUuid(actorUuid);
        if (!actor?.isOwner) return;
        await ChatListener.#applyHitDice(actor, total);
        break;
      }
      case "powerDamage": {
        const itemUuid = message.getFlag("wwn", "itemUuid");
        const item = await fromUuid(itemUuid);
        if (item) await item.rollPowerDamage();
        break;
      }
      case "applyTargetStrain": {
        const raw = message.getFlag("wwn", "targetStrain");
        if (!raw) return;
        const parsed = parseStrainField(raw);
        const amount = await resolveStrainAmount(parsed, {
          title: game.i18n.localize("WWN.Power.TargetStrainChoiceTitle"),
          hintKey: "WWN.Power.TargetStrainChoiceHint",
          labelKey: "WWN.Power.TargetStrain",
        });
        if (amount === null || amount <= 0) return;
        const actors = ChatListener.#actorTargets();
        if (!actors.length) {
          return ui.notifications.warn(game.i18n.localize("WWN.Chat.NoTokenSelected"));
        }
        let applied = 0;
        for (const actor of actors) {
          if (await applyStrainToActor(actor, amount)) applied++;
        }
        if (applied > 0) {
          ui.notifications.info(
            game.i18n.format("WWN.Power.TargetStrainApplied", { amount, count: applied })
          );
        }
        break;
      }
      case "applyPowerEffects": {
        const itemUuid = message.getFlag("wwn", "itemUuid");
        const durationScope = message.getFlag("wwn", "durationScope");
        if (!itemUuid || !durationScope) return;
        const item = await fromUuid(itemUuid);
        if (!item) return;
        const actors = ChatListener.#actorTargets();
        if (!actors.length) {
          return ui.notifications.warn(game.i18n.localize("WWN.Chat.NoTokenSelected"));
        }
        let applied = 0;
        let skipped = 0;
        for (const actor of actors) {
          const result = await applyPowerEffectsToActor(actor, item, { durationScope });
          applied += result.applied;
          skipped += result.skipped;
        }
        if (applied > 0) {
          ui.notifications.info(
            game.i18n.format("WWN.Power.EffectsApplied", { count: applied, name: item.name })
          );
        } else if (skipped > 0) {
          ui.notifications.warn(game.i18n.localize("WWN.Power.EffectsAlreadyApplied"));
        }
        break;
      }
    }
  }

  /** Selected tokens take priority; fall back to targeted tokens. */
  static #actorTargets() {
    let tokens = canvas.tokens?.controlled ?? [];
    if (!tokens.length) tokens = Array.from(game.user.targets);
    return tokens.map((t) => t.actor).filter((a) => a);
  }

  static async #applyToTokens(amount, multiplier) {
    const actors = ChatListener.#actorTargets();
    if (!actors.length) {
      return ui.notifications.warn(game.i18n.localize("WWN.Chat.NoTokenSelected"));
    }
    for (const actor of actors) {
      await actor.applyDamage(amount, multiplier);
    }
  }

  /**
   * WWN/SWN level-up rule: reroll the full HD pool; if the new total beats
   * the current max HP, take it — otherwise old max +1.
   */
  static async #applyHitDice(actor, total) {
    const oldMax = actor.system.hp.max;
    let newMax;
    let outcome;
    if (total > oldMax) {
      newMax = total;
      outcome = game.i18n.format("WWN.Roll.HitDiceImproved", { total, max: newMax });
    } else {
      newMax = oldMax + 1;
      outcome = game.i18n.format("WWN.Roll.HitDiceIncrement", { total, old: oldMax, max: newMax });
    }
    const gained = Math.max(newMax - oldMax, 0);
    await actor.update({
      "system.hp.max": newMax,
      "system.hp.value": actor.system.hp.value + gained,
    });
    const { createCardMessage } = await import("./chat-card.mjs");
    return createCardMessage({
      actor,
      title: game.i18n.localize("WWN.Roll.HitDiceApplied"),
      context: { body: `<p>${outcome}</p>` },
    });
  }
}
