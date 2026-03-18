/**
 * Roll and use methods for WwnItem. Called with (item, options) from WwnItem.
 */
import { WwnDice } from "../dice.js";
import { WwnDialog } from "../dialog/wwn-dialog.js";

export async function rollSkill(item, options = {}) {
  const template = "systems/wwn/templates/items/dialogs/roll-skill.hbs";
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
    defaultScore: item.system.score,
    dicePool: item.system.skillDice,
    name: item.name,
    rollMode: game.settings.get("core", "rollMode"),
    rollModes: CONFIG.Dice.rollModes
  };
  const newData = {
    actor: item.actor,
    item,
    roll: {},
  };
  const data = item.system;
  const skillName = item.name;
  const score = data.score?.length ? item.actor?.system?.scores?.[data.score] : null;
  const scoreMod = score ? score.mod : 0;
  let armorPenalty = 0;
  if (skillName === "Exert") {
    armorPenalty -= item.parent?.system?.skills?.exertPenalty ?? 0;
  } else if (skillName === "Sneak") {
    armorPenalty -= item.parent?.system?.skills?.sneakPenalty ?? 0;
  }
  let skillLevel;
  const poly = item.parent?.items?.find((i) => i.name === "Polymath");
  if (!poly || skillName === "Shoot" || skillName === "Stab" || skillName === "Punch") {
    skillLevel = data.ownedLevel;
  } else {
    skillLevel = Math.max(poly.system.ownedLevel - 1, data.ownedLevel);
  }
  const rollParts = [data.skillDice, scoreMod, skillLevel];
  if (armorPenalty < 0) rollParts.push(armorPenalty);
  if (options.skipDialog) {
    const attrKey = score ? `WWN.scores.${data.score}.short` : null;
    const rollTitle = score ? `${game.i18n.localize(attrKey)}/${item.name}` : item.name;
    const rollData = {
      parts: rollParts,
      data: newData,
      title: rollTitle,
      flavor: null,
      speaker: ChatMessage.getSpeaker({ actor: item.actor }),
      form: null,
      rollTitle,
    };
    return WwnDice.sendRoll(rollData);
  }
  const html = await renderTemplate(template, dialogData);
  const title = `${game.i18n.localize("WWN.Roll")} ${item.name}`;
  const _doRoll = async (dialogHtml) => {
    const form = (dialogHtml?.length ? dialogHtml[0] : dialogHtml)?.querySelector?.("form");
    if (!form) return;
    rollParts[0] = form.skillDice.value;
    rollParts[1] = score ? item.actor.system.scores[form.score.value].mod : 0;
    const attrKey = score ? `WWN.scores.${form.score.value}.short` : null;
    const rollTitle = score ? `${game.i18n.localize(attrKey)}/${item.name}` : item.name;
    WwnDice.sendRoll({
      parts: rollParts,
      data: newData,
      title: rollTitle,
      flavor: null,
      speaker: ChatMessage.getSpeaker({ actor: item.actor }),
      form,
      rollTitle,
    });
  };
  return WwnDialog.wait({
    title,
    content: html,
    buttons: [
      {
        action: "ok",
        label: title,
        icon: "fa-solid fa-dice-d20",
        default: true,
        callback: async (_ev, _btn, dialog) => {
          const dialogHtml = dialog?.element;
          _doRoll(dialogHtml);
        },
      },
      { action: "cancel", icon: "fa-solid fa-times", label: game.i18n.localize("WWN.Cancel") },
    ],
  });
}

export function rollWeapon(item, options = {}) {
  const isNPC = item.actor?.type !== "character";
  const data = item.system;
  let type = isNPC ? "attack" : "melee";
  if (item.actor?.type === "ship") {
    ui.notifications.error("Normal weapon in a ship inventory. Please roll normal weapons from character sheets.");
    return;
  }
  const rollData = {
    ...(item.actor?._getRollData() || {}),
    item,
    actor: item.actor,
    roll: { save: item.system.save, target: null },
  };
  if (data.missile && data.melee && !isNPC) {
    WwnDialog.wait({
      title: "Choose Attack Range",
      content: "",
      buttons: [
        {
          action: "melee",
          icon: "fa-solid fa-fist-raised",
          label: "Melee",
          default: true,
          callback: () => { item.actor.targetAttack(rollData, "melee", options); },
        },
        {
          action: "missile",
          icon: "fa-solid fa-bullseye",
          label: "Missile",
          callback: () => { item.actor.targetAttack(rollData, "missile", options); },
        },
      ],
    });
    return;
  }
  if (data.missile && !isNPC) type = "missile";
  item.actor.targetAttack(rollData, type, options);
}

export function rollShipWeapon(item, options = {}) {
  if (item.actor?.type !== "ship") {
    ui.notifications.error("Put ship weapons on ships!");
    return;
  }
  const type = "missile";
  const rollData = {
    ...(item.actor?._getRollData() || {}),
    item,
    actor: item.actor,
    roll: { save: item.system.save, target: null },
  };
  item.actor.targetAttack(rollData, type, options);
}

export async function rollFormula(item, options = {}) {
  const data = item.system;
  if (!data.roll) {
    console.warn("No roll formula found for item:", item.name);
    throw new Error("This Item does not have a formula to roll!");
  }
  const label = item.name;
  const rollParts = [data.roll];
  const type = data.rollType;
  const newData = {
    ...(item.actor?._getRollData() || {}),
    actor: item.actor,
    item,
    roll: { type, target: data.rollTarget, blindroll: data.blindroll },
  };
  return WwnDice.Roll({
    event: options.event,
    parts: rollParts,
    data: newData,
    skipDialog: true,
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    flavor: game.i18n.format("WWN.roll.formula", { label }),
    title: game.i18n.format("WWN.roll.formula", { label }),
  });
}

export async function spendSpell(item) {
  if (item.actor.system.spells.leveledSlots) {
    if (item.type !== "spell") throw new Error("Trying to spend a spell on an item that is not a spell.");
    const itemData = item.system;
    if (itemData.cast <= 0) {
      ui.notifications.error("No slots remaining!");
      return;
    }
    await item.update({ system: { cast: itemData.cast - 1 } });
    await show(item, { skipDialog: true });
  } else {
    const spellsLeft = item.actor.system.spells.perDay.value;
    const spellsMax = item.actor.system.spells.perDay.max;
    if (spellsLeft + 1 > spellsMax) {
      ui.notifications.warn("No spell slots remaining!");
      return;
    }
    await item.actor.update({ "system.spells.perDay.value": spellsLeft + 1 });
    await show(item, { skipDialog: true });
  }
}

export function spendArt(item) {
  if (item.system.time) {
    const sourceName = item.system.source;
    if (sourceName === undefined) {
      ui.notifications.warn("Please add class name to the Source field.");
      return;
    }
    const currEffort = item.system.effort;
    const sourceVal = item.actor.system.classes[sourceName]?.value;
    const sourceMax = item.actor.system.classes[sourceName]?.max;
    if (sourceVal + 1 > sourceMax) {
      ui.notifications.warn("No Effort remaining!");
      return;
    }
    item.update({ "system.effort": currEffort + 1 }).then(() => show(item, { skipDialog: true }));
  } else {
    show(item, { skipDialog: true });
  }
}

export function roll(item) {
  switch (item.type) {
    case "weapon":
      rollWeapon(item);
      break;
    case "spell":
      spendSpell(item);
      break;
    case "art":
      spendArt(item);
      break;
    case "item":
    case "armor":
    case "focus":
    case "ability":
      show(item);
      break;
    case "skill":
      rollSkill(item);
      break;
    case "asset":
      item.rollAsset();
      break;
    case "crewmember":
    case "fitting":
      show(item);
      break;
  }
}

export async function show(item, options = {}) {
  const token = item.actor?.token;
  const templateData = {
    actor: item.actor,
    tokenId: token ? `${token.parent?.id}.${token.id}` : null,
    item: foundry.utils.duplicate(item),
    data: item.getChatData(),
    labels: item.labels,
    isHealing: item.isHealing,
    hasDamage: item.hasDamage,
    isSpell: item.type === "spell",
    hasSave: item.hasSave,
    config: CONFIG.WWN,
  };
  const template = "systems/wwn/templates/chat/item-card.hbs";
  const html = await renderTemplate(template, templateData);
  const chatData = {
    user: game.user.id,
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
    content: html,
    speaker: {
      actor: item.actor?.id,
      token: item.actor?.token,
      alias: item.actor?.name,
    },
  };
  const rollMode = game.settings.get("core", "rollMode");
  if (["gmroll", "blindroll"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients("GM");
  if (rollMode === "selfroll") chatData.whisper = [game.user.id];
  if (rollMode === "blindroll") chatData.blind = true;
  return ChatMessage.create(chatData);
}
